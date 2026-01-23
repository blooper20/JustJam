import { renderHook, waitFor } from '@testing-library/react';
import { useProject } from '@/hooks/use-project';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@/lib/api';
import React from 'react';

// Mock API
jest.mock('@/lib/api');

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client= { queryClient } > { children } </QueryClientProvider>
  );
};

describe('useProject', () => {
    const projectId = 'test-id';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('프로젝트 데이터를 성공적으로 불러온다', async () => {
        const mockProject = { id: projectId, name: 'Test Project', status: 'pending' };
        (api.fetchProject as jest.Mock).mockResolvedValue(mockProject);

        const { result } = renderHook(() => useProject(projectId), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.project).toEqual(mockProject);
        });
        expect(result.current.isLoading).toBe(false);
    });

    it('프로젝트가 완료 상태이면 스템 데이터를 불러온다', async () => {
        const mockProject = { id: projectId, name: 'Test Project', status: 'completed' };
        const mockStems = { vocals: 'vocals.wav', bass: 'bass.wav' };

        (api.fetchProject as jest.Mock).mockResolvedValue(mockProject);
        (api.fetchProjectStems as jest.Mock).mockResolvedValue(mockStems);

        const { result } = renderHook(() => useProject(projectId), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.stems).toEqual(mockStems);
        });
    });

    it('processProject 호출 시 API를 호출한다', async () => {
        const mockProject = { id: projectId, status: 'pending' };
        (api.fetchProject as jest.Mock).mockResolvedValue(mockProject);
        (api.processProject as jest.Mock).mockResolvedValue({ ...mockProject, status: 'processing' });

        const { result } = renderHook(() => useProject(projectId), {
            wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        result.current.processProject();

        await waitFor(() => {
            expect(api.processProject).toHaveBeenCalledWith(projectId);
        });
    });
});
