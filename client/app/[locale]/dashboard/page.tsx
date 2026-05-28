'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UploadCloud,
  Music,
  Loader2,
  Play,
  Trash2,
  Activity,
  Plus,
  Clock,
  FileMusic,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import { API_BASE_URL } from '@/lib/api-client';
import { toast } from 'sonner';
import { fetchProjects, createProject, deleteProject } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Edit2, Search, Copy } from 'lucide-react';
import { updateProject, cloneProject } from '@/lib/api';
import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('Dashboard');
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const {
    data: projects,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['projects', searchQuery, sortBy],
    queryFn: () => fetchProjects({ q: searchQuery, sort: sortBy }),
  });

  const uploadMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setUploading(false);
      toast.success(t('projectCreated'));
    },
    onError: () => {
      setUploading(false);
      toast.error(t('uploadFailed'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(t('projectDeleted'));
    },
    onError: () => {
      toast.error(t('deleteFailed'));
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateProject(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(t('renameSuccess'));
    },
    onError: () => {
      toast.error(t('renameFailed'));
    },
  });

  const cloneMutation = useMutation({
    mutationFn: cloneProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(t('cloneSuccess'));
    },
    onError: () => {
      toast.error(t('cloneFailed'));
    },
  });

  const handleRenameClick = (e: React.MouseEvent, id: string, currentName: string) => {
    e.preventDefault();
    e.stopPropagation();
    const newName = prompt(t('enterNewName'), currentName);
    if (newName && newName.trim() !== currentName) {
      renameMutation.mutate({ id, name: newName.trim() });
    }
  };

  const handleCloneClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    cloneMutation.mutate(id);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploading(true);
      uploadMutation.mutate(e.target.files[0]);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();

    toast(t('confirmDelete'), {
      action: {
        label: t('delete'),
        onClick: () => deleteMutation.mutate(projectId),
      },
      cancel: {
        label: t('cancel'),
        onClick: () => {},
      },
    });
  };

  const processingProjects =
    projects?.filter((p) => p.status === 'processing' || p.status === 'pending').length || 0;
  const completedProjects = projects?.filter((p) => p.status === 'completed').length || 0;
  const projectsWithScores =
    projects?.filter((p) => p.status === 'completed' && p.has_score).length || 0;
  const projectsWithTabs =
    projects?.filter((p) => p.status === 'completed' && p.has_tab).length || 0;

  return (
    <div className="container mx-auto p-8 space-y-8">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              className="pl-9 bg-zinc-950 border-zinc-800"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-32 bg-zinc-950 border-zinc-800">
              <SelectValue placeholder={t('sortBy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t('newest')}</SelectItem>
              <SelectItem value="oldest">{t('oldest')}</SelectItem>
              <SelectItem value="name">{t('name')}</SelectItem>
            </SelectContent>
          </Select>
          <input
            type="file"
            id="header-file-upload"
            className="hidden"
            accept="audio/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <label htmlFor="header-file-upload">
            <Button disabled={uploading} className="cursor-pointer" asChild>
              <span>
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {t('newProject')}
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* 곡 (음원) Category */}
        <Link href="/dashboard/songs" className="block transition-transform hover:-translate-y-1">
          <Card className="bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">{t('songs')}</CardTitle>
              <Music className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between mt-2">
                <div>
                  <div className="text-3xl font-bold tracking-tight">
                    {isLoading ? '-' : completedProjects}
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 font-semibold">
                    {t('owned')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-semibold text-orange-500">
                    {isLoading ? '-' : processingProjects}
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 font-semibold">
                    {t('processing')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 악보 (Sheet) Category */}
        <Link href="/dashboard/scores" className="block transition-transform hover:-translate-y-1">
          <Card className="bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">{t('scores')}</CardTitle>
              <FileMusic className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between mt-2">
                <div>
                  <div className="text-3xl font-bold tracking-tight">
                    {isLoading ? '-' : projectsWithScores}
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 font-semibold">
                    {t('owned')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-semibold text-orange-500">
                    {isLoading ? '-' : completedProjects - projectsWithScores}
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 font-semibold">
                    {t('creatable')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 타브악보 (Tab) Category */}
        <Link href="/dashboard/tabs" className="block transition-transform hover:-translate-y-1">
          <Card className="bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">{t('tabs')}</CardTitle>
              <Activity className="h-4 w-4 text-pink-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between mt-2">
                <div>
                  <div className="text-3xl font-bold tracking-tight">
                    {isLoading ? '-' : projectsWithTabs}
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 font-semibold">
                    {t('owned')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-semibold text-orange-500">
                    {isLoading ? '-' : completedProjects - projectsWithTabs}
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 font-semibold">
                    {t('creatable')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Project List Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">{t('myProjects')}</h2>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">{t('loading')}</p>
          </div>
        ) : isError ? (
          <div className="text-center py-12 text-red-500">
            <p>{t('errorLoading')}</p>
            <p className="text-sm opacity-70">
              {error instanceof Error ? error.message : '알 수 없는 오류'}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
            >
              {t('retry')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Empty State / Upload Card */}
            <div className="group relative block rounded-xl border-2 border-dashed border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all cursor-pointer">
              <input
                type="file"
                id="card-file-upload"
                className="hidden"
                accept="audio/*"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <label
                htmlFor="card-file-upload"
                className="flex flex-col items-center justify-center h-full min-h-[200px] cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
                ) : (
                  <div className="p-4 rounded-full bg-zinc-900 group-hover:bg-zinc-800 transition-colors mb-2">
                    <UploadCloud className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                )}
                <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {uploading ? t('uploading') : t('newProjectUpload')}
                </span>
                <span className="text-xs text-muted-foreground mt-1">{t('supportedFormats')}</span>
              </label>
            </div>

            {projects?.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group relative block rounded-xl"
              >
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

                <Card className="relative h-full hover:shadow-lg transition-transform hover:-translate-y-1 duration-200 border-zinc-800 bg-zinc-950 overflow-hidden">
                  {/* Thumbnail Preview */}
                  <div className="relative h-28 bg-zinc-900 overflow-hidden">
                    {project.thumbnail_url && !imageErrors[project.id] ? (
                      <div className="absolute inset-0">
                        <Image
                          src={`${API_BASE_URL.replace('/api/v1', '')}${project.thumbnail_url}`}
                          alt={project.name}
                          fill
                          className="object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                          onError={() => {
                            setImageErrors((prev) => ({ ...prev, [project.id]: true }));
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-zinc-800">
                        <Music className="w-12 h-12 opacity-20" />
                      </div>
                    )}

                    {/* Shared Indicator Badge */}
                    {!project.is_owner && (
                      <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded-md bg-blue-500/80 backdrop-blur-md text-[10px] font-bold text-white flex items-center gap-1 shadow-lg">
                        <Users size={10} /> {t('shared').toUpperCase()}
                      </div>
                    )}

                    {/* Click to Action Overlay for Pending only */}
                    {project.status === 'pending' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 font-bold text-yellow-500">
                        <Play className="w-6 h-6 mr-2 fill-current" /> {t('startAnalysis')}
                      </div>
                    )}
                  </div>

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
                      <div className="flex items-center gap-1">
                        {project.is_owner ? (
                          <>
                            <button
                              onClick={(e) => handleRenameClick(e, project.id, project.name)}
                              className="text-muted-foreground hover:text-zinc-200 transition-colors p-1 rounded-md hover:bg-zinc-800"
                              title={t('rename')}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleCloneClick(e, project.id)}
                              className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-md hover:bg-zinc-800"
                              title={t('clone')}
                              disabled={cloneMutation.isPending}
                            >
                              {cloneMutation.isPending && cloneMutation.variables === project.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={(e) => handleDeleteClick(e, project.id)}
                              className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded-md hover:bg-zinc-800"
                              title={t('delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                            <Users size={10} /> {t('shared')}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mt-4">
                      <div className="text-2xl font-bold flex items-center gap-2">
                        <StatusBadge status={project.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('Dashboard');
  const styles = {
    pending: 'text-yellow-500',
    processing: 'text-blue-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
  };

  const labels = {
    pending: t('pending'),
    processing: t('processing'),
    completed: t('completed'),
    failed: t('failed'),
  };

  return (
    <span className={styles[status as keyof typeof styles] || 'text-gray-500'}>
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}
