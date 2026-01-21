'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Music, Loader2, Play, Trash2, Clock, ChevronLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { fetchProjects, createProject, deleteProject } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function SongsPage() {
    const queryClient = useQueryClient();
    const [uploading, setUploading] = useState(false);

    const { data: projects, isLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: fetchProjects,
    });

    const deleteMutation = useMutation({
        mutationFn: deleteProject,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            toast.success("프로젝트가 삭제되었습니다.");
        },
        onError: () => {
            toast.error("프로젝트 삭제에 실패했습니다.");
        }
    });

    const handleDeleteClick = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        toast("정말 삭제하시겠습니까?", {
            action: {
                label: "삭제",
                onClick: () => deleteMutation.mutate(projectId),
            },
        });
    };

    return (
        <div className="container mx-auto p-8 space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/dashboard">
                    <Button variant="ghost" size="icon">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">보유 곡 (음원)</h1>
                    <p className="text-muted-foreground">전체 음원 리스트를 확인하고 관리하세요</p>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-muted-foreground" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects?.map((project) => (
                        <Link key={project.id} href={`/projects/${project.id}`} className="group relative block rounded-xl">
                            {(project.status === 'processing' || project.status === 'pending') && (
                                <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 opacity-75 blur-sm animate-pulse" />
                            )}
                            <Card className="relative h-full hover:shadow-lg transition-transform hover:-translate-y-1 duration-200 border-zinc-800 bg-zinc-950 overflow-hidden">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium truncate pr-4">{project.name}</CardTitle>
                                    <button onClick={(e) => handleDeleteClick(e, project.id)} className="text-muted-foreground hover:text-red-500 p-1">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </CardHeader>
                                <CardContent>
                                    <StatusBadge status={project.status} />
                                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(project.created_at).toLocaleDateString()}
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const labels: Record<string, string> = { pending: "대기 중", processing: "분리 중", completed: "완료됨", failed: "실패" };
    const colors: Record<string, string> = { pending: "text-yellow-500", processing: "text-blue-500", completed: "text-green-500", failed: "text-red-500" };
    return <span className={`text-sm font-bold ${colors[status] || "text-zinc-500"}`}>{labels[status] || status}</span>;
}
