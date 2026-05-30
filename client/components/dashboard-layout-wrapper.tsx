'use client';

import { useTeam } from '@/components/team-provider';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ArrowLeftRight, ChevronRight } from 'lucide-react';

type Tab = 'notice' | 'schedule' | 'song' | 'practice';

export function DashboardLayoutWrapper({
  children,
  activeTab,
  onTabChange,
}: {
  children: React.ReactNode;
  activeTab: Tab;
  onTabChange?: (tab: Tab) => void;
}) {
  const router = useRouter();
  const { selectedTeam } = useTeam();

  const handleTabClick = (tab: Tab) => {
    if (tab === 'song') {
      router.push('/projects');
    } else {
      if (activeTab === 'song') {
        router.push('/dashboard/collab');
      } else {
        onTabChange?.(tab);
      }
    }
  };

  const tabs: {
    id: Tab;
    label: string;
    color: string;
    dotColor: string;
    glowColor: string;
  }[] = [
    {
      id: 'notice',
      label: 'NOTICE',
      color: 'text-primary',
      dotColor: 'bg-primary',
      glowColor: 'shadow-[0_0_10px_rgba(250,204,21,0.6)]',
    },
    {
      id: 'schedule',
      label: 'SCHEDULE',
      color: 'text-purple-400',
      dotColor: 'bg-purple-400',
      glowColor: 'shadow-[0_0_10px_rgba(192,132,252,0.6)]',
    },
    {
      id: 'song',
      label: 'SONG',
      color: 'text-blue-400',
      dotColor: 'bg-blue-400',
      glowColor: 'shadow-[0_0_10px_rgba(96,165,250,0.6)]',
    },
    {
      id: 'practice',
      label: 'PRACTICE',
      color: 'text-green-400',
      dotColor: 'bg-green-400',
      glowColor: 'shadow-[0_0_10px_rgba(74,222,128,0.6)]',
    },
  ];

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 hover:text-purple-400 transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />내 밴드 목록
          </button>
          {selectedTeam && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
              <span className="text-zinc-300 font-medium">{selectedTeam.name}</span>
            </>
          )}
        </div>

        <h1 className="text-3xl font-bold tracking-tight">
          {selectedTeam ? selectedTeam.name : 'Team Collaboration'}
        </h1>
        <p className="text-muted-foreground mt-1">
          밴드 멤버를 관리하고, 합주곡에 투표하고, 연습 일정을 공유하세요.
        </p>
      </div>

      <div className="flex gap-0 items-start">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <Card className="bg-zinc-900 border-zinc-800 rounded-r-none shadow-2xl relative z-20 min-h-[600px] p-6">
            {children}
          </Card>
        </div>

        {/* Vertical Index Sticker Tabs */}
        <div className="flex flex-col gap-1 pt-12 -ml-[1px] z-10 shrink-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  'w-12 h-32 rounded-r-2xl font-black text-[10px] [writing-mode:vertical-lr] transition-all duration-300 flex items-center justify-center gap-3 border-y border-r tracking-[0.2em] relative',
                  isActive
                    ? `bg-zinc-900 border-zinc-800 ${tab.color} translate-x-0 z-30 border-l-zinc-900 shadow-[15px_5px_30px_rgba(0,0,0,0.5)]`
                    : 'bg-zinc-950 border-zinc-800/60 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 -translate-x-1 z-0 shadow-inner',
                )}
                style={
                  isActive
                    ? { marginLeft: '-1px', borderLeftWidth: '2px', borderLeftColor: '#18181b' }
                    : {}
                }
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    isActive ? `${tab.dotColor} ${tab.glowColor} animate-pulse` : 'bg-zinc-800',
                  )}
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
