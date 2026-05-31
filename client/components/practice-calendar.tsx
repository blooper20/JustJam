'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  Calendar as CalendarIcon,
  Upload,
  Play,
  X,
  Camera,
  Video,
  RotateCcw,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import apiClient, { API_BASE_URL } from '@/lib/api-client';
import { UserResponse } from './collaboration-board';

interface PracticeCalendarProps {
  projectId: string;
  teamId: number;
}

export interface PracticeLogResponse {
  id: number;
  project_id: string;
  user_id: number;
  video_url: string;
  description?: string;
  logged_date: string;
  created_at: string;
  user: UserResponse;
}

import { TeamMember } from '@/lib/api';
import { Mic2, Guitar, Music, Drum, Keyboard } from 'lucide-react';

const INSTRUMENTS = [
  { id: 'vocal', icon: Mic2 },
  { id: 'guitar', icon: Guitar },
  { id: 'bass', icon: Music },
  { id: 'drum', icon: Drum },
  { id: 'keyboard', icon: Keyboard },
  { id: 'other', icon: Music },
];

const RECORD_SECONDS = 15;

function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

export function PracticeCalendar({ projectId, teamId }: PracticeCalendarProps) {
  const queryClient = useQueryClient();
  const t = useTranslations('Collab');

  // ── 기존 상태 ──
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [activeVlogUrl, setActiveVlogUrl] = useState<string | null>(null);

  // ── 크롭 및 중앙 텍스트 상태 ──
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [overlayText, setOverlayText] = useState('');
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // ── 카메라 촬영 상태 ──
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(RECORD_SECONDS);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedObjectUrl, setRecordedObjectUrl] = useState<string | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 비디오 파일 설정 및 관리 헬퍼 (useEffect setState 방지)
  const updateVideoFile = (file: File | null) => {
    // 기존 미리보기 URL 해제
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      setPreviewObjectUrl(null);
    }

    setVideoFile(file);

    if (!file) {
      setVideoDuration(null);
      setStartTime(0);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewObjectUrl(url);

    // 재생 시간 추출
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      setVideoDuration(video.duration);
    };
    video.src = url;
  };

  // 녹화된 Blob 설정 및 관리 헬퍼 (useEffect setState 방지)
  const updateRecordedBlob = (blob: Blob | null) => {
    if (recordedObjectUrl) {
      URL.revokeObjectURL(recordedObjectUrl);
      setRecordedObjectUrl(null);
    }
    setRecordedBlob(blob);
    if (blob) {
      setRecordedObjectUrl(URL.createObjectURL(blob));
    }
  };

  // 언마운트 시 URL 해제
  useEffect(() => {
    return () => {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      if (recordedObjectUrl) URL.revokeObjectURL(recordedObjectUrl);
    };
  }, [previewObjectUrl, recordedObjectUrl]);

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setStartTime(val);
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = val;
    }
  };

  // 카메라 모달이 열리면 스트림을 video 요소에 연결
  useEffect(() => {
    if (isCameraOpen && !recordedBlob && liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraOpen, recordedBlob]);

  // 언마운트 시 스트림 정리
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // 1. Fetch Practice Logs
  const { data: logs, isLoading } = useQuery<PracticeLogResponse[]>({
    queryKey: ['practice-logs', projectId],
    queryFn: async () => {
      const res = await apiClient.get(`/projects/${projectId}/practice-logs`);
      return res.data;
    },
    enabled: !!projectId,
  });

  // Fetch Team Members
  const { data: members } = useQuery<TeamMember[]>({
    queryKey: ['team-members', teamId],
    queryFn: async () => {
      const res = await apiClient.get(`/teams/${teamId}/members`);
      return res.data;
    },
    enabled: !!teamId,
  });

  const getInstrumentIcon = (userId: number) => {
    const member = members?.find((m) => m.user_id === userId);
    const instrumentId = member?.instrument || 'other';
    const Icon = INSTRUMENTS.find((i) => i.id === instrumentId)?.icon || Music;
    return Icon;
  };

  // 2. Upload Mutation
  const uploadVlogMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiClient.post(
        `/projects/${projectId}/practice-logs?logged_date=${selectedDate}&description=${encodeURIComponent(description)}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice-logs', projectId] });
      setDescription('');
      setOverlayText('');
      setStartTime(0);
      updateVideoFile(null);
      toast.success('연습 인증 영상이 성공적으로 업로드되었습니다!');
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || '인증 영상 업로드에 실패했습니다.');
    },
  });

  // ── 파일 선택 핸들러 ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('video/')) {
        toast.error('동영상 파일만 선택할 수 있습니다.');
        return;
      }
      updateVideoFile(file);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      toast.error('동영상 파일을 선택하세요.');
      return;
    }
    if (overlayText.trim().length > 20) {
      toast.error('오버레이 텍스트는 최대 20자까지만 입력 가능합니다.');
      return;
    }
    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('start_time', startTime.toString());
    if (overlayText.trim()) {
      formData.append('overlay_text', overlayText.trim());
    }
    uploadVlogMutation.mutate(formData);
  };

  // ── 카메라 촬영 핸들러 ──
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      updateRecordedBlob(null);
      setIsRecording(false);
      setCountdown(RECORD_SECONDS);
      setIsCameraOpen(true);
    } catch {
      toast.error('카메라 접근 권한이 필요합니다.');
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setIsCameraOpen(false);
    setIsRecording(false);
    setCountdown(RECORD_SECONDS);
    updateRecordedBlob(null);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      mediaRecorderRef.current.stop();
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    const mimeType = getSupportedMimeType();
    const options = mimeType ? { mimeType } : undefined;
    const recorder = new MediaRecorder(streamRef.current, options);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
      updateRecordedBlob(blob);
      setIsRecording(false);
    };

    recorder.start();
    setIsRecording(true);
    setCountdown(RECORD_SECONDS);

    let remaining = RECORD_SECONDS;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current!);
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }
    }, 1000);
  };

  const retake = () => {
    updateRecordedBlob(null);
    setCountdown(RECORD_SECONDS);
    // 스트림이 살아있으면 live preview 재연결
    if (liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
    }
  };

  const useRecordedVideo = () => {
    if (!recordedBlob) return;
    const mimeType = getSupportedMimeType();
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([recordedBlob], `practice_${Date.now()}.${extension}`, {
      type: recordedBlob.type,
    });
    updateVideoFile(file);
    closeCamera();
    toast.success('촬영된 영상이 선택됐습니다.');
  };

  // ── 달력 데이터 ──
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const daysGrid: (Date | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) daysGrid.push(null);
  for (let d = 1; d <= totalDays; d++) daysGrid.push(new Date(year, month, d));

  const getLogsForDate = (dateStr: string) =>
    logs?.filter((log) => log.logged_date === dateStr) || [];

  return (
    <div className="space-y-6">
      {/* Practice Calendar Grid */}
      <Card className="bg-zinc-950/40 border-zinc-800/80 shadow-lg backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-bold text-zinc-100 flex items-center gap-2">
            <CalendarIcon size={16} className="text-pink-500" /> {t('calendar')}
          </CardTitle>
          <CardDescription>
            {year}년 {month + 1}월
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-zinc-500 mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {daysGrid.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="h-10 bg-transparent" />;
              const dateStr = day.toISOString().split('T')[0];
              const dateLogs = getLogsForDate(dateStr);
              const isSelected = dateStr === selectedDate;
              const hasLogs = dateLogs.length > 0;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  className={`h-10 rounded-lg flex flex-col items-center justify-center relative transition-all text-xs font-semibold ${
                    isSelected
                      ? 'bg-pink-600 text-white font-bold'
                      : hasLogs
                        ? 'bg-zinc-900 border border-pink-500/40 text-pink-300'
                        : 'bg-zinc-900/40 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  <span>{day.getDate()}</span>
                  {hasLogs && (
                    <div className="absolute bottom-0.5 flex gap-0.5 justify-center w-full">
                      {Array.from(new Set(dateLogs.map((l) => l.user_id)))
                        .slice(0, 3)
                        .map((userId) => {
                          const Icon = getInstrumentIcon(userId);
                          return <Icon key={userId} className="w-2.5 h-2.5 text-pink-500" />;
                        })}
                      {new Set(dateLogs.map((l) => l.user_id)).size > 3 && (
                        <span className="w-2.5 h-2.5 flex items-center justify-center text-[8px] text-pink-500 font-bold">
                          +
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Logs Panel */}
      <Card className="bg-zinc-950/40 border-zinc-800/80 shadow-lg backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-zinc-200">
            {selectedDate} {t('vlogTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
            </div>
          ) : getLogsForDate(selectedDate).length === 0 ? (
            <p className="text-xs text-zinc-500">{t('noLogs')}</p>
          ) : (
            <div className="space-y-3">
              {getLogsForDate(selectedDate).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-850"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-bold text-zinc-300 truncate">{log.user.nickname}</p>
                    <p className="text-[10px] text-zinc-400 truncate">
                      {log.description || '연습 완료'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const videoFullUrl = `${API_BASE_URL.replace('/api/v1', '')}${log.video_url}`;
                      setActiveVlogUrl(videoFullUrl);
                    }}
                    className="shrink-0 gap-1 text-pink-400 hover:text-pink-300"
                  >
                    <Play size={10} className="fill-current" /> 재생
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Form */}
          <form
            onSubmit={handleUploadSubmit}
            className="pt-3 border-t border-zinc-800/80 space-y-3"
          >
            <p className="text-xs font-bold text-zinc-300">{t('uploadVlog')}</p>
            <Input
              placeholder="연습 코멘트 입력..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-zinc-200 h-8 text-xs"
            />

            {/* 선택된 파일 표시 및 편집 오버레이 */}
            {videoFile && (
              <div className="space-y-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md shadow-inner">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <Video size={14} className="text-pink-500 animate-pulse" />
                    <span className="font-semibold truncate max-w-[200px]">{videoFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      updateVideoFile(null);
                      setOverlayText('');
                      setStartTime(0);
                    }}
                    className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* 미리보기 동영상 플레이어 */}
                {previewObjectUrl && (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-zinc-800">
                    <video
                      ref={previewVideoRef}
                      src={previewObjectUrl}
                      className="w-full h-full object-contain"
                      controls
                      playsInline
                    />
                    {/* 실시간 텍스트 오버레이 미리보기 */}
                    {overlayText && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="bg-black/60 text-white px-3.5 py-1.5 rounded-lg text-sm md:text-base font-bold border border-white/20 shadow-2xl text-center max-w-[80%] break-all backdrop-blur-sm">
                          {overlayText}
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] text-zinc-300 font-mono pointer-events-none">
                      미리보기
                    </div>
                  </div>
                )}

                {/* 비주얼 타임라인 범위 표시기 */}
                {videoDuration && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 font-semibold">
                      저장 범위 (5초 구간)
                    </div>
                    <div className="relative w-full h-4 bg-zinc-950 border border-zinc-800/80 rounded-md overflow-hidden flex items-center">
                      <div
                        className="absolute h-full bg-pink-500/25 border-l border-r border-pink-500 transition-all duration-75"
                        style={{
                          left: `${(startTime / videoDuration) * 100}%`,
                          width: `${(5 / videoDuration) * 100}%`,
                        }}
                      />
                      <div className="absolute inset-0 flex justify-between px-2 items-center pointer-events-none text-[8px] text-zinc-500 font-mono font-bold">
                        <span>0.0s</span>
                        <span>{videoDuration.toFixed(1)}s</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 시작 구간 선택 슬라이더 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-zinc-400">
                    <span>저장 구간 설정 (5초 고정)</span>
                    <span className="text-pink-400 font-mono">
                      {videoDuration
                        ? `${startTime.toFixed(1)}s ~ ${(startTime + 5 > videoDuration ? videoDuration : startTime + 5).toFixed(1)}s`
                        : '길이 계산 중...'}
                    </span>
                  </div>
                  {videoDuration && videoDuration > 5 ? (
                    <div className="space-y-1">
                      <input
                        type="range"
                        min={0}
                        max={videoDuration - 5}
                        step={0.1}
                        value={startTime}
                        onChange={handleStartTimeChange}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                      />
                      <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                        <span>0.0s</span>
                        <span>{(videoDuration - 5).toFixed(1)}s</span>
                      </div>
                    </div>
                  ) : videoDuration ? (
                    <p className="text-[10px] text-zinc-500 italic">
                      5초 이하의 영상은 전체 구간이 저장됩니다.
                    </p>
                  ) : (
                    <div className="h-1 bg-zinc-800 rounded animate-pulse" />
                  )}
                </div>

                {/* 중앙 텍스트 입력 상자 */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400">
                    화면 중앙 텍스트 오버레이 (최대 20자)
                  </label>
                  <Input
                    placeholder="영상 중앙에 표시할 짧은 문구 입력..."
                    value={overlayText}
                    onChange={(e) => setOverlayText(e.target.value)}
                    maxLength={20}
                    className="bg-zinc-950 border-zinc-850 text-zinc-200 h-8 text-xs focus-visible:ring-pink-500/50"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {/* 파일 업로드 버튼 */}
              <label className="flex-1 flex items-center justify-center border border-dashed border-zinc-700 rounded-lg h-9 bg-zinc-900/30 hover:bg-zinc-800/50 cursor-pointer transition-colors text-zinc-400 text-xs gap-1.5">
                <Upload size={12} />
                보관함에서 선택
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {/* 카메라 촬영 버튼 */}
              <button
                type="button"
                onClick={openCamera}
                className="flex-1 flex items-center justify-center border border-dashed border-purple-700/50 rounded-lg h-9 bg-purple-900/10 hover:bg-purple-900/20 cursor-pointer transition-colors text-purple-400 text-xs gap-1.5"
              >
                <Camera size={12} />
                직접 촬영하기
              </button>

              {/* 제출 버튼 */}
              <Button
                type="submit"
                size="sm"
                disabled={uploadVlogMutation.isPending || !videoFile}
                className="h-9 px-4 bg-pink-600 hover:bg-pink-700 text-white font-medium"
              >
                {uploadVlogMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  '제출'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── 카메라 촬영 모달 ── */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-purple-400" />
                <span className="text-sm font-bold text-zinc-100">카메라 촬영</span>
                <span className="text-[10px] text-zinc-500">{RECORD_SECONDS}초 자동 녹화</span>
              </div>
              <button
                onClick={closeCamera}
                className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Video Area */}
            <div className="relative aspect-video bg-black">
              {!recordedBlob ? (
                /* Live preview */
                <>
                  <video
                    key="live-webcam"
                    ref={liveVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {/* 녹화 중 카운트다운 오버레이 */}
                  {isRecording && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="relative">
                        <span className="text-8xl font-black text-white drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
                          {countdown}
                        </span>
                      </div>
                      {/* 녹화 표시 */}
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-600/90 px-2.5 py-1 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span className="text-[10px] font-bold text-white">REC</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* 녹화 완료 — 미리보기 */
                <video
                  key="recorded-preview"
                  src={recordedObjectUrl ?? undefined}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Controls */}
            <div className="px-5 py-4 flex items-center justify-center gap-3">
              {!recordedBlob ? (
                isRecording ? (
                  <Button
                    onClick={stopRecording}
                    className="gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 h-11 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse"
                  >
                    <div className="w-3 h-3 bg-white rounded-sm" />
                    녹화 중지 ({countdown}초 남음)
                  </Button>
                ) : (
                  <Button
                    onClick={startRecording}
                    className="gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 h-11 rounded-xl"
                  >
                    <Camera size={14} />
                    촬영 시작 (최대 {RECORD_SECONDS}초)
                  </Button>
                )
              ) : (
                <>
                  <Button
                    onClick={retake}
                    variant="ghost"
                    className="gap-2 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 h-10 px-5 rounded-xl"
                  >
                    <RotateCcw size={14} /> 다시 찍기
                  </Button>
                  <Button
                    onClick={useRecordedVideo}
                    className="gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold h-10 px-6 rounded-xl"
                  >
                    <Check size={14} /> 이 영상 사용
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 영상 재생 모달 ── */}
      {activeVlogUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg aspect-video rounded-xl overflow-hidden bg-black border border-zinc-800 shadow-2xl">
            <button
              onClick={() => setActiveVlogUrl(null)}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
            <video src={activeVlogUrl} controls autoPlay className="w-full h-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
