'use client';

import { useProject } from '@/hooks/use-project';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Play, AlertCircle, ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { MultiTrackPlayer } from '@/components/multitrack-player';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { ShareModal } from '@/components/share-modal';
import { Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const TabViewer = dynamic(() => import('@/components/tab-viewer').then((mod) => mod.TabViewer), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-12 border border-dashed border-zinc-700 rounded-lg bg-zinc-900/30">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-500 mb-2" />
      <p className="text-sm text-zinc-500">타브 뷰어 불러오는 중...</p>
    </div>
  ),
});
const ScoreViewer = dynamic(
  () => import('@/components/score-viewer').then((mod) => mod.ScoreViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed border-zinc-700 rounded-lg bg-zinc-900/30">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500 mb-2" />
        <p className="text-sm text-zinc-500">악보 뷰어 불러오는 중...</p>
      </div>
    ),
  },
);

export default function ProjectPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const view = searchParams.get('view');
  const queryClient = useQueryClient();
  const [loadMixer, setLoadMixer] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'mixer' | 'score' | 'tab'>(
    (searchParams.get('tab') as any) || 'mixer'
  );
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
          href="/"
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
              className={`relative px-3 py-1 rounded-full text-sm font-medium bg-black/80 z-10 ${project.status === 'completed'
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
            {project.status === 'completed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsShareModalOpen(true)}
                className="gap-2 transition-all hover:bg-zinc-800 border-zinc-700 h-8 font-medium bg-zinc-900/50"
              >
                <Users size={14} /> 공유/협업
              </Button>
            )}
          </div>
        </div>
      </div>

      <ShareModal
        projectId={id}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        isOwner={true}
      />

      {project.status === 'pending' && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6 text-center">
            <h3 className="text-lg font-medium mb-2">분석 준비 완료</h3>
            <p className="text-muted-foreground mb-4">음원 분리를 시작하려면 버튼을 클릭하세요.</p>
            <Button
              onClick={() => startProcessing()}
              disabled={isProcessing}
              size="lg"
            >
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
            <h3 className="text-xl font-medium mb-2">AI가 열심히 분석 중입니다...</h3>
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
            <p className="text-muted-foreground">분리된 음원 트랙과 관련 데이터를 불러오고 있습니다.</p>
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
                      onTimeUpdate={setCurrentTime}
                      chordProgression={project.chord_progression}
                      songStructure={project.structure}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Score View */}
            {activeTab === 'score' && (
              <Card className="bg-zinc-900 border-zinc-800 rounded-r-none shadow-2xl relative z-20">
                <CardHeader>
                  <CardTitle>Sheet Music (Standard Score)</CardTitle>
                  <CardDescription>모든 파트(드럼, 보컬, 기타 등)의 정식 악보입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScoreViewer
                    projectId={project.id}
                    existingInstruments={project.score_instruments}
                    currentTime={currentTime}
                    bpm={project.bpm}
                    autoLoad={true}
                  />
                </CardContent>
              </Card>
            )}

            {/* Tab View */}
            {activeTab === 'tab' && (
              <Card className="bg-zinc-900 border-zinc-800 rounded-r-none shadow-2xl relative z-20">
                <CardHeader>
                  <CardTitle>Tablature Viewer (Guitar/Bass Only)</CardTitle>
                  <CardDescription>AI가 분석한 정밀 타브 악보입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TabViewer
                    projectId={project.id}
                    existingInstruments={project.tab_instruments}
                    autoLoad={true}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Vertical Index Sticker Tabs (Right Side) */}
          <div className="flex flex-col gap-1 pt-12 -ml-[1px] z-10 shrink-0">
            <button
              onClick={() => setActiveTab('mixer')}
              className={cn(
                "w-12 h-32 rounded-r-2xl font-black text-[10px] [writing-mode:vertical-lr] transition-all duration-300 flex items-center justify-center gap-3 border-y border-r tracking-[0.2em] relative",
                activeTab === 'mixer'
                  ? "bg-zinc-900 border-zinc-800 text-primary translate-x-0 z-30 border-l-zinc-900 shadow-[15px_5px_30px_rgba(0,0,0,0.5)]"
                  : "bg-zinc-950 border-zinc-800/60 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 -translate-x-1 z-0 shadow-inner"
              )}
              style={activeTab === 'mixer' ? { marginLeft: '-1px', borderLeftWidth: '2px', borderLeftColor: '#18181b' } : {}}
            >
              <div className={cn("w-2 h-2 rounded-full", activeTab === 'mixer' ? "bg-primary shadow-[0_0_10px_rgba(250,204,21,0.6)] animate-pulse" : "bg-zinc-800")} />
              MIXING
            </button>
            <button
              onClick={() => setActiveTab('score')}
              className={cn(
                "w-12 h-32 rounded-r-2xl font-black text-[10px] [writing-mode:vertical-lr] transition-all duration-300 flex items-center justify-center gap-3 border-y border-r tracking-[0.2em] relative",
                activeTab === 'score'
                  ? "bg-zinc-900 border-zinc-800 text-blue-400 translate-x-0 z-30 border-l-zinc-900 shadow-[15px_5px_30px_rgba(0,0,0,0.5)]"
                  : "bg-zinc-950 border-zinc-800/60 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 -translate-x-1 z-0 shadow-inner"
              )}
              style={activeTab === 'score' ? { marginLeft: '-1px', borderLeftWidth: '2px', borderLeftColor: '#18181b' } : {}}
            >
              <div className={cn("w-2 h-2 rounded-full", activeTab === 'score' ? "bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.6)] animate-pulse" : "bg-zinc-800")} />
              SCORE
            </button>
            <button
              onClick={() => setActiveTab('tab')}
              className={cn(
                "w-12 h-32 rounded-r-2xl font-black text-[10px] [writing-mode:vertical-lr] transition-all duration-300 flex items-center justify-center gap-3 border-y border-r tracking-[0.2em] relative",
                activeTab === 'tab'
                  ? "bg-zinc-900 border-zinc-800 text-purple-400 translate-x-0 z-30 border-l-zinc-900 shadow-[15px_5px_30px_rgba(0,0,0,0.5)]"
                  : "bg-zinc-950 border-zinc-800/60 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 -translate-x-1 z-0 shadow-inner"
              )}
              style={activeTab === 'tab' ? { marginLeft: '-1px', borderLeftWidth: '2px', borderLeftColor: '#18181b' } : {}}
            >
              <div className={cn("w-2 h-2 rounded-full", activeTab === 'tab' ? "bg-purple-400 shadow-[0_0_10px_rgba(167,139,250,0.6)] animate-pulse" : "bg-zinc-800")} />
              TAB
            </button>
          </div>
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
