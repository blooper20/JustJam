import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScoreViewer } from '@/components/score-viewer';
import * as api from '@/lib/api';
import '@testing-library/jest-dom';

// Mock OSMD
jest.mock('opensheetmusicdisplay', () => ({
    OpenSheetMusicDisplay: jest.fn().mockImplementation(() => ({
        load: jest.fn().mockResolvedValue(true),
        render: jest.fn(),
        cursor: {
            show: jest.fn(),
            hide: jest.fn(),
            reset: jest.fn(),
            next: jest.fn(),
            iterator: { currentMeasureIndex: 0 },
        },
        Zoom: 1,
    })),
}));

// Mock API
jest.mock('@/lib/api');

describe('ScoreViewer', () => {
    const projectId = 'test-project';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('초기 상태에는 악보 생성 안내 메시지를 표시한다', () => {
        render(<ScoreViewer projectId={projectId} />);
        expect(screen.getByText('상단에서 악기를 선택하고 버튼을 눌러주세요.')).toBeInTheDocument();
    });

    it('악보 생성 버튼 클릭 시 API를 호출하고 로딩 상태를 표시한다', async () => {
        (api.generateScore as jest.Mock).mockResolvedValue('<xml></xml>');

        render(<ScoreViewer projectId={projectId} />);

        const generateButton = screen.getByRole('button', { name: /악보 생성/i });
        fireEvent.click(generateButton);

        expect(screen.getByText('악보 생성 중...')).toBeInTheDocument();
        expect(api.generateScore).toHaveBeenCalledWith(projectId, 'vocals');

        await waitFor(() => {
            expect(screen.queryByText('악보 생성 중...')).not.toBeInTheDocument();
        });
    });

    it('autoLoad가 true이고 기존 악보가 있으면 자동으로 불러온다', async () => {
        (api.generateScore as jest.Mock).mockResolvedValue('<xml></xml>');

        render(
            <ScoreViewer
                projectId={projectId}
                autoLoad={true}
                existingInstruments={['guitar']}
            />
        );

        await waitFor(() => {
            expect(api.generateScore).toHaveBeenCalledWith(projectId, 'guitar');
        });
    });
});
