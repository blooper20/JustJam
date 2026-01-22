'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UploadCloud, Music, FileAudio, Loader2, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { fetchProjects, createProject, deleteProject } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const uploadMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setUploading(false);
      toast.success('프로젝트가 생성되었습니다.');
    },
    onError: () => {
      setUploading(false);
      toast.error('업로드에 실패했습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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
    <div className="container mx-auto p-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
          내 프로젝트
        </h1>
        <p className="text-muted-foreground mt-2">업로드한 음악을 관리하고 연습하세요</p>
      </header>

      {/* Upload Section */}
      <div className="flex justify-center mb-12">
        <div className="relative">
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
            className={`flex flex-col items-center justify-center w-64 h-32 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary transition-colors ${
              uploading ? 'opacity-50 pointer-events-none' : 'border-muted-foreground/50'
            }`}
          >
            {uploading ? (
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            ) : (
              <UploadCloud className="w-10 h-10 text-muted-foreground mb-2" />
            )}
            <span className="text-sm font-medium">
              {uploading ? '업로드 중...' : '새 프로젝트 업로드 (MP3/WAV)'}
            </span>
          </label>
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
