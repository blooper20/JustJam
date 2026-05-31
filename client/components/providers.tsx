'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState, ReactNode } from 'react';

import { TeamProvider } from '@/components/team-provider';

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <TeamProvider>{children}</TeamProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
