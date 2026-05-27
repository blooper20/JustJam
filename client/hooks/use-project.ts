import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProject, processProject, fetchProjectStems } from '@/lib/api';
import { useProjectStore } from '@/store/project-store';

export function useProject(id: string) {
  const queryClient = useQueryClient();
  const { setProject, setStems } = useProjectStore();

  const projectQuery = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 1000; // 데이터가 아직 없을 때는 폴링 시작을 위해 대기
      const status = data.status;
      if (status === 'completed' || status === 'failed') {
        return false; // 작업 완료/실패 시 즉시 폴링 단락
      }
      return status === 'pending' || status === 'processing' ? 1000 : false;
    },
    retry: 3,
    retryDelay: 1000,
  });

  const stemsQuery = useQuery({
    queryKey: ['project', id, 'stems'],
    queryFn: () => fetchProjectStems(id),
    enabled: projectQuery.data?.status === 'completed',
  });

  const processMutation = useMutation({
    mutationFn: () => processProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  // Sync to Zustand Store
  useEffect(() => {
    if (projectQuery.data) {
      setProject(projectQuery.data);
    }
  }, [projectQuery.data, setProject]);

  useEffect(() => {
    if (stemsQuery.data) {
      setStems(stemsQuery.data);
    }
  }, [stemsQuery.data, setStems]);

  return {
    project: projectQuery.data,
    isLoading: projectQuery.isLoading,
    error: projectQuery.error,
    stems: stemsQuery.data,
    isLoadingStems: stemsQuery.isLoading,
    processProject: processMutation.mutate,
    isProcessing: processMutation.isPending,
  };
}
