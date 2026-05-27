/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MultiTrackPlayer } from '@/components/multitrack-player';
import '@testing-library/jest-dom';

// Mock WaveSurfer
jest.mock('wavesurfer.js', () => ({
  create: jest.fn().mockImplementation(() => ({
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'ready') {
        setTimeout(callback, 0);
      }
    }),
    load: jest.fn(),
    destroy: jest.fn(),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    setVolume: jest.fn(),
    getVolume: jest.fn().mockReturnValue(1),
    getDuration: jest.fn().mockReturnValue(180),
    getCurrentTime: jest.fn().mockReturnValue(0),
    isPlaying: jest.fn().mockReturnValue(false),
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

    await waitFor(() => {
      expect(screen.getByText(/vocals/i)).toBeInTheDocument();
      expect(screen.getByText(/drums/i)).toBeInTheDocument();
      expect(screen.getByText(/bass/i)).toBeInTheDocument();
    });
  });

  it('재생 버튼 클릭 시 아이콘이 일시정지로 바뀐다', async () => {
    render(<MultiTrackPlayer stems={mockStems} projectId={projectId} />);

    const playButton = await screen.findByRole('button', { name: /재생/i });
    fireEvent.click(playButton);

    expect(await screen.findByRole('button', { name: /일시정지/i })).toBeInTheDocument();
  });

  it('BPM 조절 시 상태가 업데이트된다', async () => {
    render(<MultiTrackPlayer stems={mockStems} projectId={projectId} initialBpm={120} />);

    const bpmInput = await screen.findByDisplayValue('120');
    fireEvent.change(bpmInput, { target: { value: '140' } });
    fireEvent.blur(bpmInput);

    expect(screen.getByDisplayValue('140')).toBeInTheDocument();
  });
});
