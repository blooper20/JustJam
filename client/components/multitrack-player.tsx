'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, Download, Loader2, Plus, Music, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '../lib/utils';
import { downloadMix } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/store/project-store';

// ==================== 타입 정의 ====================

interface StemFiles {
  vocals?: string | null;
  bass?: string | null;
  drums?: string | null;
  guitar?: string | null;
  piano?: string | null;
  other?: string | null;
  master?: string | null;
}

interface MultiTrackPlayerProps {
  stems: StemFiles;
  projectId: string;
  initialBpm?: number | null;
  onTimeUpdate?: (time: number) => void;
  chordProgression?: string | null;
  songStructure?: string | null;
}

interface Chord {
  start: number;
  end: number;
  name: string;
}

interface TrackControl {
  name: string;
  url: string;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  instance: WaveSurfer | null;
}

interface SongSegment {
  name?: string;
  start: number;
  end: number;
  color?: string;
}

// 트랙별 파형 색상
const TRACK_COLORS: Record<string, string> = {
  vocals: '#f472b6', // 핑크
  bass: '#fbbf24', // 앰버
  drums: '#60a5fa', // 블루
  guitar: '#a78bfa', // 바이올렛
  piano: '#34d399', // 에메랄드
  other: '#9ca3af', // 그레이
};

// ==================== 메트로놈 엔진 ====================
// 정확한 타이밍과 드리프트 보정을 지원하는 Web Audio API 기반의 메트로놈 엔진
class MetronomeEngine {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private strongBuffer: AudioBuffer | null = null;
  private weakBuffer: AudioBuffer | null = null;
  private isRunning = false;
  private timerId: ReturnType<typeof setInterval> | null = null;

  // 타이밍 설정
  private lookahead = 0.1; // 스케줄링 범위 (100ms)

  // 재생 설정
  private bpm = 120;
  private startOffset = 0;
  private volume = 1.0;
  private playbackRate = 1.0;

  // 비트 스케줄링 추적
  private nextBeatIndex = 0;

  // 외부 재생 정보 소스
  private getPlaybackInfo:
    | (() => { currentTime: number; isPlaying: boolean; rate: number })
    | null = null;

  // 시각적 비트 표시 콜백
  onBeat: ((beatIndex: number, beatTime: number) => void) | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.gainNode = audioContext.createGain();
    this.gainNode.connect(audioContext.destination);
    this.createClickBuffers();
  }

  // 클릭 사운드 버퍼 생성
  private createClickBuffers() {
    const sampleRate = this.audioContext.sampleRate;

    // 강박 (다운비트) - 높고 날카로운 "틱" 소리
    const strongDuration = 0.03;
    const strongSamples = Math.floor(sampleRate * strongDuration);
    const strongBuffer = this.audioContext.createBuffer(1, strongSamples, sampleRate);
    const strongData = strongBuffer.getChannelData(0);

    // 약박 (오프비트) - 낮고 부드러운 "톡" 소리
    const weakDuration = 0.025;
    const weakSamples = Math.floor(sampleRate * weakDuration);
    const weakBuffer = this.audioContext.createBuffer(1, weakSamples, sampleRate);
    const weakData = weakBuffer.getChannelData(0);

    // 강박: 날카로운 어택, 빠른 감쇠
    for (let i = 0; i < strongSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 60);
      const fundamental = Math.sin(2 * Math.PI * 1000 * t);
      const harmonic1 = Math.sin(2 * Math.PI * 2000 * t) * 0.3;
      const harmonic2 = Math.sin(2 * Math.PI * 3000 * t) * 0.1;
      strongData[i] = (fundamental + harmonic1 + harmonic2) * envelope * 0.7;
    }

    // 약박: 약간 낮고 부드러운 소리
    for (let i = 0; i < weakSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 80);
      const fundamental = Math.sin(2 * Math.PI * 800 * t);
      const harmonic1 = Math.sin(2 * Math.PI * 1600 * t) * 0.2;
      weakData[i] = (fundamental + harmonic1) * envelope * 0.45;
    }

    this.strongBuffer = strongBuffer;
    this.weakBuffer = weakBuffer;
  }

  setBpm(bpm: number) {
    this.bpm = Math.max(30, Math.min(300, bpm));
  }

  setStartOffset(offset: number) {
    this.startOffset = Math.max(0, offset);
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.01);
  }

  setTimeSource(fn: () => { currentTime: number; isPlaying: boolean; rate: number }) {
    this.getPlaybackInfo = fn;
  }

  seek(playbackTime: number) {
    const beatInterval = 60.0 / this.bpm;
    if (playbackTime >= this.startOffset) {
      const timeSinceStart = playbackTime - this.startOffset;
      this.nextBeatIndex = Math.ceil(timeSinceStart / beatInterval);
    } else {
      this.nextBeatIndex = 0;
    }
  }

  private playClick(isStrong: boolean, scheduledTime: number) {
    if (!this.strongBuffer || !this.weakBuffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = isStrong ? this.strongBuffer : this.weakBuffer;
    source.connect(this.gainNode);

    if (scheduledTime > this.audioContext.currentTime) {
      source.start(scheduledTime);
    } else {
      source.start();
    }
  }

  private scheduler = () => {
    if (!this.isRunning || !this.getPlaybackInfo) return;

    const info = this.getPlaybackInfo();
    const T_play = info.currentTime;
    const T_ctx = this.audioContext.currentTime;
    const R = info.rate;
    this.playbackRate = R;

    const beatInterval = 60.0 / this.bpm;
    const windowEndPlay = T_play + R * this.lookahead;

    while (true) {
      const T_play_beat = this.startOffset + this.nextBeatIndex * beatInterval;

      if (T_play_beat < windowEndPlay) {
        if (T_play_beat >= T_play) {
          const T_ctx_beat = T_ctx + (T_play_beat - T_play) / R;
          const isStrong = this.nextBeatIndex % 4 === 0;
          this.playClick(isStrong, T_ctx_beat);

          const beatIndexForCallback = this.nextBeatIndex % 4;
          const delayMs = Math.max(0, (T_ctx_beat - this.audioContext.currentTime) * 1000);

          setTimeout(() => {
            if (this.isRunning && this.onBeat && this.getPlaybackInfo) {
              const currentInfo = this.getPlaybackInfo();
              const diff = Math.abs(currentInfo.currentTime - T_play_beat);
              if (diff < 0.2) {
                this.onBeat(beatIndexForCallback, T_play_beat);
              }
            }
          }, delayMs);
        }

        this.nextBeatIndex++;
      } else {
        break;
      }
    }
  };

  start(playbackTime: number) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.seek(playbackTime);
    this.timerId = setInterval(this.scheduler, 25);
  }

  stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.onBeat) {
      this.onBeat(-1, 0);
    }
  }

  destroy() {
    this.stop();
    this.gainNode.disconnect();
  }
}

