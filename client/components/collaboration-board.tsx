'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Loader2, Trash2, Send, Plus, X, BarChart3, Megaphone, Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

// ─── Shared interfaces (also used by schedule-board) ────────────────────────
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
  youtube_url?: string;
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
  youtube_url?: string;
  created_at: string;
  user: UserResponse;
  comments: CollaborationCommentResponse[];
  options: PostOptionResponse[];
  schedule_times: PostScheduleTimeResponse[];
}

// ─── YouTube embed helper ────────────────────────────────────────────────────
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    const videoId = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v');
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  } catch {
    return url;
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function CollaborationBoard({ teamId }: { teamId: number }) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'general' | 'vote'>('general');
  const [options, setOptions] = useState<
    { option_text: string; youtube_url?: string; showYt?: boolean }[]
  >([{ option_text: '' }, { option_text: '' }]);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [addOptionInputs, setAddOptionInputs] = useState<
    Record<number, { text: string; yt?: string; showYt?: boolean; open?: boolean }>
  >({});

  // Fetch Posts (general + vote only)
  const { data: posts, isLoading } = useQuery<CollaborationPostResponse[]>({
    queryKey: ['collab-posts', teamId],
    queryFn: async () => {
      const res = await apiClient.get(`/teams/${teamId}/posts`);
      return res.data;
    },
    select: (data) => data.filter((p) => p.post_type !== 'schedule'),
  });

  const { data: currentUser } = useQuery<UserResponse>({
    queryKey: ['current-user'],
    queryFn: async () => {
      const res = await apiClient.get('/users/me');
      return res.data;
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      content: string;
      post_type: string;
      options?: { option_text: string; youtube_url?: string }[];
    }) => {
      const res = await apiClient.post(`/teams/${teamId}/posts`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', teamId] });
      setTitle('');
      setContent('');
      setOptions([{ option_text: '' }, { option_text: '' }]);
      setPostType('general');
      setIsFormExpanded(false);
      toast.success('포스트가 작성되었습니다.');
    },
    onError: (err: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (err as any)?.response?.data;
      let msg = '작성에 실패했습니다.';
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

  const toggleVoteMutation = useMutation({
    mutationFn: async ({ postId, optionId }: { postId: number; optionId: number }) => {
      const res = await apiClient.post(`/teams/${teamId}/posts/${postId}/vote/${optionId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', teamId] });
    },
  });

  const addOptionMutation = useMutation({
    mutationFn: async ({
      postId,
      option_text,
      youtube_url,
    }: {
      postId: number;
      option_text: string;
      youtube_url?: string;
    }) => {
      const res = await apiClient.post(`/teams/${teamId}/posts/${postId}/options`, {
        option_text,
        youtube_url: youtube_url || undefined,
      });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['collab-posts', teamId] });
      setAddOptionInputs((prev) => ({
        ...prev,
        [vars.postId]: { text: '', yt: '', showYt: false, open: false },
      }));
      toast.success('투표 항목이 추가되었습니다.');
    },
    onError: () => {
      toast.error('항목 추가에 실패했습니다.');
    },
  });

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      toast.error('내용을 입력해주세요.');
      return;
    }

    const filteredOptions = options
      .filter((o) => o.option_text.trim() !== '')
      .map((o) => ({
        option_text: o.option_text.trim(),
        youtube_url: o.youtube_url?.trim() || undefined,
      }));

    if (postType === 'vote' && filteredOptions.length < 2) {
      toast.error('투표 항목은 최소 2개 이상 입력해야 합니다.');
      return;
    }

    createPostMutation.mutate({
      title: title.trim(),
      content: content.trim(),
      post_type: postType,
      options: postType === 'vote' ? filteredOptions : undefined,
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
              className={`text-[#EC4899] transition-transform duration-300 ${isFormExpanded ? 'rotate-45' : ''}`}
            />
            글쓰기
          </h3>
        </div>

        {isFormExpanded && (
          <CardContent className="px-6 pb-6 animate-in slide-in-from-top-2 fade-in duration-200">
            <form onSubmit={handlePostSubmit} className="space-y-5">
              <Input
                placeholder="제목을 입력해주세요."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-[#18181b] border-zinc-800/80 text-zinc-100 h-12 rounded-xl px-4 placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-700"
              />
              <textarea
                placeholder="내용을 입력해주세요."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex min-h-[100px] w-full rounded-xl border border-zinc-800/80 bg-[#18181b] p-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 resize-none"
              />

              <div className="flex gap-3">
                {(['general', 'vote'] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    onClick={() => setPostType(type)}
                    className={`gap-2 h-10 px-5 rounded-xl transition-all ${
                      postType === type
                        ? 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-transparent'
                        : 'bg-transparent border border-zinc-800 text-zinc-300 hover:bg-zinc-800/50 hover:text-white'
                    }`}
                  >
                    {type === 'general' ? (
                      <>
                        <Megaphone size={15} /> 일반 공지
                      </>
                    ) : (
                      <>
                        <BarChart3 size={15} /> 투표 생성
                      </>
                    )}
                  </Button>
                ))}
              </div>

              {postType === 'vote' && (
                <div className="space-y-3 pt-1">
                  <p className="text-sm font-medium text-zinc-400">투표 선택지</p>
                  {options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="relative flex flex-col gap-2 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/50"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder={`옵션 ${idx + 1}`}
                          value={opt.option_text}
                          onChange={(e) => {
                            const n = [...options];
                            n[idx] = { ...n[idx], option_text: e.target.value };
                            setOptions(n);
                          }}
                          className="bg-[#18181b] border-zinc-800/80 text-zinc-100 h-10 rounded-lg px-3 flex-1 placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-700"
                        />
                        <button
                          type="button"
                          title="유튜브 링크 추가"
                          onClick={() => {
                            const n = [...options];
                            n[idx] = { ...n[idx], showYt: !n[idx].showYt };
                            setOptions(n);
                          }}
                          className={`p-2 rounded-lg border transition-colors ${
                            opt.showYt || opt.youtube_url
                              ? 'bg-red-500/20 border-red-500/40 text-red-400'
                              : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                          }`}
                        >
                          <Link2 size={14} />
                        </button>
                        {options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                            className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/40 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      {(opt.showYt || opt.youtube_url) && (
                        <Input
                          placeholder="유튜브 링크 (예: https://youtu.be/...)"
                          value={opt.youtube_url || ''}
                          onChange={(e) => {
                            const n = [...options];
                            n[idx] = { ...n[idx], youtube_url: e.target.value };
                            setOptions(n);
                          }}
                          className="bg-[#18181b] border-zinc-800/80 text-zinc-100 h-9 rounded-lg px-3 text-xs placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-700"
                        />
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    onClick={() => setOptions([...options, { option_text: '' }])}
                    className="bg-transparent border border-zinc-800 text-zinc-300 hover:bg-zinc-800/50 hover:text-white h-10 rounded-xl px-5 gap-2"
                  >
                    <Plus size={16} /> 항목 추가
                  </Button>
                </div>
              )}

              <div className="flex justify-end pt-1 gap-3">
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
                  disabled={createPostMutation.isPending}
                  className="bg-[#E11D48] hover:bg-[#BE123C] text-white h-10 px-7 rounded-xl font-medium shadow-[0_0_15px_rgba(225,29,72,0.3)] transition-all"
                >
                  {createPostMutation.isPending && (
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  )}
                  등록하기
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Posts List */}
      {isLoading ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      ) : !posts?.length ? (
        <p className="text-xs text-zinc-600 text-center py-8">아직 작성된 글이 없습니다.</p>
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
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-zinc-200">{post.user.nickname}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-black tracking-wider uppercase ${
                          post.post_type === 'vote'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {post.post_type === 'vote' ? '투표' : '공지'}
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
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-md font-bold text-zinc-200">{post.title}</h3>
                  {post.content && (
                    <p className="text-zinc-400 text-sm mt-1 whitespace-pre-line">{post.content}</p>
                  )}
                </div>

                {post.youtube_url && (
                  <div className="rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 aspect-video w-full max-w-md">
                    <iframe
                      width="100%"
                      height="100%"
                      src={toEmbedUrl(post.youtube_url)}
                      title="YouTube"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

                {post.post_type === 'vote' && (
                  <div className="space-y-2 p-4 rounded-xl bg-zinc-950/60 border border-zinc-900 max-w-lg">
                    {post.options.map((opt) => {
                      const total = post.options.reduce((s, o) => s + (o.votes_count || 0), 0);
                      const pct =
                        total > 0 ? Math.round(((opt.votes_count || 0) / total) * 100) : 0;
                      const hasVoted = currentUser && opt.voted_user_ids?.includes(currentUser.id);
                      return (
                        <div key={opt.id} className="space-y-1">
                          <button
                            onClick={() =>
                              toggleVoteMutation.mutate({ postId: post.id, optionId: opt.id })
                            }
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all border ${
                              hasVoted
                                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 font-semibold'
                                : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {hasVoted && <Check size={13} className="text-blue-400" />}
                              {opt.option_text}
                            </span>
                            <span className="text-xs shrink-0 ml-2">
                              {opt.votes_count}표 ({pct}%)
                            </span>
                          </button>
                          {opt.youtube_url && (
                            <div className="rounded-lg overflow-hidden border border-zinc-800">
                              <iframe
                                width="100%"
                                height="160"
                                src={toEmbedUrl(opt.youtube_url)}
                                title={opt.option_text}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          )}
                          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-500 h-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* Add option to existing vote */}
                    {(() => {
                      const state = addOptionInputs[post.id] || {};
                      return state.open ? (
                        <div className="pt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="새 선택지 입력"
                              value={state.text || ''}
                              onChange={(e) =>
                                setAddOptionInputs((p) => ({
                                  ...p,
                                  [post.id]: { ...p[post.id], text: e.target.value },
                                }))
                              }
                              className="bg-zinc-900 border-zinc-700 text-zinc-100 h-9 rounded-lg px-3 flex-1 text-sm placeholder:text-zinc-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              title="유튜브 링크 추가"
                              onClick={() =>
                                setAddOptionInputs((p) => ({
                                  ...p,
                                  [post.id]: { ...p[post.id], showYt: !p[post.id]?.showYt },
                                }))
                              }
                              className={`p-2 rounded-lg border transition-colors ${
                                state.showYt || state.yt
                                  ? 'bg-red-500/20 border-red-500/40 text-red-400'
                                  : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              <Link2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setAddOptionInputs((p) => ({
                                  ...p,
                                  [post.id]: { text: '', open: false },
                                }))
                              }
                              className="p-2 rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {(state.showYt || state.yt) && (
                            <Input
                              placeholder="유튜브 링크 (선택사항)"
                              value={state.yt || ''}
                              onChange={(e) =>
                                setAddOptionInputs((p) => ({
                                  ...p,
                                  [post.id]: { ...p[post.id], yt: e.target.value },
                                }))
                              }
                              className="bg-zinc-900 border-zinc-700 text-zinc-100 h-9 rounded-lg px-3 text-xs placeholder:text-zinc-500"
                            />
                          )}
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!state.text?.trim()) return;
                              addOptionMutation.mutate({
                                postId: post.id,
                                option_text: state.text.trim(),
                                youtube_url: state.yt?.trim(),
                              });
                            }}
                            disabled={!state.text?.trim() || addOptionMutation.isPending}
                            className="h-8 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg"
                          >
                            {addOptionMutation.isPending ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              '추가'
                            )}
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setAddOptionInputs((p) => ({
                              ...p,
                              [post.id]: { text: '', open: true },
                            }))
                          }
                          className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <Plus size={13} /> 항목 추가
                        </button>
                      );
                    })()}
                  </div>
                )}

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
