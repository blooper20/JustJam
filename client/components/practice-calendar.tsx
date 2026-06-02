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
  Trash2,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import apiClient, { API_BASE_URL } from '@/lib/api-client';
import { UserResponse } from './collaboration-board';
import { useSession } from 'next-auth/react';

interface PracticeCalendarProps {
  projectId: string;
  teamId: number;
}

export interface PracticeLogResponse {
  id: number;
  project_id: string;
  user_id: number;
  video_url: string;
  raw_video_url?: string;
  start_time?: number;
  overlay_text?: string;
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

async function extractVideoThumbnails(videoUrl: string, count: number): Promise<string[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve([]);
      return;
    }
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const timeoutId = setTimeout(() => {
      video.src = '';
      resolve([]);
    }, 15000); // 15 seconds timeout

    video.addEventListener('loadedmetadata', async () => {
      try {
        const duration = video.duration;
        const thumbnails: string[] = [];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          clearTimeout(timeoutId);
          resolve([]);
          return;
        }

        canvas.width = 120;
        canvas.height = 68;

        const interval = duration / (count + 1);

        for (let i = 1; i <= count; i++) {
          const time = i * interval;
          await new Promise<void>((r) => {
            video.currentTime = time;
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                thumbnails.push(canvas.toDataURL('image/jpeg', 0.6));
              } catch (e) {
                console.error('Frame capture error:', e);
              }
              r();
            };
            video.addEventListener('seeked', onSeeked);
          });
        }

        clearTimeout(timeoutId);
        video.src = '';
        resolve(thumbnails);
      } catch (err) {
        console.error('Metadata load callback error:', err);
        clearTimeout(timeoutId);
        video.src = '';
        resolve([]);
      }
    });

    video.addEventListener('error', () => {
      clearTimeout(timeoutId);
      video.src = '';
      resolve([]);
    });
  });
}

