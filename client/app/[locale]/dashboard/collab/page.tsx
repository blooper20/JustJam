'use client';

import { useTeam } from '@/components/team-provider';
import { CollaborationBoard } from '@/components/collaboration-board';
import { ScheduleBoard } from '@/components/schedule-board';
import { BandMembersSidebar } from '@/components/band-members-sidebar';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchProjects } from '@/lib/api';
import { PracticeCalendar } from '@/components/practice-calendar';
import { useRouter } from 'next/navigation';
import { DashboardLayoutWrapper } from '@/components/dashboard-layout-wrapper';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Tab = 'notice' | 'schedule' | 'song' | 'practice';

export default function CollabDashboardPage() {
  const router = useRouter();
  const { selectedTeam, isLoading: teamLoading } = useTeam();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('notice');

  useEffect(() => {
    if (!teamLoading && !selectedTeam) {
      router.replace('/dashboard');
    }
  }, [teamLoading, selectedTeam, router]);

  const { data: projects } = useQuery({
    queryKey: ['projects', selectedTeam?.id],
    queryFn: () => fetchProjects({ team_id: selectedTeam?.id }),
    enabled: !!selectedTeam?.id,
  });

  if (teamLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!selectedTeam) return null;

  // Auto-select first project
  if (projects && projects.length > 0 && !selectedProjectId) {
    setSelectedProjectId(projects[0].id);
  }

  return (
    <DashboardLayoutWrapper activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as Tab)}>
      {activeTab === 'notice' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 h-full">
          <div className="xl:col-span-2">
            <CollaborationBoard teamId={selectedTeam.id} />
          </div>
          <div>
            <BandMembersSidebar teamId={selectedTeam.id} />
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 h-full">
          <div className="xl:col-span-2">
            <ScheduleBoard teamId={selectedTeam.id} />
          </div>
          <div>
            <BandMembersSidebar teamId={selectedTeam.id} />
          </div>
        </div>
      )}

      {activeTab === 'practice' && (
        <div className="space-y-4 h-full">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Practice Calendar</h2>
            <Select value={selectedProjectId || ''} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-[200px] bg-zinc-950 border-zinc-800">
                <SelectValue placeholder="Select a song..." />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
                {(!projects || projects.length === 0) && (
                  <SelectItem value="none" disabled>
                    No songs available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedProjectId ? (
            <PracticeCalendar projectId={selectedProjectId} teamId={selectedTeam?.id} />
          ) : (
            <div className="p-8 text-center border border-zinc-800 rounded-lg text-zinc-500 bg-zinc-950/50">
              Please select or upload a song to view practice logs.
            </div>
          )}
        </div>
      )}
    </DashboardLayoutWrapper>
  );
}
