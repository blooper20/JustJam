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

const RECORD_SECONDS = 5;

export function PracticeCalendar({ projectId, teamId }: PracticeCalendarProps) {
  const queryClient = useQueryClient();
  const t = useTranslations('Collab');

  // ── 기존 상태 ──
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [activeVlogUrl, setActiveVlogUrl] = useState<string | null>(null);

  // ── 카메라 촬영 상태 ──
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(RECORD_SECONDS);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setVideoFile(null);
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
      setVideoFile(file);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      toast.error('동영상 파일을 선택하세요.');
      return;
    }
    const formData = new FormData();
    formData.append('file', videoFile);
    uploadVlogMutation.mutate(formData);
  };

  // ── 카메라 촬영 핸들러 ──
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setRecordedBlob(null);
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
    setRecordedBlob(null);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
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
        recorder.stop();
      }
    }, 1000);
  };

  const retake = () => {
    setRecordedBlob(null);
    setCountdown(RECORD_SECONDS);
    // 스트림이 살아있으면 live preview 재연결
    if (liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
    }
  };

  const useRecordedVideo = () => {
    if (!recordedBlob) return;
    const file = new File([recordedBlob], `practice_${Date.now()}.webm`, { type: 'video/webm' });
    setVideoFile(file);
    closeCamera();
    toast.success('촬영된 영상이 선택됐습니다.');
  };

  // 녹화된 영상 URL (모달 내 미리보기용)
  const recordedObjectUrl = recordedBlob ? URL.createObjectURL(recordedBlob) : null;

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

            {/* 선택된 파일 표시 */}
            {videoFile && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-pink-500/10 border border-pink-500/20 text-xs text-pink-300">
                <Video size={12} />
                <span className="flex-1 truncate">{videoFile.name}</span>
                <button
                  type="button"
                  onClick={() => setVideoFile(null)}
                  className="hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="flex gap-2">
              {/* 파일 업로드 버튼 */}
              <label className="flex-1 flex items-center justify-center border border-dashed border-zinc-700 rounded-lg h-9 bg-zinc-900/30 hover:bg-zinc-800/50 cursor-pointer transition-colors text-zinc-400 text-xs gap-1.5">
                <Upload size={12} />
                파일 업로드
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
                카메라 촬영
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
                <Button
                  onClick={startRecording}
                  disabled={isRecording}
                  className="gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 h-11 rounded-xl disabled:opacity-50"
                >
                  {isRecording ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      녹화 중... ({countdown}s)
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 rounded-full bg-white" />
                      촬영 시작
                    </>
                  )}
                </Button>
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