export function PracticeCalendar({ projectId, teamId }: PracticeCalendarProps) {
  const queryClient = useQueryClient();
  const t = useTranslations('Collab');
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  // ── 기존 상태 ──
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [activeVlogUrl, setActiveVlogUrl] = useState<string | null>(null);

  // ── 크롭 및 중앙 텍스트 상태 ──
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [previewCurrentTime, setPreviewCurrentTime] = useState<number>(0);
  const [overlayText, setOverlayText] = useState('');
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // ── 비디오 수정 상태 ──
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<PracticeLogResponse | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editStartTime, setEditStartTime] = useState<number>(0);
  const [editOverlayText, setEditOverlayText] = useState('');
  const [editVideoDuration, setEditVideoDuration] = useState<number | null>(null);
  const [editPreviewCurrentTime, setEditPreviewCurrentTime] = useState<number>(0);
  const editVideoRef = useRef<HTMLVideoElement>(null);

  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [editThumbnails, setEditThumbnails] = useState<string[]>([]);

  useEffect(() => {
    if (previewObjectUrl) {
      extractVideoThumbnails(previewObjectUrl, 10).then((imgs) => {
        setThumbnails(imgs);
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThumbnails([]);
    }
  }, [previewObjectUrl]);

  useEffect(() => {
    if (editingLog) {
      const srcUrl = `${API_BASE_URL.replace('/api/v1', '')}${
        editingLog.raw_video_url || editingLog.video_url
      }`;
      extractVideoThumbnails(srcUrl, 10).then((imgs) => {
        setEditThumbnails(imgs);
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditThumbnails([]);
    }
  }, [editingLog]);

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
    setStartTime(0);
    setPreviewCurrentTime(0);

    if (!file) {
      setVideoDuration(null);
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

  // 3. Delete Mutation
  const deleteVlogMutation = useMutation({
    mutationFn: async (logId: number) => {
      const res = await apiClient.delete(`/projects/${projectId}/practice-logs/${logId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice-logs', projectId] });
      toast.success('연습 인증 영상이 삭제되었습니다.');
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || '인증 영상 삭제에 실패했습니다.');
    },
  });

  // 4. Update Vlog Mutation
  const updateVlogMutation = useMutation({
    mutationFn: async ({
      logId,
      description,
      startTime,
      overlayText,
    }: {
      logId: number;
      description: string;
      startTime: number;
      overlayText: string;
    }) => {
      const formData = new FormData();
      formData.append('description', description);
      formData.append('start_time', startTime.toString());
      if (overlayText.trim()) {
        formData.append('overlay_text', overlayText.trim());
      }
      const res = await apiClient.put(`/projects/${projectId}/practice-logs/${logId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice-logs', projectId] });
      setIsEditModalOpen(false);
      setEditingLog(null);
      toast.success('연습 인증 영상이 성공적으로 수정되었습니다!');
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || '인증 영상 수정에 실패했습니다.');
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const videoFullUrl = `${API_BASE_URL.replace('/api/v1', '')}${log.video_url}`;
                        setActiveVlogUrl(videoFullUrl);
                      }}
                      className="gap-1 text-pink-400 hover:text-pink-300"
                    >
                      <Play size={10} className="fill-current" /> 재생
                    </Button>
                    {log.user_id === currentUserId && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingLog(log);
                            setEditDescription(log.description || '');
                            setEditStartTime(log.start_time || 0);
                            setEditOverlayText(log.overlay_text || '');
                            setEditPreviewCurrentTime(log.start_time || 0);
                            setEditVideoDuration(null);
                            setIsEditModalOpen(true);
                          }}
                          className="text-zinc-500 hover:text-pink-500 h-8 w-8 p-0"
                        >
                          <Edit2 size={12} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deleteVlogMutation.isPending}
                          onClick={() => {
                            if (confirm('이 연습 영상을 삭제하시겠습니까?')) {
                              deleteVlogMutation.mutate(log.id);
                            }
                          }}
                          className="text-zinc-500 hover:text-red-500 h-8 w-8 p-0"
                        >
                          {deleteVlogMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
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
                      onTimeUpdate={() => {
                        if (previewVideoRef.current) {
                          setPreviewCurrentTime(previewVideoRef.current.currentTime);
                        }
                      }}
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

                {/* 비주얼 타임라인 범위 표시기 및 시작 구간 선택 슬라이더 (합쳐진 버전) */}
                {videoDuration && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-zinc-400">
                      <span>저장 구간 설정 (5초 고정)</span>
                      <span className="text-pink-400 font-mono">
                        {videoDuration > 5
                          ? `${startTime.toFixed(1)}s ~ ${(startTime + 5 > videoDuration ? videoDuration : startTime + 5).toFixed(1)}s`
                          : '전체 구간 저장'}
                      </span>
                    </div>

                    {videoDuration > 5 ? (
                      <div className="space-y-1">
                        <div
                          className="relative w-full h-14 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex items-center cursor-pointer select-none"
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const percentage = clickX / rect.width;
                            const clickedTime = percentage * videoDuration;

                            let newStart = clickedTime - 2.5;
                            if (newStart < 0) newStart = 0;
                            if (newStart > videoDuration - 5) newStart = videoDuration - 5;

                            setStartTime(newStart);
                            setPreviewCurrentTime(newStart);
                            if (previewVideoRef.current) {
                              previewVideoRef.current.currentTime = newStart;
                            }
                          }}
                        >
                          {/* Filmstrip Thumbnails Backdrop */}
                          <div className="absolute inset-0 grid grid-cols-10 gap-0.5 pointer-events-none opacity-50 z-0">
                            {thumbnails.length > 0 ? (
                              thumbnails.map((img, idx) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={idx}
                                  src={img}
                                  alt={`frame-${idx}`}
                                  className="w-full h-full object-cover"
                                />
                              ))
                            ) : (
                              <div className="col-span-10 w-full h-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 animate-pulse" />
                            )}
                          </div>

                          {/* 5초 선택 영역 하이라이트 (iPhone Trimmer 스타일 노란색 박스) */}
                          <div
                            className="absolute h-full border-2 border-yellow-400 bg-yellow-400/10 pointer-events-none rounded-md z-10 transition-all duration-75"
                            style={{
                              left: `${(startTime / videoDuration) * 100}%`,
                              width: `${(5 / videoDuration) * 100}%`,
                            }}
                          >
                            {/* Left/Right handles */}
                            <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-yellow-400 flex items-center justify-center">
                              <div className="w-0.5 h-3.5 bg-zinc-950 rounded-full" />
                            </div>
                            <div className="absolute top-0 bottom-0 right-0 w-1.5 bg-yellow-400 flex items-center justify-center">
                              <div className="w-0.5 h-3.5 bg-zinc-950 rounded-full" />
                            </div>
                          </div>

                          {/* 재생 헤드 (현재 재생 위치) */}
                          {previewCurrentTime !== undefined && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-white z-15 pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                              style={{
                                left: `${(previewCurrentTime / videoDuration) * 100}%`,
                              }}
                            >
                              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
                            </div>
                          )}

                          {/* 슬라이더 인풋 (드래그 조작용, 전체 너비) */}
                          <input
                            type="range"
                            min={0}
                            max={videoDuration - 5}
                            step={0.05}
                            value={startTime}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setStartTime(val);
                              setPreviewCurrentTime(val);
                              if (previewVideoRef.current) {
                                previewVideoRef.current.currentTime = val;
                              }
                            }}
                            onClick={(e) => e.stopPropagation()} // 컨테이너 클릭 이벤트 버블링 방지
                            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                          />

                          {/* 좌우 시간 텍스트 오버레이 */}
                          <div className="absolute bottom-1 inset-x-2 flex justify-between items-center pointer-events-none text-[8px] text-zinc-300 font-mono font-bold select-none z-10 bg-black/40 px-1 rounded">
                            <span>0.0s</span>
                            <span>{videoDuration.toFixed(1)}s</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-500 italic">
                        5초 이하의 영상은 전체 구간이 저장됩니다.
                      </p>
                    )}
                  </div>
                )}

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

      {/* ── 연습 영상 수정 모달 ── */}
      {isEditModalOpen && editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <Edit2 size={16} className="text-pink-500" />
                <span className="text-sm font-bold text-zinc-100">연습 인증 수정</span>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingLog(null);
                }}
                className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">연습 코멘트 수정</label>
                <Input
                  placeholder="연습 코멘트 입력..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-zinc-200 h-9 text-xs focus-visible:ring-pink-500/50"
                />
              </div>

              {/* 비디오 미리보기 */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-zinc-800">
                <video
                  ref={editVideoRef}
                  src={`${API_BASE_URL.replace('/api/v1', '')}${editingLog.raw_video_url || editingLog.video_url}`}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                  onLoadedMetadata={(e) => setEditVideoDuration(e.currentTarget.duration)}
                  onTimeUpdate={() => {
                    if (editVideoRef.current) {
                      setEditPreviewCurrentTime(editVideoRef.current.currentTime);
                    }
                  }}
                />
                {/* 실시간 텍스트 오버레이 미리보기 */}
                {editOverlayText && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="bg-black/60 text-white px-3.5 py-1.5 rounded-lg text-sm md:text-base font-bold border border-white/20 shadow-2xl text-center max-w-[80%] break-all backdrop-blur-sm">
                      {editOverlayText}
                    </span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] text-zinc-300 font-mono pointer-events-none">
                  수정 미리보기
                </div>
              </div>

              {/* 크롭 타임라인 */}
              {editVideoDuration && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-zinc-400">
                    <span>저장 구간 재설정 (5초 고정)</span>
                    <span className="text-pink-400 font-mono">
                      {editVideoDuration > 5
                        ? `${editStartTime.toFixed(1)}s ~ ${(editStartTime + 5 > editVideoDuration ? editVideoDuration : editStartTime + 5).toFixed(1)}s`
                        : '전체 구간 저장'}
                    </span>
                  </div>

                  {editVideoDuration > 5 ? (
                    <div className="space-y-1">
                      <div
                        className="relative w-full h-14 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex items-center cursor-pointer select-none"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickX = e.clientX - rect.left;
                          const percentage = clickX / rect.width;
                          const clickedTime = percentage * editVideoDuration;

                          let newStart = clickedTime - 2.5;
                          if (newStart < 0) newStart = 0;
                          if (newStart > editVideoDuration - 5) newStart = editVideoDuration - 5;

                          setEditStartTime(newStart);
                          setEditPreviewCurrentTime(newStart);
                          if (editVideoRef.current) {
                            editVideoRef.current.currentTime = newStart;
                          }
                        }}
                      >
                        {/* Filmstrip Thumbnails Backdrop */}
                        <div className="absolute inset-0 grid grid-cols-10 gap-0.5 pointer-events-none opacity-50 z-0">
                          {editThumbnails.length > 0 ? (
                            editThumbnails.map((img, idx) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={idx}
                                src={img}
                                alt={`frame-${idx}`}
                                className="w-full h-full object-cover"
                              />
                            ))
                          ) : (
                            <div className="col-span-10 w-full h-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 animate-pulse" />
                          )}
                        </div>

                        {/* 5초 선택 영역 하이라이트 (iPhone Trimmer 스타일 노란색 박스) */}
                        <div
                          className="absolute h-full border-2 border-yellow-400 bg-yellow-400/10 pointer-events-none rounded-md z-10 transition-all duration-75"
                          style={{
                            left: `${(editStartTime / editVideoDuration) * 100}%`,
                            width: `${(5 / editVideoDuration) * 100}%`,
                          }}
                        >
                          {/* Left/Right handles */}
                          <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-yellow-400 flex items-center justify-center">
                            <div className="w-0.5 h-3.5 bg-zinc-950 rounded-full" />
                          </div>
                          <div className="absolute top-0 bottom-0 right-0 w-1.5 bg-yellow-400 flex items-center justify-center">
                            <div className="w-0.5 h-3.5 bg-zinc-950 rounded-full" />
                          </div>
                        </div>

                        {/* 재생 헤드 */}
                        {editPreviewCurrentTime !== undefined && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white z-15 pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                            style={{
                              left: `${(editPreviewCurrentTime / editVideoDuration) * 100}%`,
                            }}
                          >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
                          </div>
                        )}

                        {/* 슬라이더 인풋 */}
                        <input
                          type="range"
                          min={0}
                          max={editVideoDuration - 5}
                          step={0.05}
                          value={editStartTime}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setEditStartTime(val);
                            setEditPreviewCurrentTime(val);
                            if (editVideoRef.current) {
                              editVideoRef.current.currentTime = val;
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                        />

                        {/* 좌우 시간 오버레이 */}
                        <div className="absolute bottom-1 inset-x-2 flex justify-between items-center pointer-events-none text-[8px] text-zinc-300 font-mono font-bold select-none z-10 bg-black/40 px-1 rounded">
                          <span>0.0s</span>
                          <span>{editVideoDuration.toFixed(1)}s</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-500 italic">
                      5초 이하의 영상은 전체 구간이 저장됩니다.
                    </p>
                  )}
                </div>
              )}

              {/* 중앙 텍스트 입력 */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400">
                  화면 중앙 텍스트 오버레이 수정 (최대 20자)
                </label>
                <Input
                  placeholder="영상 중앙에 표시할 짧은 문구 입력..."
                  value={editOverlayText}
                  onChange={(e) => setEditOverlayText(e.target.value)}
                  maxLength={20}
                  className="bg-zinc-950 border-zinc-850 text-zinc-200 h-8 text-xs focus-visible:ring-pink-500/50"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-5 py-4 flex items-center justify-end gap-2 border-t border-zinc-850 bg-zinc-900/10 shrink-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingLog(null);
                }}
                className="text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs h-9"
              >
                취소
              </Button>
              <Button
                type="button"
                disabled={updateVlogMutation.isPending}
                onClick={() => {
                  if (editOverlayText.trim().length > 20) {
                    toast.error('오버레이 텍스트는 최대 20자까지만 입력 가능합니다.');
                    return;
                  }
                  updateVlogMutation.mutate({
                    logId: editingLog.id,
                    description: editDescription,
                    startTime: editStartTime,
                    overlayText: editOverlayText,
                  });
                }}
                className="bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs h-9 px-4"
              >
                {updateVlogMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  '변경사항 저장'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
