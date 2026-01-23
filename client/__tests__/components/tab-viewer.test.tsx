import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TabViewer } from '@/components/tab-viewer';
import * as api from '@/lib/api';
import '@testing-library/jest-dom';

// Mock API
jest.mock('@/lib/api');

describe('TabViewer', () => {
    const projectId = 'test-project';
    const mockTabData = {
        project_id: projectId,
        instrument: 'guitar',
        bpm: 120,
        tab: 'E|--0--|\nB|--0--|',
        notes_count: 10,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('초기 상태에는 생성 버튼을 표시한다', () => {
        render(<TabViewer projectId={projectId} />);
        expect(screen.getByText('Guitar Tab Not Generated')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /생성하기 \(Guitar\)/i })).toBeInTheDocument();
    });

    it('탭 전환이 정상적으로 동작한다', () => {
        render(<TabViewer projectId={projectId} />);

        const bassTabTrigger = screen.getByRole('tab', { name: /Bass Tab/i });
        fireEvent.click(bassTabTrigger);

        expect(screen.getByText('Bass Tab Not Generated')).toBeInTheDocument();
    });

    it('생성 버튼 클릭 시 API를 호출하고 타브를 표시한다', async () => {
        (api.generateTab as jest.Mock).mockResolvedValue(mockTabData);

        render(<TabViewer projectId={projectId} />);

        const generateButton = screen.getByRole('button', { name: /생성하기 \(Guitar\)/i });
        fireEvent.click(generateButton);

        expect(api.generateTab).toHaveBeenCalledWith(projectId, 'guitar');

        await waitFor(() => {
            expect(screen.getByText('E|--0--|')).toBeInTheDocument();
        });
    });

    it('복사 버튼 클릭 시 클립보드 API를 호출한다', async () => {
        (api.generateTab as jest.Mock).mockResolvedValue(mockTabData);
        // Mock clipboard
        Object.assign(navigator, {
            clipboard: {
                writeText: jest.fn().mockImplementation(() => Promise.resolve()),
            },
        });

        render(<TabViewer projectId={projectId} />);

        const generateButton = screen.getByRole('button', { name: /생성하기 \(Guitar\)/i });
        fireEvent.click(generateButton);

        await waitFor(() => expect(screen.getByText('Copy')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Copy'));
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockTabData.tab);
    });
});
