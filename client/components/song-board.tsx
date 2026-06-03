'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UploadCloud, Music, Loader2, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { fetchProjects, createProject, deleteProject, createProjectFromYoutube } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface SongBoardProps {
  teamId: number;
}

export function SongBoard({ teamId }: SongBoardProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'file' | 'youtube'>('file');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', teamId],
    queryFn: () => fetchProjects({ team_id: teamId }),
    enabled: !!teamId,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => createProject(file, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] });
      setUploading(false);
      toast.success('프로젝트가 생성되었습니다.');
    },
    onError: () => {
      setUploading(false);
      toast.error('업로드에 실패했습니다.');
    },
  });

  const youtubeMutation = useMutation({
    mutationFn: (url: string) => createProjectFromYoutube(url, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] });
      setUploading(false);
      setYoutubeUrl('');
      toast.success('유튜브 프로젝트가 생성되었습니다.');
    },
    onError: (err: unknown) => {
      setUploading(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = (err as any).response?.data?.detail || '유튜브 음원 추출에 실패했습니다.';
      toast.error(detail);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] });
      toast.success('프로젝트가 삭제되었습니다.');
    },
    onError: () => {
      toast.error('프로젝트 삭제에 실패했습니다.');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploading(true);
      uploadMutation.mutate(e.target.files[0]);
    }
  };

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    if (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
      toast.error('올바른 유튜브 링크를 입력해주세요.');
      return;
    }
    setUploading(true);
    youtubeMutation.mutate(youtubeUrl.trim());
  };

  const handleDeleteClick = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault(); // Link 이동 방지
    e.stopPropagation();

    toast('정말 삭제하시겠습니까?', {
      action: {
        label: '삭제',
        onClick: () => deleteMutation.mutate(projectId),
      },
      cancel: {
        label: '취소',
        onClick: () => {},
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* Upload & Youtube Tabs Section */}
      <div className="flex flex-col items-center mb-12">
        <div className="w-full max-w-md bg-zinc-950/40 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 shadow-2xl">
          {/* Tab Headers */}
          <div className="flex bg-zinc-900/60 p-1 rounded-xl mb-6">
            <button
              onClick={() => !uploading && setActiveTab('file')}
              disabled={uploading}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'file'
                  ? 'bg-zinc-800 text-white shadow'
                  : 'text-muted-foreground hover:text-white'
              } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              파일 업로드
            </button>
            <button
              onClick={() => !uploading && setActiveTab('youtube')}
              disabled={uploading}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'youtube'
                  ? 'bg-zinc-800 text-white shadow'
                  : 'text-muted-foreground hover:text-white'
              } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              유튜브 링크
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[140px] flex items-center justify-center">
            {activeTab === 'file' ? (
              <div className="w-full relative flex justify-center">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept="audio/*"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <label
                  htmlFor="file-upload"
                  className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/80 transition-all ${
                    uploading
                      ? 'opacity-50 pointer-events-none'
                      : 'border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/40'
                  }`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                      <span className="text-xs text-muted-foreground animate-pulse">
                        업로드 중...
                      </span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
                      <span className="text-sm font-medium text-zinc-300">
                        음원 파일 드래그 또는 클릭 (MP3/WAV)
                      </span>
                    </>
                  )}
                </label>
              </div>
            ) : (
              <form onSubmit={handleYoutubeSubmit} className="w-full space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="youtube-url"
                    className="text-xs text-muted-foreground font-medium block"
                  >
                    YouTube 또는 YouTube Music 동영상 URL
                  </label>
                  <input
                    id="youtube-url"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    disabled={uploading}
                    className="w-full bg-zinc-900/80 border border-zinc-850 focus:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-650 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-all disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={uploading || !youtubeUrl.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-medium py-3 px-4 rounded-xl text-sm transition-all shadow-lg hover:shadow-red-950/20 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>유튜브 음원 추출 중...</span>
                    </>
                  ) : (
                    <>
                      <Music className="w-4 h-4" />
                      <span>음원 추출하여 생성</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Project Grid */}
      {isLoading ? (
        <div className="text-center">Loading projects...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group relative block rounded-xl"
            >
              {/* Glowing Background (Processing: Spin, Pending/Failed: Pulse) */}
              {(project.status === 'processing' ||
                project.status === 'pending' ||
                project.status === 'failed') && (
                <div
                  className={`absolute -inset-[1px] rounded-xl bg-gradient-to-r opacity-75 blur-sm animate-pulse`}
                  style={{
                    animationDuration: '2s',
                    background:
                      project.status === 'failed'
                        ? 'conic-gradient(from 0deg, transparent 0deg, #ef4444 180deg, transparent 360deg)'
                        : project.status === 'pending'
                          ? 'conic-gradient(from 0deg, transparent 0deg, #eab308 180deg, transparent 360deg)'
                          : 'conic-gradient(from 0deg, transparent 0deg, #3b82f6 180deg, transparent 360deg)',
                  }}
                />
              )}

              <Card className="relative h-full hover:shadow-lg transition-shadow cursor-pointer border-zinc-800 bg-zinc-950 overflow-hidden">
                {/* Click to Action Overlay for Pending only */}
                {project.status === 'pending' && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 font-bold text-yellow-500">
                    <Play className="w-6 h-6 mr-2 fill-current" /> 분석 시작하기
                  </div>
                )}

                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium truncate pr-4">
                    {project.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {project.status === 'processing' ? (
                      <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                    ) : (
                      <Music className="h-4 w-4 text-muted-foreground" />
                    )}
                    <button
                      onClick={(e) => handleDeleteClick(e, project.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <StatusBadge status={project.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}

          {(!projects || projects.length === 0) && (
            <div className="col-span-full text-center text-muted-foreground py-12">
              아직 생성된 프로젝트가 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: 'text-yellow-500',
    processing: 'text-blue-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
  };

  const labels = {
    pending: '대기 중',
    processing: '분리 중...',
    completed: '완료됨',
    failed: '실패',
  };

  return (
    <span className={styles[status as keyof typeof styles] || 'text-gray-500'}>
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}
