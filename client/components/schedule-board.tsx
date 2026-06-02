'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Loader2, Trash2, Send, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useTeam } from '@/components/team-provider';
import type {
  CollaborationPostResponse,
  PostScheduleTimeResponse,
  UserResponse,
} from '@/components/collaboration-board';

// ─── Mini Calendar (date picker for creating schedule) ───────────────────────
function MiniCalendar({
  selectedDates,
  onToggle,
}: {
  selectedDates: string[];
  onToggle: (date: string) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const toDateStr = (d: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const monthNames = [
    '1월',
    '2월',
    '3월',
    '4월',
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
    '11월',
    '12월',
  ];
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  };

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 select-none">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-zinc-200">
          {viewYear}년 {monthNames[viewMonth]}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {dayLabels.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[10px] font-bold pb-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-400' : 'text-zinc-500'}`}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const dateStr = toDateStr(day);
          const isSelected = selectedDates.includes(dateStr);
          const isToday =
            day === today.getDate() &&
            viewMonth === today.getMonth() &&
            viewYear === today.getFullYear();
          const dayOfWeek = (firstDay + day - 1) % 7;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onToggle(dateStr)}
              className={`
                relative h-8 w-full rounded-lg text-xs font-medium transition-all
                ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-[0_0_8px_rgba(147,51,234,0.5)]'
                    : 'hover:bg-zinc-800 text-zinc-300'
                }
                ${dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : ''}
                ${isSelected && dayOfWeek === 0 ? 'text-red-200' : ''}
                ${isSelected && dayOfWeek === 6 ? 'text-blue-200' : ''}
              `}
            >
              {day}
              {isToday && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-purple-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {selectedDates.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {selectedDates.sort().map((d) => (
            <span
              key={d}
              className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full flex items-center gap-1"
            >
              {d}
              <button type="button" onClick={() => onToggle(d)} className="hover:text-white">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Schedule result calendar (availability toggle) ──────────────────────────
function ScheduleCalendar({
  scheduleTimes,
  currentUserId,
  onToggle,
  confirmedTime,
  canConfirm,
  onConfirm,
}: {
  scheduleTimes: PostScheduleTimeResponse[];
  currentUserId?: number;
  onToggle: (scheduleTimeId: number) => void;
  confirmedTime?: string | null;
  canConfirm: boolean;
  onConfirm: (timeSlot: string) => void;
}) {
  const markedDates = scheduleTimes.map((st) => st.time_slot);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const toDateStr = (d: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const monthNames = [
    '1월',
    '2월',
    '3월',
    '4월',
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
    '11월',
    '12월',
  ];
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  };

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 select-none">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-bold text-zinc-200">
            {viewYear}년 {monthNames[viewMonth]}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {dayLabels.map((d, i) => (
            <div
              key={d}
              className={`text-center text-[10px] font-bold pb-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-400' : 'text-zinc-500'}`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} />;
            const dateStr = toDateStr(day);
            const stForDay = scheduleTimes.find((st) => st.time_slot === dateStr);
            const isCandidate = markedDates.includes(dateStr);
            const myAvailable =
              currentUserId && stForDay?.available_user_ids?.includes(currentUserId);
            const isThisConfirmed = confirmedTime === dateStr;
            const dayOfWeek = (firstDay + day - 1) % 7;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => stForDay && onToggle(stForDay.id)}
                disabled={!isCandidate}
                className={`
                  relative h-9 w-full rounded-lg text-xs font-medium transition-all flex flex-col items-center justify-center
                  ${
                    isThisConfirmed
                      ? 'bg-yellow-500 text-zinc-950 font-bold shadow-[0_0_10px_rgba(234,179,8,0.6)] border border-yellow-400'
                      : myAvailable
                        ? 'bg-purple-600 text-white shadow-[0_0_8px_rgba(147,51,234,0.4)]'
                        : isCandidate
                          ? 'bg-zinc-800/80 border border-purple-500/30 text-purple-300 hover:bg-purple-900/30'
                          : 'text-zinc-600 cursor-default'
                  }
                  ${!isCandidate && dayOfWeek === 0 ? 'text-red-900' : ''}
                  ${!isCandidate && dayOfWeek === 6 ? 'text-blue-900' : ''}
                `}
              >
                <span>{day}</span>
                {isCandidate && (
                  <span
                    className={`text-[8px] mt-0.5 ${
                      isThisConfirmed
                        ? 'text-zinc-900 font-bold'
                        : myAvailable
                          ? 'text-purple-200'
                          : 'text-purple-400'
                    }`}
                  >
                    {stForDay?.availabilities_count ?? 0}명
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[10px] text-zinc-500 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-zinc-800 border border-purple-500/30" />
          <span>후보 날짜</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-purple-600" />
          <span>내가 가능 (클릭해서 토글)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-500 border border-yellow-400" />
          <span>확정된 날짜</span>
        </div>
      </div>

      {scheduleTimes.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-zinc-800/60 pt-3">
          <p className="text-xs font-bold text-zinc-400">일정 후보 투표 목록</p>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {scheduleTimes
              .slice()
              .sort((a, b) => a.time_slot.localeCompare(b.time_slot))
              .map((st) => {
                const isThisConfirmed = confirmedTime === st.time_slot;
                return (
                  <div
                    key={st.id}
                    className={cn(
                      'flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all',
                      isThisConfirmed
                        ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                        : 'bg-zinc-900/40 border-zinc-800 text-zinc-300',
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-zinc-200">{st.time_slot}</span>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        득표수:{' '}
                        <strong className="text-purple-400">{st.availabilities_count}</strong>표
                      </span>
                    </div>
                    {canConfirm && (
                      <Button
                        size="sm"
                        variant={isThisConfirmed ? 'secondary' : 'outline'}
                        onClick={() => onConfirm(isThisConfirmed ? '' : st.time_slot)}
                        className={cn(
                          'h-7 px-2.5 rounded-lg text-[10px] font-bold transition-all',
                          isThisConfirmed
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white border-none'
                            : 'hover:bg-yellow-500/20 hover:text-yellow-400 border-zinc-700/60',
                        )}
                      >
                        {isThisConfirmed ? '확정 취소' : '일정 확정'}
                      </Button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ScheduleBoard ───────────────────────────────────────────────────────────
export function ScheduleBoard({ teamId }: { teamId: number }) {
  const queryClient = useQueryClient();
  const { selectedTeam } = useTeam();

  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDates, setScheduleDates] = useState<string[]>([]);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});

  const { data: posts, isLoading } = useQuery<CollaborationPostResponse[]>({
    queryKey: ['collab-posts', teamId],
    queryFn: async () => {
      const res = await apiClient.get(`/teams/${teamId}/posts`);
      return res.data;
    },
    select: (data) => data.filter((p) => p.post_type === 'schedule'),
    refetchInterval: 5000,
  });

  const { data: currentUser } = useQuery<UserResponse>({
    queryKey: ['current-user'],
    queryFn: async () => {
      const res = await apiClient.get('/users/me');
      return res.data;
    },
  });

  const confirmTimeMutation = useMutation({
    mutationFn: async ({ postId, confirmedTime }: { postId: number; confirmedTime: string }) => {
      const res = await apiClient.post(`/teams/${teamId}/posts/${postId}/confirm-time`, {
        confirmed_time: confirmedTime || null,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', teamId] });
      toast.success('일정이 확정되었습니다.');
    },
    onError: (err: unknown) => {
      toast.error('일정 확정에 실패했습니다.');
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (payload: { title: string; post_type: string; schedule_times: string[] }) => {
      const res = await apiClient.post(`/teams/${teamId}/posts`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', teamId] });
      setScheduleTitle('');
      setScheduleDates([]);
      setIsFormExpanded(false);
      toast.success('일정 조율이 등록되었습니다.');
    },
    onError: (err: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (err as any)?.response?.data;
      let msg = '등록에 실패했습니다.';
      if (data?.detail) {
        msg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
      toast.error(msg);
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      await apiClient.delete(`/teams/${teamId}/posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', teamId] });
      toast.success('삭제되었습니다.');
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ postId, scheduleTimeId }: { postId: number; scheduleTimeId: number }) => {
      const res = await apiClient.post(
        `/teams/${teamId}/posts/${postId}/availability/${scheduleTimeId}`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', teamId] });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: number; content: string }) => {
      const res = await apiClient.post(`/teams/${teamId}/posts/${postId}/comments`, { content });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', teamId] });
      setCommentInputs((prev) => ({ ...prev, [vars.postId]: '' }));
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async ({ postId, commentId }: { postId: number; commentId: number }) => {
      await apiClient.delete(`/teams/${teamId}/posts/${postId}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', teamId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTitle.trim()) {
      toast.error('일정 제목을 입력해주세요.');
      return;
    }
    if (scheduleDates.length < 1) {
      toast.error('캘린더에서 후보 날짜를 1개 이상 선택해주세요.');
      return;
    }
    createScheduleMutation.mutate({
      title: scheduleTitle.trim(),
      post_type: 'schedule',
      schedule_times: scheduleDates,
    });
  };

  const handleCommentSubmit = (postId: number) => {
    const c = commentInputs[postId];
    if (!c?.trim()) return;
    createCommentMutation.mutate({ postId, content: c.trim() });
  };

  return (
    <div className="space-y-6">
      {/* Create Form */}
      <Card className="bg-[#111113] border border-zinc-800/60 shadow-lg backdrop-blur-xl rounded-2xl overflow-hidden transition-all">
        <div
          className={`cursor-pointer hover:bg-white/5 transition-colors select-none ${!isFormExpanded ? 'py-5' : 'pt-5 pb-3'} px-6`}
          onClick={() => setIsFormExpanded((v) => !v)}
        >
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Plus
              size={16}
              className={`text-purple-400 transition-transform duration-300 ${isFormExpanded ? 'rotate-45' : ''}`}
            />
            새 일정 조율 만들기
          </h3>
        </div>

        {isFormExpanded && (
          <CardContent className="px-6 pb-6 animate-in slide-in-from-top-2 fade-in duration-200">
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                placeholder="일정 제목 (예: 6월 합주 날짜 조율)"
                value={scheduleTitle}
                onChange={(e) => setScheduleTitle(e.target.value)}
                className="bg-[#18181b] border-zinc-800/80 text-zinc-100 h-12 rounded-xl px-4 placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-700"
              />
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-400">
                  후보 날짜를 캘린더에서 선택하세요
                </p>
                <MiniCalendar
                  selectedDates={scheduleDates}
                  onToggle={(date) =>
                    setScheduleDates((prev) =>
                      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date],
                    )
                  }
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsFormExpanded(false)}
                  className="h-10 px-5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={createScheduleMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white h-10 px-6 rounded-xl font-medium shadow-[0_0_15px_rgba(147,51,234,0.3)] transition-all"
                >
                  {createScheduleMutation.isPending && (
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  )}
                  캘린더 등록
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Schedule Posts */}
      {isLoading ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      ) : !posts?.length ? (
        <p className="text-xs text-zinc-600 text-center py-8">아직 등록된 일정 조율이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card
              key={post.id}
              className="bg-zinc-950/20 border-zinc-800 hover:border-zinc-700 transition-all shadow-md overflow-hidden"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden bg-zinc-900 border border-zinc-800">
                    {post.user.profile_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.user.profile_image}
                        alt={post.user.nickname}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-600">
                        {post.user.nickname?.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-zinc-200">{post.user.nickname}</span>
                    <div className="text-[10px] text-zinc-500">
                      {new Date(post.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                {currentUser && post.user_id === currentUser.id && (
                  <button
                    onClick={() => deletePostMutation.mutate(post.id)}
                    className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-zinc-900"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-md font-bold text-zinc-200">{post.title}</h3>
                  {post.confirmed_time && (
                    <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-[9px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
                      ✨ 확정: {post.confirmed_time}
                    </span>
                  )}
                </div>

                <ScheduleCalendar
                  scheduleTimes={post.schedule_times}
                  currentUserId={currentUser?.id}
                  onToggle={(scheduleTimeId) =>
                    toggleAvailabilityMutation.mutate({ postId: post.id, scheduleTimeId })
                  }
                  confirmedTime={post.confirmed_time}
                  canConfirm={
                    selectedTeam?.owner_id === currentUser?.id || post.user_id === currentUser?.id
                  }
                  onConfirm={(timeSlot) =>
                    confirmTimeMutation.mutate({ postId: post.id, confirmedTime: timeSlot })
                  }
                />

                {/* Comments */}
                <div className="pt-4 border-t border-zinc-800 space-y-3">
                  <div className="space-y-2">
                    {post.comments?.map((comment) => (
                      <div
                        key={comment.id}
                        className="flex items-start justify-between gap-2 p-2 rounded-lg bg-zinc-900/40 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-300">{comment.user.nickname}</span>
                            <span className="text-[9px] text-zinc-600">
                              {new Date(comment.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-zinc-400">{comment.content}</p>
                        </div>
                        {currentUser && comment.user_id === currentUser.id && (
                          <button
                            onClick={() =>
                              deleteCommentMutation.mutate({
                                postId: post.id,
                                commentId: comment.id,
                              })
                            }
                            className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="댓글을 작성해 보세요..."
                      value={commentInputs[post.id] || ''}
                      onChange={(e) =>
                        setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      className="bg-zinc-900 border-zinc-800 text-zinc-200 text-xs h-8"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommentSubmit(post.id);
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => handleCommentSubmit(post.id)}
                      className="h-8 px-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800"
                    >
                      <Send size={12} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