// ==================== 메인 컴포넌트 ====================
export function MultiTrackPlayer({
  stems,
  projectId,
  initialBpm,
  onTimeUpdate,
  chordProgression,
  songStructure,
}: MultiTrackPlayerProps) {
  const t = useTranslations('Player');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Zustand Store 구독
  const {
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    playbackRate,
    setPlaybackRate,
    loopStart,
    setLoopStart,
    loopEnd,
    setLoopEnd,
    isLoopEnabled,
    setIsLoopEnabled,
    bookmarks,
    addBookmark,
    currentChord,
    setCurrentChord,
    bpm,
    setBpm,
    inputBpm,
    setInputBpm,
    metronomeEnabled,
    setMetronomeEnabled,
    metronomeVolume,
    setMetronomeVolume,
    startOffsetSeconds,
    setStartOffsetSeconds,
    currentBeat,
    setCurrentBeat,
    trackVolumes,
    setTrackVolume,
    trackMutes,
    toggleTrackMute,
    trackSolos,
    toggleTrackSolo,
    resetPlayer,
  } = useProjectStore();

  // 로컬 컴포넌트 상태
  const [isDownloading, setIsDownloading] = useState(false);
  const [tracks, setTracks] = useState<TrackControl[]>([]);
  const [loadedTracks, setLoadedTracks] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Chords state
  const chords = useRef<Chord[]>([]);

  useEffect(() => {
    if (chordProgression) {
      try {
        chords.current = JSON.parse(chordProgression);
      } catch (e) {
        console.error('Failed to parse chord progression', e);
      }
    }
  }, [chordProgression]);

  // Update current chord based on currentTime
  useEffect(() => {
    const chord = chords.current.find((c) => currentTime >= c.start && currentTime < c.end);
    if (chord) {
      setCurrentChord(chord.name);
    } else {
      setCurrentChord('');
    }
  }, [currentTime, setCurrentChord]);

  // 곡 구조 (Song Structure)
  const segments = useMemo(() => {
    if (!duration) return [];

    if (songStructure) {
      try {
        const parsed = JSON.parse(songStructure) as SongSegment[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const colorMap: Record<string, string> = {
            Intro: 'bg-zinc-800',
            Chorus: 'bg-primary/20 text-primary',
            Verse: 'bg-zinc-900',
            Bridge: 'bg-purple-500/10 text-purple-400',
            Outro: 'bg-zinc-800',
          };
          return parsed.map((s) => ({
            ...s,
            color:
              colorMap[Object.keys(colorMap).find((k) => s.name?.includes(k)) || 'Verse'] ||
              'bg-zinc-900',
          }));
        }
      } catch (e) {
        console.error('Failed to parse structure', e);
      }
    }

    const result = [];
    const labels = [
      { name: '전주 (Intro)', color: 'bg-zinc-800' },
      { name: '1절 (Verse 1)', color: 'bg-zinc-900' },
      { name: '후렴 1 (Chorus 1)', color: 'bg-primary/10 text-primary' },
      { name: '2절 (Verse 2)', color: 'bg-zinc-900' },
      { name: '후렴 2 (Chorus 2)', color: 'bg-primary/10 text-primary' },
      { name: '브릿지 (Bridge)', color: 'bg-purple-500/10 text-purple-400' },
      { name: '후렴 3 (Chorus 3)', color: 'bg-primary/10 text-primary' },
      { name: '후주 (Outro)', color: 'bg-zinc-800' },
    ];

    let interval = 30;
    if (bpm) {
      const barTime = (60 / bpm) * 4;
      interval = barTime * 8; // 8 bars per segment
    }

    let current = 0;
    let idx = 0;
    while (current < duration) {
      const end = Math.min(current + interval, duration);
      result.push({ start: current, end, ...labels[idx % labels.length] });
      current = end;
      idx++;
    }
    return result;
  }, [duration, bpm, songStructure]);

  const handleAddBookmark = () => {
    const time = Math.round(currentTime * 10) / 10;
    addBookmark(time);
    toast.success(`${formatTime(time)} 북마크가 추가되었습니다.`);
  };

  // 스크롤 상태 (헤더 축소용)
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Refs
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const readyCount = useRef(0);
  const isReadyRef = useRef(false);

  // Realtime synchronizer refs
  const isPlayingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const playbackRateRef = useRef(1.0);

  // 오디오 컨텍스트
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // 메트로놈 엔진
  const metronomeRef = useRef<MetronomeEngine | null>(null);

  // 마스터 파형
  const masterContainerRef = useRef<HTMLDivElement>(null);
  const masterInstanceRef = useRef<WaveSurfer | null>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingWaveform, setIsDraggingWaveform] = useState(false);

  // TAP BPM 상태
  const tapTimesRef = useRef<number[]>([]);

  // Ref 동기화
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  // Initialize and clean up project store states
  useEffect(() => {
    if (initialBpm) {
      setBpm(initialBpm);
      setInputBpm(initialBpm);
    }
    return () => {
      resetPlayer();
    };
  }, [initialBpm, setBpm, setInputBpm, resetPlayer]);

  // 오디오 컨텍스트 및 메트로놈 엔진 초기화
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    setAudioContext(ctx);

    const metronome = new MetronomeEngine(ctx);
    metronome.onBeat = (beatIndex) => {
      setCurrentBeat(beatIndex);
    };
    metronomeRef.current = metronome;

    return () => {
      metronome.destroy();
      ctx.close();
    };
  }, [setCurrentBeat]);

  // 메트로놈 BPM 업데이트
  useEffect(() => {
    if (metronomeRef.current) {
      metronomeRef.current.setBpm(bpm);
    }
  }, [bpm]);

  // 메트로놈 시작 오프셋 업데이트
  useEffect(() => {
    if (metronomeRef.current) {
      metronomeRef.current.setStartOffset(startOffsetSeconds);
    }
  }, [startOffsetSeconds]);

  // 메트로놈 볼륨 업데이트
  useEffect(() => {
    if (metronomeRef.current) {
      metronomeRef.current.setVolume(metronomeEnabled ? metronomeVolume : 0);
    }
  }, [metronomeVolume, metronomeEnabled]);

  // 메트로놈에 실제 재생 정보 연결
  useEffect(() => {
    if (!metronomeRef.current) return;

    metronomeRef.current.setTimeSource(() => {
      const firstTrack = tracks.find((t) => t.instance);
      if (firstTrack?.instance) {
        return {
          currentTime: firstTrack.instance.getCurrentTime(),
          isPlaying: isPlayingRef.current,
          rate: playbackRateRef.current,
        };
      }
      return {
        currentTime: currentTimeRef.current,
        isPlaying: isPlayingRef.current,
        rate: playbackRateRef.current,
      };
    });
  }, [tracks]);

  // 메트로놈 재생/일시정지 동기화
  useEffect(() => {
    if (!metronomeRef.current) return;

    if (isPlaying && metronomeEnabled) {
      const firstTrack = tracks.find((t) => t.instance);
      const startPlayTime = firstTrack?.instance
        ? firstTrack.instance.getCurrentTime()
        : currentTimeRef.current;
      metronomeRef.current.setVolume(metronomeVolume);
      metronomeRef.current.start(startPlayTime);
    } else {
      metronomeRef.current.stop();
      setCurrentBeat(-1);
    }
  }, [isPlaying, metronomeEnabled, tracks, setCurrentBeat, metronomeVolume]);

  // 트랙 초기화
  useEffect(() => {
    const validStems = Object.entries(stems).filter(
      ([name, url]) => !!url && name !== 'master',
    ) as [string, string][];

    const newTracks: TrackControl[] = validStems.map(([name, url]) => ({
      name,
      url,
      volume: 0.8,
      isMuted: false,
      isSolo: false,
      instance: null,
    }));

    setTracks(newTracks);

    return () => {
      newTracks.forEach((t) => t.instance?.destroy());
    };
  }, [stems]);

  // 재생/일시정지 토글
  const togglePlay = useCallback(async () => {
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, audioContext, setIsPlaying]);

  // 탐색 처리
  const handleSeek = useCallback(
    (value: number[]) => {
      const time = value[0];
      const progress = time / duration;
      tracks.forEach((t) => t.instance?.seekTo(progress));
      setCurrentTime(time);

      if (metronomeRef.current) {
        metronomeRef.current.seek(time);
      }
    },
    [duration, tracks, setCurrentTime],
  );

  // WaveSurfer 인스턴스 초기화
  useEffect(() => {
    if (tracks.length === 0 || !audioContext) return;

    tracks.forEach((track, index) => {
      if (track.instance) return;

      const container = containerRefs.current[track.name];
      if (!container) return;

      setTimeout(() => {
        const ws = WaveSurfer.create({
          container,
          waveColor: TRACK_COLORS[track.name] || '#9ca3af',
          progressColor: 'rgba(255, 255, 255, 0.3)',
          url: track.url,
          height: 64,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          cursorWidth: 0,
          interact: false,
          normalize: true,
          audioContext: audioContext,
          backend: 'WebAudio',
          renderFunction: undefined,
          partialRender: true,
        } as Parameters<typeof WaveSurfer.create>[0]);

        ws.on('error', (err) => {
          console.error(`WaveSurfer error on track "${track.name}":`, err);
          setLoadError('오디오 파일 경로를 찾을 수 없습니다');
        });

        ws.on('ready', () => {
          readyCount.current++;
          setLoadedTracks((prev) => prev + 1);
          if (index === 0) {
            setDuration(ws.getDuration());
          }

          const vol = useProjectStore.getState().trackVolumes[track.name] ?? 0.8;
          ws.setVolume(vol);
        });

        if (index === 0) {
          ws.on('timeupdate', (time) => {
            const state = useProjectStore.getState();
            setCurrentTime(time);
            if (onTimeUpdate) onTimeUpdate(time);

            if (state.isLoopEnabled && state.loopStart !== null && state.loopEnd !== null) {
              if (time >= state.loopEnd) {
                handleSeek([state.loopStart]);
              }
            }
          });

          ws.on('finish', () => {
            const state = useProjectStore.getState();
            if (state.isLoopEnabled && state.loopStart !== null) {
              handleSeek([state.loopStart]);
            } else {
              setIsPlaying(false);
            }
          });
        }

        setTracks((prev) => prev.map((t) => (t.name === track.name ? { ...t, instance: ws } : t)));
      }, index * 100);
    });
  }, [tracks, audioContext, setDuration, setCurrentTime, onTimeUpdate, setIsPlaying, handleSeek]);

  // 모든 트랙 준비 완료 체크
  useEffect(() => {
    if (tracks.length > 0 && readyCount.current >= tracks.length) {
      isReadyRef.current = true;
    }
  }, [tracks]);

  // 마스터 파형 초기화
  useEffect(() => {
    if (!masterContainerRef.current || !audioContext) return;

    let masterUrl = stems.master;

    if (!masterUrl && tracks.length > 0) {
      const masterTrack =
        tracks.find((t) => t.name === 'drums') ||
        tracks.find((t) => t.name === 'bass') ||
        tracks[0];
      masterUrl = masterTrack?.url;
    }

    if (!masterUrl) return;

    if (masterInstanceRef.current) {
      masterInstanceRef.current.destroy();
      masterInstanceRef.current = null;
    }

    const ws = WaveSurfer.create({
      container: masterContainerRef.current,
      waveColor: '#a1a1aa',
      progressColor: '#facc15',
      url: masterUrl,
      height: 96,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      cursorWidth: 2,
      cursorColor: '#facc15',
      normalize: true,
      interact: false,
      autoScroll: false,
      minPxPerSec: 0,
      fillParent: true,
      audioContext: audioContext,
      partialRender: true,
    } as Parameters<typeof WaveSurfer.create>[0]);

    ws.on('ready', () => {
      ws.setVolume(0);
    });

    masterInstanceRef.current = ws;

    return () => {
      ws.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stems.master, tracks.length, audioContext]);

  // Play/Pause synchronization effect
  useEffect(() => {
    if (tracks.length === 0) return;

    tracks.forEach((t) => {
      if (!t.instance) return;
      if (isPlaying) {
        if (!t.instance.isPlaying()) {
          t.instance.play().catch(console.error);
        }
      } else {
        if (t.instance.isPlaying()) {
          t.instance.pause();
        }
      }
    });

    if (masterInstanceRef.current) {
      if (isPlaying) {
        if (!masterInstanceRef.current.isPlaying()) {
          masterInstanceRef.current.play().catch(console.error);
        }
      } else {
        if (masterInstanceRef.current.isPlaying()) {
          masterInstanceRef.current.pause();
        }
      }
    }
  }, [isPlaying, tracks]);

  // WaveSurfer playhead drift correction loop (500ms intervals, 50ms threshold)
  useEffect(() => {
    if (!isPlaying || tracks.length < 2) return;

    const intervalId = setInterval(() => {
      const primaryTrack = tracks.find((t) => t.instance);
      if (!primaryTrack || !primaryTrack.instance) return;

      const primaryTime = primaryTrack.instance.getCurrentTime();
      tracks.forEach((track) => {
        if (track !== primaryTrack && track.instance) {
          const trackTime = track.instance.getCurrentTime();
          const drift = Math.abs(trackTime - primaryTime);
          if (drift > 0.05) {
            const progress = primaryTime / duration;
            track.instance.seekTo(progress);
          }
        }
      });
    }, 500);

    return () => clearInterval(intervalId);
  }, [isPlaying, tracks, duration]);

  // Sync track controls (Volume, Mute, Solo) from Zustand to WaveSurfer instances
  useEffect(() => {
    const hasSolo = Object.values(trackSolos).some((s) => s);

    tracks.forEach((track) => {
      if (!track.instance) return;

      const vol = trackVolumes[track.name] ?? 0.8;
      const isMuted = trackMutes[track.name] ?? false;
      const isSolo = trackSolos[track.name] ?? false;

      let targetVolume = vol;
      if (hasSolo) {
        targetVolume = isSolo && !isMuted ? vol : 0;
      } else {
        targetVolume = isMuted ? 0 : vol;
      }

      if (track.instance.getVolume() !== targetVolume) {
        track.instance.setVolume(targetVolume);
      }
    });
  }, [tracks, trackVolumes, trackMutes, trackSolos]);

  // 마스터 파형 탐색 동기화
  useEffect(() => {
    if (!masterInstanceRef.current) return;
    const diff = Math.abs(masterInstanceRef.current.getCurrentTime() - currentTime);
    if (diff > 0.1) {
      masterInstanceRef.current.setTime(currentTime);
    }
  }, [currentTime]);

  // 빨간 마커 드래그 시작
  const handleMarkerMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDraggingStart(true);
    e.stopPropagation();
  }, []);

  // 빨간 마커 드래그 처리
  useEffect(() => {
    if (!isDraggingStart) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!masterContainerRef.current || !duration) return;
      const rect = masterContainerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      setStartOffsetSeconds(Number((ratio * duration).toFixed(1)));
    };

    const handleMouseUp = () => {
      setIsDraggingStart(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDraggingStart, duration, setStartOffsetSeconds]);

  // 파형 스크러빙 - 탐색 위치 계산
  const calculateSeekPosition = useCallback(
    (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
      if (!masterContainerRef.current || !duration) return null;
      const rect = masterContainerRef.current.getBoundingClientRect();
      const clientX =
        'touches' in e && e.touches[0]
          ? e.touches[0].clientX
          : (e as MouseEvent | React.MouseEvent).clientX;
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  // 파형 클릭/드래그 시작
  const handleWaveformMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if ((e.target as HTMLElement).closest('[data-marker]')) return;

      setIsDraggingWaveform(true);

      const seekTime = calculateSeekPosition(e);
      if (seekTime !== null) {
        handleSeek([seekTime]);
      }
    },
    [calculateSeekPosition, handleSeek],
  );

  // 파형 드래그 처리
  useEffect(() => {
    if (!isDraggingWaveform) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const seekTime = calculateSeekPosition(e);
      if (seekTime !== null) {
        handleSeek([seekTime]);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingWaveform(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDraggingWaveform, calculateSeekPosition, handleSeek]);

  // 재생 속도 동기화
  useEffect(() => {
    tracks.forEach((t) => {
      if (t.instance) {
        t.instance.setPlaybackRate(playbackRate);
      }
    });
    if (masterInstanceRef.current) {
      masterInstanceRef.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate, tracks]);

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSeek([Math.max(0, currentTimeRef.current - 5)]);
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSeek([Math.min(duration, currentTimeRef.current + 5)]);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, handleSeek, duration]);

  // 시간 포맷팅 (분:초)
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // BPM 입력 완료 (Blur) 처리
  const handleBpmBlur = useCallback(() => {
    let val = Number(inputBpm);
    if (isNaN(val) || val < 30) val = 30;
    if (val > 300) val = 300;
    setBpm(val);
    setInputBpm(val);
  }, [inputBpm, setBpm, setInputBpm]);

  // BPM 입력 Enter 키 처리
  const handleBpmKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleBpmBlur();
      }
    },
    [handleBpmBlur],
  );

  // TAP BPM 처리
  const handleTap = () => {
    const now = Date.now();
    const newTaps = [...tapTimesRef.current, now].filter((t) => now - t < 2000);
    tapTimesRef.current = newTaps;

    if (newTaps.length > 1) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avgInterval);

      if (newBpm >= 30 && newBpm <= 300) {
        setBpm(newBpm);
        setInputBpm(newBpm);
      }
    }
  };

  // 믹스 다운로드
  const handleDownloadMix = async () => {
    setIsDownloading(true);
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(
        '<html><body style="background:#18181b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h2>믹스 생성 중... 잠시만 기다려주세요...</h2></body></html>',
      );
    }

    try {
      const volumes: Record<string, number> = {};
      const hasSolo = Object.values(trackSolos).some((s) => s);

      tracks.forEach((t) => {
        const isMuted = trackMutes[t.name] ?? false;
        const isSolo = trackSolos[t.name] ?? false;
        const vol = trackVolumes[t.name] ?? 0.8;

        if (hasSolo) {
          volumes[t.name] = isSolo ? vol : 0;
        } else if (isMuted) {
          volumes[t.name] = 0;
        } else {
          volumes[t.name] = vol;
        }
      });

      const downloadMetronomeVolume = metronomeEnabled ? metronomeVolume : 0;
      const { url } = await downloadMix(
        projectId,
        volumes,
        bpm,
        downloadMetronomeVolume,
        startOffsetSeconds,
      );

      if (newWindow) {
        newWindow.location.href = url;
      } else {
        window.open(url, '_blank');
      }

      toast.success('믹스 준비 완료!');
    } catch (error) {
      console.error(error);
      toast.error('믹스 다운로드 실패');
      if (newWindow) newWindow.close();
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50 backdrop-blur-xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-800/60 bg-red-950/20 p-10 text-center">
        <p className="text-base font-bold text-red-400">{loadError}</p>
        <Button
          variant="outline"
          size="sm"
          className="border-red-700 text-red-400 hover:bg-red-900/30"
          onClick={() => {
            setLoadError(null);
            setLoadedTracks(0);
            readyCount.current = 0;
            setTracks([]);
          }}
        >
          다시 시도
        </Button>
      </Card>
    );
  }
  if (!isMounted) return null;

  return (
    <div className="space-y-6 select-none relative">
      {/* 로딩 오버레이 */}
      {tracks.length > 0 && loadedTracks < tracks.length && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm rounded-xl">
          <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-sm w-full mx-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">{t('loading')}</h3>
            <p className="text-muted-foreground text-sm mb-6">{t('preparing')}</p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>{t('progress')}</span>
                <span>
                  {t('tracksCompleted', { completed: loadedTracks, total: tracks.length })}
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${(loadedTracks / tracks.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 마스터 상단 고정 바 (모든 상황에서 최상단 유지) */}
      <div
        className={cn(
          'sticky top-16 md:top-20 z-40 transition-all duration-300 ease-in-out w-full',
          isScrolled ? 'pt-1' : 'pt-2',
        )}
      >
        <div
          className={cn(
            'bg-zinc-900 border border-zinc-800 shadow-2xl backdrop-blur-md bg-opacity-95 rounded-2xl transition-all duration-300 overflow-hidden flex flex-col',
            isScrolled ? 'p-2 md:p-3 gap-2' : 'p-4 md:p-6 gap-4',
          )}
        >
          {/* 상단 1열: 재생 버튼 + 파형 + 마스터 정보 */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* 재생/일시정지 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={isPlaying ? '일시정지' : '재생'}
              className={cn(
                'rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 shrink-0 shadow-lg active:scale-95 transition-all outline-none focus:ring-0',
                isScrolled ? 'h-10 w-10' : 'h-12 w-12 md:h-16 md:w-16',
              )}
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause
                  className={cn(
                    'fill-current text-primary',
                    isScrolled ? 'w-4 h-4' : 'w-6 h-6 md:w-8 md:h-8',
                  )}
                />
              ) : (
                <Play
                  className={cn(
                    'fill-current text-primary',
                    isScrolled ? 'w-4 h-4 ml-0.5' : 'w-6 h-6 ml-0.5 md:w-8 md:h-8 md:ml-1',
                  )}
                />
              )}
            </Button>

            <div className="flex-1 space-y-2 relative">
              <div
                ref={masterContainerRef}
                className={cn(
                  'w-full rounded-xl cursor-pointer relative bg-zinc-950/40 border border-zinc-800/50 shadow-inner overflow-hidden transition-all duration-300',
                  'touch-action-none',
                  isScrolled ? 'h-[32px] md:h-[40px]' : 'h-[64px] md:h-[96px]',
                  isDraggingWaveform && 'cursor-grabbing',
                )}
                onMouseDown={handleWaveformMouseDown}
                onTouchStart={handleWaveformMouseDown}
              />

              {/* 빨간 마커 */}
              {duration > 0 && (
                <div
                  data-marker="start-offset"
                  className="absolute top-0 bottom-0 w-0 border-l-2 border-red-500 z-10 hover:border-l-4 cursor-ew-resize group"
                  style={{ left: `${(startOffsetSeconds / duration) * 100}%` }}
                  onMouseDown={handleMarkerMouseDown}
                  onTouchStart={handleMarkerMouseDown}
                >
                  <div className="absolute -top-3 -left-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="red">
                      <path d="M12 21L21 9H3L12 21Z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* 반복 영역 표시 */}
              {duration > 0 && loopStart !== null && loopEnd !== null && (
                <div
                  className={cn(
                    'absolute top-0 bottom-0 bg-primary/15 border-x border-primary/35 pointer-events-none z-0',
                    !isLoopEnabled && 'opacity-30 grayscale',
                  )}
                  style={{
                    left: `${(loopStart / duration) * 100}%`,
                    width: `${((loopEnd - loopStart) / duration) * 100}%`,
                  }}
                />
              )}

              {/* 곡 구조 표시바 */}
              <div className="absolute bottom-0 left-0 w-full h-1 md:h-1.5 flex pointer-events-none opacity-80 overflow-hidden">
                {segments.map((seg, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-full border-r border-zinc-950/20 last:border-0 transition-all',
                      seg.color,
                    )}
                    style={{ width: `${((seg.end - seg.start) / duration) * 100}%` }}
                  />
                ))}
              </div>
            </div>

            {/* 마스터 정보 (CHORD + Speed) */}
            <div
              className={cn(
                'hidden sm:flex flex-col gap-1 md:gap-2 border-l border-zinc-800 pl-3 md:pl-4 py-1 transition-all',
                isScrolled ? 'min-w-[100px] md:min-w-[140px]' : 'min-w-[160px] md:min-w-[240px]',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none flex items-center">
                  {currentChord ? t('currentChord') : t('speed')}
                </span>
                {isScrolled && (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-primary tabular-nums">
                    {formatTime(currentTime)}
                  </div>
                )}
              </div>

              {currentChord && (
                <div className="flex items-center justify-center bg-primary/10 px-2 py-0.5 md:py-1 rounded-lg border border-primary/20 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
                  <span className="text-base md:text-xl font-black text-primary animate-in fade-in zoom-in duration-300">
                    {currentChord}
                  </span>
                </div>
              )}

              <div
                className={cn(
                  'flex items-center justify-between gap-2 bg-zinc-950/50 px-2 py-0.5 md:py-1 rounded-lg border border-zinc-800/60 shadow-sm',
                  currentChord && 'mt-0.5 md:mt-1',
                )}
              >
                <Select
                  value={playbackRate.toString()}
                  onValueChange={(v) => setPlaybackRate(parseFloat(v))}
                >
                  <SelectTrigger className="h-5 md:h-6 w-full bg-zinc-900 border-zinc-700 text-[9px] md:text-[10px] focus:ring-0 rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                    <SelectItem value="0.5">0.5x</SelectItem>
                    <SelectItem value="0.75">0.75x</SelectItem>
                    <SelectItem value="1">1.0x</SelectItem>
                    <SelectItem value="1.25">1.25x</SelectItem>
                    <SelectItem value="1.5">1.5x</SelectItem>
                    <SelectItem value="2">2.0x</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 하단 2열: 시간, 루프, 메트로놈, 다운로드 */}
          <div
            className={cn(
              'flex items-center justify-between gap-2 md:gap-4 border-t border-zinc-800/50 pt-2 transition-all',
              isScrolled ? 'py-1' : 'pt-3 md:pt-4',
            )}
          >
            <div className="flex items-center gap-3 md:gap-6">
              {/* 진행 시간 */}
              <div className="flex items-baseline gap-1.5 md:gap-2 font-mono">
                <span
                  className={cn(
                    'font-bold text-primary tabular-nums',
                    isScrolled ? 'text-base md:text-lg' : 'text-xl md:text-2xl',
                  )}
                >
                  {formatTime(currentTime)}
                </span>
                <span className="text-zinc-600">/</span>
                <span
                  className={cn(
                    'text-zinc-500',
                    isScrolled ? 'text-xs md:text-sm' : 'text-base md:text-lg',
                  )}
                >
                  {formatTime(duration)}
                </span>
              </div>

              {/* 구간 반복 (A-B) */}
              <div className="flex items-center gap-1 md:gap-2 bg-zinc-950/50 p-0.5 md:p-1 px-1.5 md:px-2 rounded-xl border border-zinc-800/50">
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter mr-1 md:mr-2 hidden md:block">
                  {t('loop')}
                </span>
                <button
                  onClick={() => {
                    if (loopStart === null) setLoopStart(currentTime);
                    else if (loopEnd === null) setLoopEnd(currentTime);
                    else {
                      setLoopStart(null);
                      setLoopEnd(null);
                    }
                  }}
                  className={cn(
                    'px-2 md:px-3 py-0.5 md:py-1 rounded-lg text-[10px] md:text-xs transition-all border font-bold active:scale-95 whitespace-nowrap',
                    loopStart !== null && loopEnd === null
                      ? 'bg-orange-500/20 text-orange-500 border-orange-500/50'
                      : loopStart !== null && loopEnd !== null
                        ? 'bg-primary/20 text-primary border-primary/50'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500',
                  )}
                >
                  {loopStart === null ? 'A' : loopEnd === null ? 'B' : 'Reset'}
                </button>
                {loopStart !== null && loopEnd !== null && (
                  <button
                    onClick={() => setIsLoopEnabled(!isLoopEnabled)}
                    className={cn(
                      'px-2 md:px-3 py-0.5 md:py-1 rounded-lg text-[10px] md:text-xs transition-all border font-bold active:scale-95',
                      isLoopEnabled
                        ? 'bg-green-500/20 text-green-500 border-green-500/50'
                        : 'bg-zinc-800 text-zinc-500 border-zinc-700',
                    )}
                  >
                    {isLoopEnabled ? 'ON' : 'OFF'}
                  </button>
                )}
              </div>
            </div>

            {/* 오른쪽: 믹스 다운로드 및 북마크 */}
            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden sm:flex gap-1 items-center mr-2">
                <button
                  onClick={handleAddBookmark}
                  className="text-[10px] font-bold text-zinc-500 hover:text-primary transition-colors flex items-center gap-1"
                >
                  <Plus size={12} />
                  {t('bookmark')}
                </button>
                {!isScrolled && (
                  <div className="flex gap-1 overflow-x-auto max-w-[80px] md:max-w-[120px] scrollbar-none">
                    {bookmarks.map((time) => (
                      <button
                        key={time}
                        onClick={() => handleSeek([time])}
                        className="px-1 py-0.5 bg-zinc-950 border border-zinc-800 rounded text-[9px] font-mono text-zinc-400 hover:text-primary"
                      >
                        {formatTime(time)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 모바일 메트로놈 토글 버튼 */}
              <button
                onClick={() => setMetronomeEnabled(!metronomeEnabled)}
                className={cn(
                  'lg:hidden p-2 rounded-lg border transition-all active:scale-95',
                  metronomeEnabled
                    ? 'bg-primary/10 border-primary/50 text-primary'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-500',
                )}
                title={t('metronome')}
              >
                <Music size={16} className={cn(metronomeEnabled && 'animate-pulse')} />
              </button>

              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadMix}
                disabled={isDownloading}
                className="h-8 md:h-9 rounded-lg font-bold gap-1.5 md:gap-2 active:scale-95 px-2 md:px-3"
              >
                {isDownloading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3 md:w-4 md:h-4" />
                )}
                <span className="hidden xs:inline text-xs md:text-sm">{t('downloadMix')}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full relative py-4 flex gap-6 items-start">
        {/* 왼쪽 영역: 개별 트랙 목록 */}
        <div className="flex-1 space-y-3">
          <div className="grid gap-3">
            {tracks.map((track) => {
              const isMuted = trackMutes[track.name] ?? false;
              const isSolo = trackSolos[track.name] ?? false;
              const volume = trackVolumes[track.name] ?? 0.8;
              return (
                <Card
                  key={track.name}
                  className={cn(
                    'bg-zinc-950/50 border-zinc-800/50 overflow-hidden transition-all',
                    isSolo && 'border-primary ring-1 ring-primary bg-zinc-900',
                    isMuted && 'opacity-60 grayscale',
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center p-2 md:p-3 gap-2 md:gap-4">
                    {/* 트랙 컨트롤 */}
                    <div className="w-full sm:w-40 md:w-48 flex flex-col gap-1.5 md:gap-2 shrink-0">
                      <div className="flex items-center justify-between">
                        <span
                          className="font-bold uppercase text-[10px] md:text-xs tracking-wider"
                          style={{ color: TRACK_COLORS[track.name] }}
                        >
                          {track.name}
                        </span>
                        <div className="flex gap-1">
                          {/* 음소거 버튼 */}
                          <button
                            onClick={() => toggleTrackMute(track.name)}
                            className={cn(
                              'px-1.5 md:px-2 py-0.5 text-[9px] md:text-[10px] rounded border font-mono transition-colors',
                              isMuted
                                ? 'bg-red-500/20 text-red-500 border-red-500/50'
                                : 'border-zinc-700 text-zinc-400 hover:text-zinc-200',
                            )}
                          >
                            M
                          </button>
                          {/* 솔로 버튼 */}
                          <button
                            onClick={() => toggleTrackSolo(track.name)}
                            className={cn(
                              'px-1.5 md:px-2 py-0.5 text-[9px] md:text-[10px] rounded border font-mono transition-colors',
                              isSolo
                                ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50'
                                : 'border-zinc-700 text-zinc-400 hover:text-zinc-200',
                            )}
                          >
                            S
                          </button>
                          {/* 개별 다운로드 */}
                          <a
                            href={track.url}
                            download={`${track.name}.wav`}
                            className="px-1.5 md:px-2 py-0.5 text-[9px] md:text-[10px] rounded border font-mono transition-colors border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                            title="스템 다운로드"
                          >
                            <Download className="w-3 h-3 inline" />
                          </a>
                        </div>
                      </div>

                      {/* 볼륨 슬라이더 */}
                      <div className="flex items-center gap-2">
                        <Volume2 size={12} className="text-zinc-500" />
                        <Slider
                          value={[volume]}
                          max={1}
                          step={0.01}
                          onValueChange={(val) => setTrackVolume(track.name, val[0])}
                          className="h-4"
                        />
                      </div>
                    </div>

                    {/* 파형 */}
                    <div
                      className="flex-1 h-12 md:h-16 rounded-md overflow-hidden relative cursor-crosshair opacity-90 hover:opacity-100 transition-opacity"
                      ref={(el) => {
                        containerRefs.current[track.name] = el;
                      }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* 오른쪽 영역: 사이드바 (메트로놈 및 설정) */}
        <aside
          className={cn(
            'w-full lg:w-72 sticky space-y-4 transition-all duration-300',
            isScrolled ? 'lg:top-[250px]' : 'lg:top-[420px]',
            'lg:block',
            !metronomeEnabled && 'hidden lg:block',
          )}
        >
          <Card className="bg-zinc-950/50 border-zinc-800/80 p-4 md:p-5 rounded-2xl backdrop-blur-md">
            <div className="space-y-4 md:space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                  {t('metronome')}
                </h3>
                <button
                  onClick={() => setMetronomeEnabled(!metronomeEnabled)}
                  className={cn(
                    'px-3 py-1 text-[10px] md:text-xs rounded-full font-bold transition-all border shadow-lg active:scale-95',
                    metronomeEnabled
                      ? 'bg-green-500 border-green-400 text-white ring-2 ring-green-500/20'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500',
                  )}
                >
                  {metronomeEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* 비주얼 비트 */}
              <div className="flex justify-between items-center bg-zinc-900/50 p-3 md:p-4 rounded-xl border border-zinc-800/30">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-3 h-3 md:w-4 md:h-4 rounded-sm transition-all duration-75',
                      metronomeEnabled && currentBeat === i
                        ? i === 0
                          ? 'bg-primary shadow-[0_0_10px_rgba(250,204,21,0.5)] scale-110'
                          : 'bg-zinc-200'
                        : 'bg-zinc-800',
                    )}
                  />
                ))}
              </div>

              {/* BPM 조절 */}
              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center">
                    {t('tempo')} (AI BPM)
                    <span title="AI가 분석한 곡의 템포입니다. 탭해서 수정할 수 있습니다.">
                      <Info className="w-3 h-3 ml-1 cursor-help" />
                    </span>
                  </span>
                  <span className="text-base md:text-lg font-mono font-bold text-primary">
                    {bpm}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={inputBpm}
                    onChange={(e) => setInputBpm(Number(e.target.value))}
                    onBlur={handleBpmBlur}
                    onKeyDown={handleBpmKeyDown}
                    className="flex-1 h-9 md:h-10 bg-zinc-900 border border-zinc-800 rounded-lg text-center text-sm font-bold font-mono focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                  <button
                    onClick={handleTap}
                    className="px-3 md:px-4 bg-zinc-800 hover:bg-zinc-700 text-[10px] md:text-xs font-bold rounded-lg border border-zinc-700 active:scale-95 transition-all text-zinc-300"
                  >
                    TAP
                  </button>
                </div>
              </div>

              {/* 메트로놈 볼륨 */}
              <div className="space-y-2 md:space-y-3 pt-2 border-t border-zinc-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">
                    {t('volume')}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {Math.round(metronomeVolume * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Volume2 size={14} className="text-zinc-500" />
                  <Slider
                    value={[metronomeVolume]}
                    max={1}
                    step={0.01}
                    onValueChange={(val) => setMetronomeVolume(val[0])}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
