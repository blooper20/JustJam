'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  Trash2,
  Send,
  Plus,
  X,
  BarChart3,
  CalendarDays,
  Megaphone,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api-client';

interface CollaborationBoardProps {
  projectId: string;
}

export interface UserResponse {
  id: number;
  email: string;
  nickname: string;
  profile_image?: string;
  provider: string;
  role: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface CollaborationCommentResponse {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: string;
  user: UserResponse;
}

export interface PostOptionResponse {
  id: number;
  post_id: number;
  option_text: string;
  votes_count: number;
  voted_user_ids: number[];
}

export interface PostScheduleTimeResponse {
  id: number;
  post_id: number;
  time_slot: string;
  availabilities_count: number;
  available_user_ids: number[];
}

export interface CollaborationPostResponse {
  id: number;
  project_id: string;
  user_id: number;
  title: string;
  content: string;
  post_type: 'general' | 'vote' | 'schedule';
  created_at: string;
  user: UserResponse;
  comments: CollaborationCommentResponse[];
  options: PostOptionResponse[];
  schedule_times: PostScheduleTimeResponse[];
}

export function CollaborationBoard({ projectId }: CollaborationBoardProps) {
  const queryClient = useQueryClient();
  const t = useTranslations('Collab');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'general' | 'vote' | 'schedule'>('general');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [scheduleTimes, setScheduleTimes] = useState<string[]>(['', '']);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});

  // 1. Fetch Posts
  const { data: posts, isLoading } = useQuery<CollaborationPostResponse[]>({
    queryKey: ['collab-posts', projectId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/posts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch posts');
      return res.json();
    },
  });

  // 2. Fetch current user (to identify post/comment owners)
  const { data: currentUser } = useQuery<UserResponse>({
    queryKey: ['current-user'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    },
  });

  // 3. Create Post Mutation
  const createPostMutation = useMutation({
    mutationFn: async (newPost: {
      title: string;
      content: string;
      post_type: string;
      options?: string[];
      schedule_times?: string[];
    }) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newPost),
      });
      if (!res.ok) throw new Error('Failed to create post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', projectId] });
      setTitle('');
      setContent('');
      setOptions(['', '']);
      setScheduleTimes(['', '']);
      setPostType('general');
      toast.success('포스트가 작성되었습니다.');
    },
    onError: () => {
      toast.error('포스트 작성에 실패했습니다.');
    },
  });

  // 4. Delete Post Mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to delete post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', projectId] });
      toast.success('포스트가 삭제되었습니다.');
    },
  });

  // 5. Create Comment Mutation
  const createCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: number; content: string }) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', projectId] });
      setCommentInputs((prev) => ({ ...prev, [variables.postId]: '' }));
    },
  });

  // 6. Delete Comment Mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async ({ postId, commentId }: { postId: number; commentId: number }) => {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/projects/${projectId}/posts/${postId}/comments/${commentId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!res.ok) throw new Error('Failed to delete comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', projectId] });
      toast.success('댓글이 삭제되었습니다.');
    },
  });

  // 7. Toggle Vote Mutation
  const toggleVoteMutation = useMutation({
    mutationFn: async ({ postId, optionId }: { postId: number; optionId: number }) => {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/projects/${projectId}/posts/${postId}/vote/${optionId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!res.ok) throw new Error('Failed to submit vote');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', projectId] });
    },
  });

  // 8. Toggle Availability Mutation
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ postId, scheduleTimeId }: { postId: number; scheduleTimeId: number }) => {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/projects/${projectId}/posts/${postId}/availability/${scheduleTimeId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!res.ok) throw new Error('Failed to toggle availability');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', projectId] });
    },
  });

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const filteredOptions = options.filter((opt) => opt.trim() !== '');
    const filteredSchedules = scheduleTimes.filter((time) => time.trim() !== '');

    if (postType === 'vote' && filteredOptions.length < 2) {
      toast.error('투표 항목은 최소 2개 이상 입력해야 합니다.');
      return;
    }

    if (postType === 'schedule' && filteredSchedules.length < 1) {
      toast.error('후보 일정 시간대를 입력해주세요.');
      return;
    }

    createPostMutation.mutate({
      title,
      content,
      post_type: postType,
      options: postType === 'vote' ? filteredOptions : undefined,
      schedule_times: postType === 'schedule' ? filteredSchedules : undefined,
    });
  };

  const handleCommentSubmit = (postId: number) => {
    const commentContent = commentInputs[postId];
    if (!commentContent || !commentContent.trim()) return;
    createCommentMutation.mutate({ postId, content: commentContent.trim() });
  };

  return (
    <div className="space-y-8">
      {/* Create Post Form */}
      <Card className="bg-zinc-950/40 border-zinc-800/80 shadow-lg backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-bold text-zinc-100 flex items-center gap-2">
            <Plus size={16} className="text-pink-500" /> {t('writePost')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePostSubmit} className="space-y-4">
            <Input
              placeholder="제목을 입력하세요..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-zinc-100"
              required
            />
            <textarea
              placeholder="내용을 작성하세요..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex min-h-[100px] w-full rounded-md border border-zinc-850/80 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            />

            {/* Post Type Selector */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={postType === 'general' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPostType('general')}
                className="gap-1.5"
              >
                <Megaphone size={14} /> 일반 공지
              </Button>
              <Button
                type="button"
                variant={postType === 'vote' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPostType('vote')}
                className="gap-1.5"
              >
                <BarChart3 size={14} /> 투표 생성
              </Button>
              <Button
                type="button"
                variant={postType === 'schedule' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPostType('schedule')}
                className="gap-1.5"
              >
                <CalendarDays size={14} /> 일정 조율
              </Button>
            </div>

            {/* Voting Options */}
            {postType === 'vote' && (
              <div className="space-y-2 pl-4 border-l border-zinc-800">
                <p className="text-xs font-semibold text-zinc-400">투표 선택지</p>
                {options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      placeholder={`옵션 ${idx + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...options];
                        newOpts[idx] = e.target.value;
                        setOptions(newOpts);
                      }}
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 h-8 text-sm"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                        className="text-zinc-500 hover:text-zinc-300"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOptions([...options, ''])}
                  className="mt-1"
                >
                  <Plus size={10} className="mr-1" /> 항목 추가
                </Button>
              </div>
            )}

            {/* Schedule Slot Options */}
            {postType === 'schedule' && (
              <div className="space-y-2 pl-4 border-l border-zinc-800">
                <p className="text-xs font-semibold text-zinc-400">
                  후보 시간대 (예: 6월 1일 14시)
                </p>
                {scheduleTimes.map((time, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      placeholder="YYYY-MM-DD HH:MM 또는 자유 양식"
                      value={time}
                      onChange={(e) => {
                        const newTimes = [...scheduleTimes];
                        newTimes[idx] = e.target.value;
                        setScheduleTimes(newTimes);
                      }}
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 h-8 text-sm"
                    />
                    {scheduleTimes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setScheduleTimes(scheduleTimes.filter((_, i) => i !== idx))}
                        className="text-zinc-500 hover:text-zinc-300"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setScheduleTimes([...scheduleTimes, ''])}
                  className="mt-1"
                >
                  <Plus size={10} className="mr-1" /> 시간 추가
                </Button>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={createPostMutation.isPending}
                className="bg-pink-600 hover:bg-pink-700 text-white"
              >
                {createPostMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                등록하기
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Posts list */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {posts?.map((post) => (
            <Card
              key={post.id}
              className="bg-zinc-950/20 border-zinc-800 hover:border-zinc-800/80 transition-all shadow-md overflow-hidden"
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
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-zinc-200">{post.user.nickname}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-black tracking-wider uppercase ${
                          post.post_type === 'vote'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : post.post_type === 'schedule'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {post.post_type}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(post.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                {currentUser && post.user_id === currentUser.id && (
                  <button
                    onClick={() => deletePostMutation.mutate(post.id)}
                    className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-zinc-900"
                    title="포스트 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-md font-bold text-zinc-200">{post.title}</h3>
                  <p className="text-zinc-400 text-sm mt-1 whitespace-pre-line">{post.content}</p>
                </div>

                {/* Vote Options Rendering */}
                {post.post_type === 'vote' && (
                  <div className="space-y-2 p-4 rounded-xl bg-zinc-950/60 border border-zinc-900 max-w-md">
                    {post.options.map((opt) => {
                      const totalVotes = post.options.reduce(
                        (sum, o) => sum + (o.votes_count || 0),
                        0,
                      );
                      const percentage =
                        totalVotes > 0
                          ? Math.round(((opt.votes_count || 0) / totalVotes) * 100)
                          : 0;
                      const hasVoted = currentUser && opt.voted_user_ids?.includes(currentUser.id);

                      return (
                        <div key={opt.id} className="space-y-1">
                          <button
                            onClick={() =>
                              toggleVoteMutation.mutate({ postId: post.id, optionId: opt.id })
                            }
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all border ${
                              hasVoted
                                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 font-semibold'
                                : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            <span>{opt.option_text}</span>
                            <span className="text-xs">
                              {opt.votes_count}표 ({percentage}%)
                            </span>
                          </button>
                          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-500 h-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Schedule Times Rendering */}
                {post.post_type === 'schedule' && (
                  <div className="space-y-2 p-4 rounded-xl bg-zinc-950/60 border border-zinc-900 max-w-md">
                    {post.schedule_times.map((st) => {
                      const isAvailable =
                        currentUser && st.available_user_ids?.includes(currentUser.id);
                      return (
                        <button
                          key={st.id}
                          onClick={() =>
                            toggleAvailabilityMutation.mutate({
                              postId: post.id,
                              scheduleTimeId: st.id,
                            })
                          }
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all border ${
                            isAvailable
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-300 font-semibold'
                              : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <CalendarDays
                              size={14}
                              className={isAvailable ? 'text-purple-400' : 'text-zinc-500'}
                            />
                            {st.time_slot}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs bg-zinc-850 px-2 py-0.5 rounded text-zinc-400 border border-zinc-800">
                              {st.availabilities_count}명 가능
                            </span>
                            {isAvailable && <Check size={14} className="text-purple-400" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Comment Section */}
                <div className="pt-4 border-t border-zinc-800 space-y-3">
                  <div className="space-y-2">
                    {post.comments?.map((comment) => (
                      <div
                        key={comment.id}
                        className="flex items-start justify-between gap-2 p-2 rounded-lg bg-zinc-900/40 text-xs"
                      >
                        <div className="space-y-1">
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

                  {/* Comment Input */}
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
