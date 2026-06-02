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
    if (onTabChange) {
      onTabChange(tab);
    } else {
      router.push(`/dashboard/collab?tab=${tab}`);
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

      <div className="flex flex-col md:flex-row gap-0 items-stretch md:items-start">
        {/* Index Sticker Tabs (displayed above Main Content on mobile) */}
        <div className="flex flex-row md:flex-col gap-1 z-10 shrink-0 overflow-x-auto md:overflow-visible -mb-[1px] md:mb-0 md:-ml-[1px] md:pt-12 order-first md:order-last">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  'font-black text-[10px] tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-3 relative shrink-0',
                  // Mobile style (horizontal top stickers)
                  'w-auto flex-1 px-4 h-11 rounded-t-xl border-t border-x border-b border-b-zinc-800/60 [writing-mode:horizontal-tb]',
                  // Desktop style (vertical right stickers)
                  'md:w-12 md:h-32 md:flex-initial md:px-0 md:rounded-t-none md:rounded-r-2xl md:border-y md:border-r md:border-l-0 md:[writing-mode:vertical-lr]',
                  isActive
                    ? `bg-zinc-900 border-zinc-800 ${tab.color} z-30 shadow-[0_4px_15px_rgba(0,0,0,0.3)] border-b-zinc-900 md:border-b-zinc-800 md:border-l-zinc-900 md:translate-x-0`
                    : 'bg-zinc-950 border-zinc-800/60 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 translate-y-[2px] md:translate-y-0 md:-translate-x-1 z-0 shadow-inner',
                )}
                style={
                  isActive
                    ? {
                        // Blend top border of Card on desktop, bottom border on mobile
                        borderBottomColor: '#18181b',
                      }
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

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <Card className="bg-zinc-900 border-zinc-800 rounded-t-none md:rounded-t-lg md:rounded-r-none shadow-2xl relative z-20 min-h-[600px] p-6">
            {children}
          </Card>
        </div>
      </div>
    </div>
  );
}
