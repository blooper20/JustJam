'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProjectsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/collab?tab=song');
  }, [router]);

  return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}
