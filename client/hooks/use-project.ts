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
      // 3회 연속 호출 실패 시 또는 쿼리가 에러 상태인 경우 즉시 폴링 중단 (Short-circuiting)
      if (query.state.errorUpdateCount >= 3 || query.state.status === 'error') {
        return false;
      }
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
    retry: 1,
    retryDelay: 500,
  });

  const processMutation = useMutation({
    mutationFn: () => processProject(id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['project', id] });
      const previousProject = queryClient.getQueryData(['project', id]);
      if (previousProject) {
        queryClient.setQueryData(['project', id], {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(previousProject as any),
          status: 'processing',
          progress: 0,
        });
      }
      return { previousProject };
    },
    onError: (err, variables, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(['project', id], context.previousProject);
      }
    },
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
    stemsError: stemsQuery.error,
    processProject: processMutation.mutate,
    isProcessing: processMutation.isPending,
  };
}
