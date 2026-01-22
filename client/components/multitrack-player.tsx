'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, Download, Loader2, Bookmark, X } from 'lucide-react';
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
}

interface TrackControl {
  name: string;
  url: string;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  instance: WaveSurfer | null;
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
// 실제 재생 시간과 동기화되는 메트로놈
class MetronomeEngine {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private strongBuffer: AudioBuffer | null = null;
  private weakBuffer: AudioBuffer | null = null;
  private isRunning = false;
  private animationFrameId: number | null = null;

  // 타이밍 설정
  private scheduleAheadTime = 0.05; // 미리 스케줄링할 시간 (초) - 더 짧게 설정하여 정확도 향상

  // 재생 상태
  private bpm = 120;
  private startOffset = 0;
  private volume = 1.0;

  // 비트 추적 - 중복 재생 방지
  private lastScheduledBeatIndex = -1;
  private lastBeatTime = 0; // 마지막 비트 재생 시간 (드리프트 방지)

  // 외부 시간 소스
  private getPlaybackTime: (() => number) | null = null;

  // 시각적 비트 표시 콜백
  onBeat: ((beatIndex: number) => void) | null = null;

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
      // 빠른 지수 감쇠로 펀치감 있는 소리
      const envelope = Math.exp(-t * 60);
      // 기본 주파수 + 배음으로 목재 클릭 느낌
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

  // BPM 설정
  setBpm(bpm: number) {
    this.bpm = Math.max(30, Math.min(300, bpm));
    // BPM 변경 시 비트 추적 리셋
    if (this.isRunning) {
      this.resetBeatTracking();
    }
  }

  // 시작 오프셋 설정 (초)
  setStartOffset(offset: number) {
    this.startOffset = Math.max(0, offset);
    // 오프셋 변경 시 비트 추적 리셋
    if (this.isRunning) {
      this.resetBeatTracking();
    }
  }

