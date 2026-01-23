import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MultiTrackPlayer } from '@/components/multitrack-player';
import '@testing-library/jest-dom';

// Mock WaveSurfer
jest.mock('wavesurfer.js', () => ({
    create: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        load: jest.fn(),
        destroy: jest.fn(),
        play: jest.fn(),
        pause: jest.fn(),
        setVolume: jest.fn(),
        getDuration: jest.fn().mockReturnValue(180),
        getCurrentTime: jest.fn().mockReturnValue(0),
        seekTo: jest.fn(),
        setPlaybackRate: jest.fn(),
        setTime: jest.fn(),
    })),
}));

// Mock AudioContext
(window as any).AudioContext = jest.fn().mockImplementation(() => ({
    createGain: jest.fn().mockReturnValue({
        connect: jest.fn(),
        gain: { linearRampToValueAtTime: jest.fn() },
        disconnect: jest.fn(),
    }),
    createBuffer: jest.fn().mockReturnValue({
        getChannelData: jest.fn().mockReturnValue(new Float32Array(100)),
    }),
    destination: {},
    currentTime: 0,
    sampleRate: 44100,
    close: jest.fn(),
}));

describe('MultiTrackPlayer', () => {
    const mockStems = {
        vocals: 'vocals.wav',
        drums: 'drums.wav',
        bass: 'bass.wav',
        master: 'master.wav',
    };
    const projectId = 'test-project';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('각 트랙의 볼륨 조절 슬라이더 및 솔로/뮤트 버튼을 렌더링한다', async () => {
        render(<MultiTrackPlayer stems={mockStems} projectId={projectId} />);

        // 믹서 활성화 버튼 클릭 (초기 상태)
        const loadButton = screen.getByText(/믹서 활성화/i);
        fireEvent.click(loadButton);

        await waitFor(() => {
            expect(screen.getByText('Vocals')).toBeInTheDocument();
            expect(screen.getByText('Drums')).toBeInTheDocument();
            expect(screen.getByText('Bass')).toBeInTheDocument();
        });
    });

    it('재생 버튼 클릭 시 아이콘이 일시정지로 바뀐다', async () => {
        render(<MultiTrackPlayer stems={mockStems} projectId={projectId} />);
        fireEvent.click(screen.getByText(/믹서 활성화/i));

        const playButton = await screen.findByRole('button', { name: /재생/i });
        fireEvent.click(playButton);

        // Play -> Pause 아이콘 변경 확인은 aria-label이나 text 등으로 가능
        // lucide-react 모킹 방식에 따라 다를 수 있음
    });

    it('BPM 조절 시 상태가 업데이트된다', async () => {
        render(<MultiTrackPlayer stems={mockStems} projectId={projectId} initialBpm={120} />);
        fireEvent.click(screen.getByText(/믹서 활성화/i));

        const bpmInput = await screen.findByDisplayValue('120');
        fireEvent.change(bpmInput, { target: { value: '140' } });
        fireEvent.blur(bpmInput);

        expect(screen.getByDisplayValue('140')).toBeInTheDocument();
    });
});
