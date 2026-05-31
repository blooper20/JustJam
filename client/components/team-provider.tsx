'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { fetchTeams, Team } from '@/lib/api';

interface TeamContextType {
  teams: Team[];
  selectedTeam: Team | null;
  setSelectedTeamId: (id: number) => void;
  isLoading: boolean;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: fetchTeams,
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 30_000,
  });

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null;

  // While session is still loading, treat as loading too
  const loading = status === 'loading' || (isAuthenticated && isLoading);

  return (
    <TeamContext.Provider value={{ teams, selectedTeam, setSelectedTeamId, isLoading: loading }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}