  // 볼륨 설정 (0~1)
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    // 부드러운 볼륨 전환
    this.gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.01);
  }

  // 외부 시간 소스 설정 (WaveSurfer 재생 시간)
  setTimeSource(fn: () => number) {
    this.getPlaybackTime = fn;
  }

  // 비트 추적 리셋
  private resetBeatTracking() {
    if (this.getPlaybackTime) {
      const currentTime = this.getPlaybackTime();
      if (currentTime >= this.startOffset) {
        const timeSinceStart = currentTime - this.startOffset;
        const beatInterval = 60.0 / this.bpm;
        // 현재 비트의 이전 비트로 설정 (다음 비트부터 재생)
        this.lastScheduledBeatIndex = Math.floor(timeSinceStart / beatInterval);
      } else {
        this.lastScheduledBeatIndex = -1;
      }
    }
  }

  // 클릭 사운드 재생
  private playClick(isStrong: boolean, scheduledTime?: number) {
    if (!this.strongBuffer || !this.weakBuffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = isStrong ? this.strongBuffer : this.weakBuffer;
    source.connect(this.gainNode);

    // 정확한 시간에 재생 (스케줄링)
    if (scheduledTime !== undefined && scheduledTime > this.audioContext.currentTime) {
      source.start(scheduledTime);
    } else {
      source.start();
    }
  }

  // 메인 틱 루프 - requestAnimationFrame 기반
  private tick = () => {
    if (!this.isRunning || !this.getPlaybackTime) {
      return;
    }

    const currentPlaybackTime = this.getPlaybackTime();
    const beatInterval = 60.0 / this.bpm;

    // 시작 오프셋 이후부터 처리
    if (currentPlaybackTime >= this.startOffset) {
      const timeSinceStart = currentPlaybackTime - this.startOffset;

      // 현재 재생 위치 기준 비트 인덱스 계산
      const currentBeatIndex = Math.floor(timeSinceStart / beatInterval);

      // 아직 재생하지 않은 비트가 있으면 재생
      if (currentBeatIndex > this.lastScheduledBeatIndex) {
        // 여러 비트가 밀린 경우 현재 비트만 재생 (드리프트 방지)
        const beatToPlay = currentBeatIndex;
        const isStrong = beatToPlay % 4 === 0;

        this.playClick(isStrong);

        // 시각적 콜백 호출
        if (this.onBeat) {
          this.onBeat(beatToPlay % 4);
        }

        this.lastScheduledBeatIndex = beatToPlay;
        this.lastBeatTime = currentPlaybackTime;
      }
    } else {
      // 시작 오프셋 이전이면 리셋
      if (this.lastScheduledBeatIndex !== -1) {
        this.lastScheduledBeatIndex = -1;
        if (this.onBeat) {
          this.onBeat(-1);
        }
      }
    }

    // 다음 프레임 예약
    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  // 메트로놈 시작
  start() {
    if (this.isRunning) return;

    this.isRunning = true;

    // 초기 비트 인덱스 계산
    if (this.getPlaybackTime) {
      const currentTime = this.getPlaybackTime();
      if (currentTime >= this.startOffset) {
        const timeSinceStart = currentTime - this.startOffset;
        const beatInterval = 60.0 / this.bpm;
        // 현재 비트 직전으로 설정
        this.lastScheduledBeatIndex = Math.floor(timeSinceStart / beatInterval) - 1;
      } else {
        this.lastScheduledBeatIndex = -1;
      }
    } else {
      this.lastScheduledBeatIndex = -1;
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  // 메트로놈 정지
  stop() {
    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.lastScheduledBeatIndex = -1;

    if (this.onBeat) {
      this.onBeat(-1);
    }
  }

  // 탐색 시 비트 추적 리셋
  seek() {
    this.resetBeatTracking();
  }

  // 정리
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
}: MultiTrackPlayerProps) {
  // 재생 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [tracks, setTracks] = useState<TrackControl[]>([]);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // 메트로놈 상태
  const [bpm, setBpm] = useState(initialBpm || 120);
  const [inputBpm, setInputBpm] = useState(initialBpm || 120);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [metronomeVolume, setMetronomeVolume] = useState(1.0);
  const [startOffsetSeconds, setStartOffsetSeconds] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(-1);

  // 재생 속도 상태
  const [playbackRate, setPlaybackRate] = useState(1.0);

  // 구간 반복 (A-B Loop) 상태
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [isLoopEnabled, setIsLoopEnabled] = useState(false);

  // 북마크 상태
  const [bookmarks, setBookmarks] = useState<number[]>([]);

  const addBookmark = () => {
    // 현재 시간 기준으로 북마크 추가 (소수점 첫째자리까지)
    const time = Math.round(currentTime * 10) / 10;
    if (!bookmarks.includes(time)) {
      setBookmarks((prev) => [...prev, time].sort((a, b) => a - b));
      toast.success(`${formatTime(time)} 북마크가 추가되었습니다.`);
    }
  };

  const removeBookmark = (time: number) => {
    setBookmarks((prev) => prev.filter((t) => t !== time));
  };

  // Refs
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const readyCount = useRef(0);
  const isReadyRef = useRef(false);
  const isPlayingRef = useRef(false);
  const currentTimeRef = useRef(0);

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
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  // Ref 동기화
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // 오디오 컨텍스트 및 메트로놈 엔진 초기화
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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
  }, []);

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

  // 메트로놈에 실제 재생 시간 소스 연결
  useEffect(() => {
    if (!metronomeRef.current) return;

    // 첫 번째 트랙의 WaveSurfer 인스턴스에서 시간 가져오기
    metronomeRef.current.setTimeSource(() => {
      const firstTrack = tracks.find((t) => t.instance);
      if (firstTrack?.instance) {
        return firstTrack.instance.getCurrentTime();
      }
      return currentTimeRef.current;
    });
  }, [tracks]);

  // 메트로놈 재생/일시정지 동기화
  useEffect(() => {
    if (!metronomeRef.current) return;

    if (isPlaying && metronomeEnabled) {
      metronomeRef.current.setVolume(metronomeVolume);
      metronomeRef.current.start();
    } else {
      metronomeRef.current.stop();
      setCurrentBeat(-1);
    }
  }, [isPlaying, metronomeEnabled, metronomeVolume]);

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

  // WaveSurfer 인스턴스 초기화
  useEffect(() => {
    if (tracks.length === 0 || !audioContext) return;

    tracks.forEach((track, index) => {
      if (track.instance) return; // 이미 초기화됨

      const container = containerRefs.current[track.name];
      if (!container) return;

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
      } as any);

      ws.on('ready', () => {
        readyCount.current++;
        // 첫 번째 트랙에서 전체 재생 시간 설정
        if (index === 0) {
          setDuration(ws.getDuration());
        }
        ws.setVolume(track.volume);
      });

      // 첫 번째 트랙에서 시간 업데이트 및 종료 이벤트 처리
      if (index === 0) {
        ws.on('timeupdate', (time) => {
          setCurrentTime(time);
          if (onTimeUpdate) onTimeUpdate(time);

          // 구간 반복 처리
          if (isLoopEnabled && loopStart !== null && loopEnd !== null) {
            if (time >= loopEnd) {
              handleSeek([loopStart]);
            }
          }
        });

        ws.on('finish', () => {
          if (isLoopEnabled && loopStart !== null) {
            handleSeek([loopStart]);
            ws.play();
          } else {
            setIsPlaying(false);
          }
        });
      }

      setTracks((prev) => prev.map((t) => (t.name === track.name ? { ...t, instance: ws } : t)));
    });
  }, [tracks, audioContext]);

  // 모든 트랙 준비 완료 체크
  useEffect(() => {
    if (tracks.length > 0 && readyCount.current >= tracks.length) {
      isReadyRef.current = true;
    }
  }, [tracks]);

  // 마스터 파형 초기화
  useEffect(() => {
    if (!masterContainerRef.current || !audioContext) return;

    // 마스터 URL 사용, 없으면 대체
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
      waveColor: '#52525b', // zinc-600
      progressColor: '#facc15', // yellow-400
      url: masterUrl,
      height: 64,
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
    } as any);

    ws.on('ready', () => {
      ws.setVolume(0); // 마스터 파형은 시각화만, 소리 없음
    });

    masterInstanceRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [stems.master, tracks.length, audioContext]);

  // 마스터 파형 재생 동기화
  useEffect(() => {
    if (!masterInstanceRef.current) return;
    if (isPlaying) {
      masterInstanceRef.current.play();
    } else {
      masterInstanceRef.current.pause();
    }
  }, [isPlaying]);

  // 마스터 파형 탐색 동기화
  useEffect(() => {
    if (!masterInstanceRef.current) return;
    const diff = Math.abs(masterInstanceRef.current.getCurrentTime() - currentTime);
    if (diff > 0.1) {
      masterInstanceRef.current.setTime(currentTime);
    }
  }, [currentTime]);

  // 빨간 마커 드래그 시작
  const handleMarkerMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDraggingStart(true);
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // 빨간 마커 드래그 처리
  useEffect(() => {
    if (!isDraggingStart) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!masterContainerRef.current || !duration) return;
      const rect = masterContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      setStartOffsetSeconds(Number((ratio * duration).toFixed(1)));
    };

    const handleMouseUp = () => {
      setIsDraggingStart(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingStart, duration]);

  // 파형 스크러빙 - 탐색 위치 계산
  const calculateSeekPosition = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!masterContainerRef.current || !duration) return null;
      const rect = masterContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  // 파형 클릭/드래그 시작
  const handleWaveformMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 마커 클릭은 무시
      if ((e.target as HTMLElement).closest('[data-marker]')) return;

      e.preventDefault();
      setIsDraggingWaveform(true);

      const seekTime = calculateSeekPosition(e);
      if (seekTime !== null) {
        handleSeek([seekTime]);
      }
    },
    [calculateSeekPosition],
  );

  // 파형 드래그 처리
  useEffect(() => {
    if (!isDraggingWaveform) return;

    const handleMouseMove = (e: MouseEvent) => {
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

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingWaveform, calculateSeekPosition]);

  // 재생/일시정지 토글
  const togglePlay = useCallback(async () => {
    // 오디오 컨텍스트가 일시중지 상태면 재개 (브라우저 정책)
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    if (isPlaying) {
      tracks.forEach((t) => t.instance?.pause());
    } else {
      tracks.forEach((t) => t.instance?.play());
    }
    setIsPlaying(!isPlaying);
  }, [tracks, isPlaying, audioContext]);

  // 탐색 처리
  const handleSeek = useCallback(
    (value: number[]) => {
      const time = value[0];
      const progress = time / duration;
      tracks.forEach((t) => t.instance?.seekTo(progress));
      setCurrentTime(time);

      // 메트로놈 비트 추적 리셋
      if (metronomeRef.current) {
        metronomeRef.current.seek();
      }
    },
    [duration, tracks],
  );

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
      // 입력창에 있을 때는 무시
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

  // 음소거 토글
  const toggleMute = (trackName: string) => {
    setTracks((prev) => {
      const newTracks = prev.map((t) => {
        if (t.name === trackName) {
          const newMuted = !t.isMuted;
          t.instance?.setVolume(newMuted ? 0 : t.volume);
          return { ...t, isMuted: newMuted };
        }
        return t;
      });
      return newTracks;
    });
  };

  // 솔로 토글
  const toggleSolo = (trackName: string) => {
    setTracks((prev) => {
      const targetTrack = prev.find((t) => t.name === trackName);
      const isSoloing = !targetTrack?.isSolo;

      const newTracks = prev.map((t) => {
        if (t.name === trackName) {
          const newSolo = !t.isSolo;
          if (newSolo) {
            t.instance?.setVolume(t.volume);
          }
          return { ...t, isSolo: newSolo, isMuted: false };
        } else {
          if (isSoloing) {
            t.instance?.setVolume(0);
            return { ...t, isSolo: false };
          } else {
            t.instance?.setVolume(t.volume);
            return { ...t, isSolo: false, isMuted: false };
          }
        }
      });
      return newTracks;
    });
  };

  // 볼륨 조절
  const handleVolume = (trackName: string, val: number[]) => {
    const volume = val[0];
    setTracks((prev) =>
      prev.map((t) => {
        if (t.name === trackName) {
          if (!t.isMuted) {
            t.instance?.setVolume(volume);
          }
          return { ...t, volume };
        }
        return t;
      }),
    );
  };

  // 시간 포맷팅 (분:초)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // TAP BPM 처리
  const handleTap = () => {
    const now = Date.now();
    setTapTimes((prev) => {
      // 2초 내의 탭만 유효
      const newTaps = [...prev, now].filter((t) => now - t < 2000);

      if (newTaps.length > 1) {
        // 탭 간격 계산
        const intervals = [];
        for (let i = 1; i < newTaps.length; i++) {
          intervals.push(newTaps[i] - newTaps[i - 1]);
        }
        // 평균 간격으로 BPM 계산
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const newBpm = Math.round(60000 / avgInterval);

        if (newBpm >= 30 && newBpm <= 300) {
          setInputBpm(newBpm);
        }
      }
      return newTaps;
    });
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

      // 솔로된 트랙이 있는지 확인
      const hasSolo = tracks.some((t) => t.isSolo);

      tracks.forEach((t) => {
        if (hasSolo) {
          // 솔로 모드: 솔로된 트랙만 포함
          volumes[t.name] = t.isSolo ? t.volume : 0;
        } else if (t.isMuted) {
          volumes[t.name] = 0;
        } else {
          volumes[t.name] = t.volume;
        }
      });

      // 메트로놈이 켜져있으면 볼륨 적용
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

  return (
    <div className="space-y-6 select-none">
      {/* 마스터 컨트롤 */}
      <div className="flex items-center gap-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800 sticky top-4 z-20 shadow-xl backdrop-blur-md bg-opacity-90">
        {/* 재생/일시정지 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause className="fill-current w-6 h-6" />
          ) : (
            <Play className="fill-current w-6 h-6 ml-1" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-zinc-500 hover:text-primary"
          onClick={addBookmark}
          title="북마크 추가"
        >
          <Bookmark className="w-5 h-5" />
        </Button>

        <div className="flex-1 space-y-2 relative">
          {/* 마스터 파형 - 클릭/드래그로 탐색 */}
          <div
            ref={masterContainerRef}
            className={cn(
              'w-full h-12 rounded cursor-pointer relative',
              isDraggingWaveform && 'cursor-grabbing',
            )}
            onMouseDown={handleWaveformMouseDown}
          />

          {/* 시작 오프셋 빨간 마커 */}
          {duration > 0 && (
            <div
              data-marker="start-offset"
              className="absolute top-0 bottom-0 w-0 border-l-2 border-red-500 z-10 hover:border-l-4 cursor-ew-resize group"
              style={{ left: `${(startOffsetSeconds / duration) * 100}%` }}
              onMouseDown={handleMarkerMouseDown}
            >
              <div className="absolute -top-3 -left-1.5 transition-transform group-hover:scale-125">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="red"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 21L21 9H3L12 21Z" />
                </svg>
              </div>
            </div>
          )}

          {/* 구간 반복 (A-B) 표시 */}
          {duration > 0 && loopStart !== null && loopEnd !== null && (
            <div
              className={cn(
                'absolute top-0 bottom-0 bg-primary/20 border-x border-primary/50 pointer-events-none z-0',
                !isLoopEnabled && 'opacity-30 grayscale',
              )}
              style={{
                left: `${(loopStart / duration) * 100}%`,
                width: `${((loopEnd - loopStart) / duration) * 100}%`,
              }}
            />
          )}

          {/* 현재 시간 / 전체 시간 */}
          <div className="flex justify-between items-center text-xs text-muted-foreground font-mono mt-1">
            <div className="flex items-center gap-4">
              <span>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              {/* 구간 반복 컨트롤 */}
              <div className="flex items-center gap-2 border-l border-zinc-800 pl-4">
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
                    'px-2 py-0.5 rounded text-[10px] transition-colors border',
                    loopStart !== null && loopEnd === null
                      ? 'bg-orange-500/20 text-orange-500 border-orange-500/50'
                      : loopStart !== null && loopEnd !== null
                        ? 'bg-primary/20 text-primary border-primary/50'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700',
                  )}
                >
                  {loopStart === null ? 'A 설정' : loopEnd === null ? 'B 설정' : '구간 해제'}
                </button>
                {loopStart !== null && loopEnd !== null && (
                  <button
                    onClick={() => setIsLoopEnabled(!isLoopEnabled)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] transition-colors border',
                      isLoopEnabled
                        ? 'bg-green-500/20 text-green-500 border-green-500/50'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700',
                    )}
                  >
                    반복 {isLoopEnabled ? 'ON' : 'OFF'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 메트로놈 컨트롤 */}
        <div
          className={cn(
            'flex flex-col gap-2 w-52 px-3 border-l border-zinc-700/50 transition-opacity',
            !metronomeEnabled && 'opacity-50',
          )}
        >
          {/* 헤더 - ON/OFF 토글 */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400">메트로놈</span>
            <button
              type="button"
              onClick={() => setMetronomeEnabled(!metronomeEnabled)}
              className={cn(
                'px-2 py-0.5 text-[10px] rounded border font-mono transition-colors',
                metronomeEnabled
                  ? 'bg-green-500/20 text-green-500 border-green-500/50'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700',
              )}
            >
              {metronomeEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* 시작 오프셋 */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] uppercase text-zinc-500">시작 (초)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={startOffsetSeconds}
              onChange={(e) => setStartOffsetSeconds(Math.max(0, Number(e.target.value)))}
              className="w-14 h-5 text-[10px] bg-zinc-800 border border-zinc-700 rounded px-1 text-center"
              disabled={!metronomeEnabled}
            />
          </div>

          {/* BPM 컨트롤 */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] uppercase text-zinc-500">BPM</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={inputBpm}
                onChange={(e) => setInputBpm(Number(e.target.value))}
                className="w-12 h-6 text-xs bg-zinc-800 border border-zinc-700 rounded px-1 text-center"
                disabled={!metronomeEnabled}
              />
              <button
                type="button"
                disabled={!metronomeEnabled}
                className={cn(
                  'h-6 px-2 text-[10px] rounded border font-medium transition-colors',
                  metronomeEnabled
                    ? 'bg-zinc-700 text-zinc-200 border-zinc-600 hover:bg-zinc-600'
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed',
                )}
                onClick={() => {
                  if (!metronomeEnabled) return;
                  if (inputBpm < 30 || inputBpm > 300) {
                    toast.error('BPM은 30~300 사이여야 합니다');
                    return;
                  }
                  setBpm(inputBpm);
                  toast.success(`BPM이 ${inputBpm}으로 설정되었습니다`);
                }}
              >
                설정
              </button>
              <button
                type="button"
                disabled={!metronomeEnabled}
                className={cn(
                  'h-6 px-2 text-[10px] rounded border font-medium transition-colors',
                  metronomeEnabled
                    ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 active:bg-primary active:text-primary-foreground'
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed',
                )}
                onClick={() => {
                  if (metronomeEnabled) handleTap();
                }}
              >
                TAP
              </button>
            </div>
          </div>

          {/* 비주얼 비트 인디케이터 (4/4 박자) */}
          <div className="flex justify-center gap-2 py-1 bg-zinc-950/40 rounded-md border border-zinc-800/50">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all duration-75',
                  metronomeEnabled && currentBeat === i
                    ? i === 0
                      ? 'bg-primary shadow-[0_0_8px_theme(colors.primary.DEFAULT)] scale-125'
                      : 'bg-zinc-300 shadow-[0_0_6px_rgba(255,255,255,0.8)] scale-110'
                    : 'bg-zinc-800',
                )}
              />
            ))}
          </div>

          {/* 볼륨 슬라이더 */}
          <div className="flex items-center gap-2">
            <Volume2 size={12} className={metronomeEnabled ? 'text-zinc-500' : 'text-zinc-700'} />
            <Slider
              value={[metronomeVolume]}
              max={1}
              step={0.05}
              onValueChange={(val) => setMetronomeVolume(val[0])}
              className="h-3 flex-1"
              disabled={!metronomeEnabled}
            />
          </div>
        </div>

        {/* 재생 속도 컨트롤 */}
        <div className="flex flex-col gap-1 w-24 px-3 border-l border-zinc-700/50">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">속도</span>
          <Select
            value={playbackRate.toString()}
            onValueChange={(v) => setPlaybackRate(parseFloat(v))}
          >
            <SelectTrigger className="h-7 bg-zinc-800 border-zinc-700 text-[10px] focus:ring-0">
              <SelectValue placeholder="1.0x" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
              <SelectItem value="0.5">0.5x</SelectItem>
              <SelectItem value="0.75">0.75x</SelectItem>
              <SelectItem value="1.0">1.0x</SelectItem>
              <SelectItem value="1.25">1.25x</SelectItem>
              <SelectItem value="1.5">1.5x</SelectItem>
              <SelectItem value="2.0">2.0x</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 북마크 목록 */}
        <div className="flex flex-col gap-1 w-32 px-3 border-l border-zinc-700/50">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            북마크
          </span>
          <div className="flex flex-wrap gap-1 max-h-[40px] overflow-y-auto scrollbar-none">
            {bookmarks.length === 0 ? (
              <span className="text-[10px] text-zinc-600 italic">없음</span>
            ) : (
              bookmarks.map((time) => (
                <div
                  key={time}
                  className="group flex items-center bg-zinc-800 rounded px-1.5 py-0.5 border border-zinc-700 hover:border-primary/50 transition-colors"
                >
                  <button
                    onClick={() => handleSeek([time])}
                    className="text-[10px] font-mono text-zinc-300"
                  >
                    {formatTime(time)}
                  </button>
                  <button
                    onClick={() => removeBookmark(time)}
                    className="ml-1 text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 믹스 다운로드 버튼 */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadMix}
          disabled={isDownloading}
          className="ml-2 gap-2"
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          믹스 다운로드
        </Button>
      </div>

      {/* 개별 트랙 */}
      <div className="grid gap-3">
        {tracks.map((track) => (
          <Card
            key={track.name}
            className={cn(
              'bg-zinc-950/50 border-zinc-800/50 overflow-hidden transition-all',
              track.isSolo && 'border-primary ring-1 ring-primary bg-zinc-900',
              track.isMuted && 'opacity-60 grayscale',
            )}
          >
            <div className="flex items-center p-3 gap-4">
              {/* 트랙 컨트롤 */}
              <div className="w-48 flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between mb-1">
                  {/* 트랙 이름 */}
                  <span
                    className="font-bold uppercase text-xs tracking-wider"
                    style={{ color: TRACK_COLORS[track.name] }}
                  >
                    {track.name}
                  </span>
                  <div className="flex gap-1">
                    {/* 음소거 버튼 */}
                    <button
                      onClick={() => toggleMute(track.name)}
                      className={cn(
                        'px-2 py-0.5 text-[10px] rounded border font-mono transition-colors',
                        track.isMuted
                          ? 'bg-red-500/20 text-red-500 border-red-500/50'
                          : 'border-zinc-700 text-zinc-400 hover:text-zinc-200',
                      )}
                    >
                      M
                    </button>
                    {/* 솔로 버튼 */}
                    <button
                      onClick={() => toggleSolo(track.name)}
                      className={cn(
                        'px-2 py-0.5 text-[10px] rounded border font-mono transition-colors',
                        track.isSolo
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
                      className="px-2 py-0.5 text-[10px] rounded border font-mono transition-colors border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
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
                    value={[track.volume]}
                    max={1}
                    step={0.01}
                    onValueChange={(val) => handleVolume(track.name, val)}
                    className="h-4"
                  />
                </div>
              </div>

              {/* 파형 */}
              <div
                className="flex-1 h-16 rounded-md overflow-hidden relative cursor-crosshair"
                ref={(el) => {
                  containerRefs.current[track.name] = el;
                }}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
