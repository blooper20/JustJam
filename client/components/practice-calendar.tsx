'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Calendar as CalendarIcon, Upload, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api-client';
import { UserResponse } from './collaboration-board';

interface PracticeCalendarProps {
  projectId: string;
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

export function PracticeCalendar({ projectId }: PracticeCalendarProps) {
  const queryClient = useQueryClient();
  const t = useTranslations('Collab');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [activeVlogUrl, setActiveVlogUrl] = useState<string | null>(null);

  // 1. Fetch Practice Logs
  const { data: logs, isLoading } = useQuery<PracticeLogResponse[]>({
    queryKey: ['practice-logs', projectId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/practice-logs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch practice logs');
      return res.json();
    },
  });

  // 2. Upload Vlog Mutation
  const uploadVlogMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/projects/${projectId}/practice-logs?logged_date=${selectedDate}&description=${encodeURIComponent(
          description,
        )}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );
      if (!res.ok) throw new Error('Vlog upload failed');
      return res.json();
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

  // Generate simple Calendar dates grid for current month
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const daysGrid: (Date | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    daysGrid.push(new Date(year, month, d));
  }

  // Helper to check logs for a specific day
  const getLogsForDate = (dateStr: string) => {
    return logs?.filter((log) => log.logged_date === dateStr) || [];
  };

  return (
    <div className="space-y-6">
      {/* Practice Calendar Grid Card */}
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
            <div>일</div>
            <div>월</div>
            <div>화</div>
            <div>수</div>
            <div>목</div>
            <div>금</div>
            <div>토</div>
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
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-pink-500 animate-pulse" />
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
          {/* Logs List */}
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

          {/* Upload Vlog Form */}
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
            <div className="flex gap-2 items-center">
              <label className="flex-1 flex items-center justify-center border border-dashed border-zinc-800 rounded-lg h-9 bg-zinc-900/30 hover:bg-zinc-850 cursor-pointer transition-colors text-zinc-400 text-xs">
                <Upload size={12} className="mr-1.5" />
                {videoFile ? videoFile.name.substring(0, 15) + '...' : '영상 업로드'}
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <Button
                type="submit"
                size="sm"
                disabled={uploadVlogMutation.isPending || !videoFile}
                className="h-9 px-3 bg-pink-600 hover:bg-pink-700 text-white font-medium"
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

      {/* Floating Video Modal Preview */}
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
