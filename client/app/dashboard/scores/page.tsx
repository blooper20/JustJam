'use client';

import { useQuery } from '@tanstack/react-query';
import { FileMusic, Loader2, ChevronLeft, Clock, Activity } from 'lucide-react';
import { fetchProjects } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ScoresPage() {
    const { data: projects, isLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: fetchProjects,
    });

    return (
        <div className="container mx-auto p-8 space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/dashboard">
                    <Button variant="ghost" size="icon">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">보유 악보 (Sheet)</h1>
                    <p className="text-muted-foreground">생성된 악보 리스트를 확인하고 연습하세요</p>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-muted-foreground" />
                </div>
            ) : projects && projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                        <Link
                            key={project.id}
                            href={project.status === 'completed' ? `/projects/${project.id}?view=score` : '#'}
                            className={cn(
                                "group block rounded-xl transition-all",
                                project.status !== 'completed' && "cursor-not-allowed opacity-70"
                            )}
                            onClick={(e) => project.status !== 'completed' && e.preventDefault()}
                        >
                            <Card className={cn(
                                "h-full transition-all border-zinc-800 bg-zinc-950 overflow-hidden",
                                project.status === 'completed' ? "hover:shadow-lg hover:-translate-y-1 hover:border-blue-500/50" : "grayscale border-zinc-900"
                            )}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium truncate pr-4">{project.name}</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <FileMusic className={cn("h-4 w-4", project.status === 'completed' ? "text-blue-500" : "text-zinc-600")} />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2">
                                                <StatusBadge status={project.status} />
                                                {project.has_score ? (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold uppercase flex items-center gap-1">
                                                        <Activity className="w-3 h-3" /> 보관함 보관
                                                    </span>
                                                ) : project.status === 'completed' && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 font-bold uppercase">
                                                        생성 가능
                                                    </span>
                                                )}
                                            </div>
                                            {project.has_score && (
                                                <p className="text-[10px] text-blue-500/80 font-medium">✨ 이미 생성된 악보가 있어 즉시 열립니다.</p>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(project.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground">보유한 프로젝트가 없습니다.</div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const labels: Record<string, string> = { pending: "대기 중", processing: "분리 중", completed: "완료됨", failed: "실패" };
    const styles: Record<string, string> = {
        pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        processing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        completed: "bg-green-500/10 text-green-500 border-green-500/20",
        failed: "bg-red-500/10 text-red-500 border-red-500/20"
    };

    return (
        <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase",
            styles[status] || "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
        )}>
            {labels[status] || status}
        </span>
    );
}
