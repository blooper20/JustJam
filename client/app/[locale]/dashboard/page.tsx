'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Music2, Crown, Loader2, Guitar, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { useTeam } from '@/components/team-provider';
import { createTeam } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const BAND_COLORS = [
  'from-purple-600/30 to-pink-600/20 border-purple-500/30',
  'from-blue-600/30 to-cyan-600/20 border-blue-500/30',
  'from-orange-600/30 to-yellow-600/20 border-orange-500/30',
  'from-green-600/30 to-teal-600/20 border-green-500/30',
  'from-red-600/30 to-rose-600/20 border-red-500/30',
  'from-indigo-600/30 to-violet-600/20 border-indigo-500/30',
];

const BAND_ICONS = [Guitar, Music2, Users];

export default function TeamSelectionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { teams, setSelectedTeamId, isLoading } = useTeam();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const createTeamMutation = useMutation({
    mutationFn: (name: string) => createTeam(name),
    onSuccess: (newTeam) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success(`${newTeam.name} 밴드가 생성되었습니다! 🎸`);
      setIsCreateModalOpen(false);
      setNewTeamName('');
      handleTeamSelect(newTeam.id);
    },
    onError: () => {
      toast.error('밴드 생성에 실패했습니다.');
    },
  });

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    createTeamMutation.mutate(newTeamName.trim());
  };

  const handleTeamSelect = (teamId: number) => {
    setSelectedTeamId(teamId);
    router.push('/dashboard/collab');
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-80px)] overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-5%] right-[15%] w-[400px] h-[400px] bg-indigo-900/15 rounded-full blur-[100px]" />
      </div>

      <div className="relative container mx-auto px-4 py-16 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col items-center mb-14 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium mb-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            JustJam Workspace
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white">
            어떤 밴드로
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              시작할까요?
            </span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-md leading-relaxed">
            밴드를 선택하면 공지, 합주곡 투표, 연습 일정을 함께 관리할 수 있어요.
          </p>
        </div>

        {/* Empty state */}
        {teams.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 space-y-6">
            <div className="w-24 h-24 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Guitar className="w-10 h-10 text-zinc-600" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-zinc-200">첫 번째 밴드를 만들어보세요</h2>
              <p className="text-zinc-500">팀원 없이 혼자서도 모든 기능을 사용할 수 있어요.</p>
            </div>
          </div>
        )}

        {/* Teams Grid */}
        {teams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
            {teams.map((team, idx) => {
              const colorClass = BAND_COLORS[idx % BAND_COLORS.length];
              const Icon = BAND_ICONS[idx % BAND_ICONS.length];
              return (
                <button
                  key={team.id}
                  onClick={() => handleTeamSelect(team.id)}
                  className={`group relative text-left w-full overflow-hidden rounded-2xl border bg-gradient-to-br ${colorClass} backdrop-blur-sm p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500`}
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300 rounded-2xl" />

                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-5 group-hover:bg-white/15 transition-colors">
                    <Icon className="w-6 h-6 text-white/70" />
                  </div>

                  {/* Name + Crown */}
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-bold text-white leading-tight pr-2">{team.name}</h3>
                    {team.is_owner && (
                      <Crown className="w-4 h-4 text-yellow-400 shrink-0 mt-1" aria-label="방장" />
                    )}
                  </div>

                  {/* Members count */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-white/50">
                      <Users className="w-4 h-4" />
                      <span>멤버 {team.members?.length ?? 1}명</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Create New Team */}
        <div className="flex justify-center mt-8">
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <button className="group flex items-center gap-3 px-6 py-3.5 rounded-xl border-2 border-dashed border-zinc-700 hover:border-purple-500/50 bg-transparent hover:bg-purple-500/5 text-zinc-400 hover:text-purple-300 transition-all duration-300 font-medium">
                <span className="w-8 h-8 rounded-full bg-zinc-800 group-hover:bg-purple-500/20 flex items-center justify-center transition-colors">
                  <Plus className="w-4 h-4" />
                </span>
                새 밴드 만들기
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px] bg-zinc-950 border-zinc-800 text-zinc-100">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">새 밴드 만들기 🎸</DialogTitle>
                <DialogDescription className="text-zinc-400 mt-1">
                  밴드 이름을 입력해주세요. 생성 후 팀원들을 초대할 수 있어요.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTeam}>
                <div className="grid gap-4 py-4">
                  <Input
                    id="name"
                    placeholder="예: 델리스파이스, Maroon 5, 우리밴드"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white h-12 rounded-xl text-base focus-visible:ring-purple-500"
                    autoFocus
                  />
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setNewTeamName('');
                    }}
                    className="bg-transparent border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white"
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    disabled={!newTeamName.trim() || createTeamMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6"
                  >
                    {createTeamMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      '생성하기'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
