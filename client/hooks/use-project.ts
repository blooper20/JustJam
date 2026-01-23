import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProject, processProject, fetchProjectStems } from '@/lib/api';

export function useProject(id: string) {
    const queryClient = useQueryClient();

    const projectQuery = useQuery({
        queryKey: ['project', id],
        queryFn: () => fetchProject(id),
        refetchInterval: (query) => (query.state.data?.status === 'processing' ? 1000 : false),
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
