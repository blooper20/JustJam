'use client';

import { useProject } from '@/hooks/use-project';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Play, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import dynamic from 'next/dynamic';

const MultiTrackPlayer = dynamic(
  () => import('@/components/multitrack-player').then((mod) => mod.MultiTrackPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50 backdrop-blur-xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
  },
);

export default function ProjectPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [loadMixer, setLoadMixer] = useState(false);

  const activeTab = (searchParams.get('tab') as 'mixer' | 'collab') || 'mixer';
  // Removed local progress state

  const {
    project,
    isLoading,
    stems,
    processProject: startProcessing,
    isProcessing,
  } = useProject(id);

  if (isLoading)
    return (
      <div className="p-8 text-center">
        <Loader2 className="animate-spin inline mr-2" /> 불러오는 중...
      </div>
    );
  if (!project)
    return <div className="p-8 text-center text-red-500">프로젝트를 찾을 수 없습니다.</div>;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <div className="mb-6">
        <Link
          href="/dashboard/collab?tab=song"
          className="text-muted-foreground hover:text-primary flex items-center gap-2 mb-4"
        >
          <ArrowLeft size={16} /> 프로젝트 목록으로 돌아가기
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground text-sm">
              Created: {new Date(project.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2 relative">
            {/* Status Glow for Project Page */}

            <span
              className={`relative px-3 py-1 rounded-full text-sm font-medium bg-black/80 z-10 ${
                project.status === 'completed'
                  ? 'text-green-500'
                  : project.status === 'processing'
                    ? 'text-blue-500'
                    : project.status === 'failed'
                      ? 'text-red-500'
                      : 'text-yellow-500'
              }`}
            >
              {project.status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {project.status === 'pending' && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6 text-center">
            <h3 className="text-lg font-medium mb-2">분석 준비 완료</h3>
            <p className="text-muted-foreground mb-4">음원 분리를 시작하려면 버튼을 클릭하세요.</p>
            <Button onClick={() => startProcessing()} disabled={isProcessing} size="lg">
              {isProcessing && <Loader2 className="animate-spin mr-2" />}
              분리 및 분석 시작 (Start Separation)
            </Button>
          </CardContent>
        </Card>
      )}

      {project.status === 'processing' && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6 text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
            <h3 className="text-xl font-medium mb-2">
              {project.status_text || 'AI가 열심히 분석 중입니다...'}
            </h3>
            <p className="text-muted-foreground mb-6">
              음원 분리 작업은 약 3~5분 정도 소요됩니다. 잠시만 기다려주세요.
            </p>
            <div className="max-w-md mx-auto space-y-2">
              <Progress value={project.progress || 0} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{project.progress || 0}%</p>
            </div>
          </CardContent>
        </Card>
      )}

      {project.status === 'completed' && !stems && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6 text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
            <h3 className="text-xl font-medium mb-2">분석 데이터를 불러오는 중...</h3>
            <p className="text-muted-foreground">
              분리된 음원 트랙과 관련 데이터를 불러오고 있습니다.
            </p>
          </CardContent>
        </Card>
      )}

      {project.status === 'completed' && stems && (
        <div className="flex gap-0 items-start">
          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Mixer View */}
            {activeTab === 'mixer' && (
              <Card className="bg-zinc-900 border-zinc-800 rounded-r-none shadow-2xl relative z-20">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Multitrack Mixer
                        <span className="text-xs font-normal text-muted-foreground bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
                          AI BPM: {project.bpm || 'Unknown'}
                        </span>
                        {project.detected_key && (
                          <span className="text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                            Key: {project.detected_key}
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>각 파트의 볼륨을 조절하여 연습하세요.</CardDescription>
                    </div>
                    {!loadMixer && (
                      <Button onClick={() => setLoadMixer(true)} size="sm">
                        믹서 활성화
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!loadMixer ? (
                    <div className="flex flex-col items-center justify-center py-12 bg-zinc-950 rounded-lg border border-zinc-800 space-y-4">
                      <div className="p-4 rounded-full bg-zinc-900">
                        <Play className="w-8 h-8 text-primary fill-current" />
                      </div>
                      <div className="text-center">
                        <h4 className="font-medium">곡 분석 완료됨</h4>
                        <p className="text-sm text-muted-foreground">
                          멀티트랙 믹서를 불러와서 연습을 시작하세요.
                        </p>
                      </div>
                      <Button
                        onClick={() => setLoadMixer(true)}
                        size="lg"
                        className="rounded-full px-8"
                      >
                        믹서 불러오기 (Load Mixer)
                      </Button>
                    </div>
                  ) : (
                    <MultiTrackPlayer
                      stems={stems}
                      projectId={project.id}
                      initialBpm={project.bpm}
                      chordProgression={project.chord_progression}
                      songStructure={project.structure}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Vertical Index Sticker Tabs (Right Side) */}
          <div className="flex flex-col gap-1 pt-12 -ml-[1px] z-10 shrink-0"></div>
        </div>
      )}

      {project.status === 'failed' && (
        <Card className="border-red-900 bg-red-900/10">
          <CardContent className="pt-6 flex flex-col items-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-red-500">분석 실패</h3>
            <p className="text-muted-foreground">
              작업 처리 중 오류가 발생했습니다. 서버 로그를 확인해주세요.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
