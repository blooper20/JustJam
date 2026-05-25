import { create } from 'zustand';
import { Project, StemFiles } from '../lib/api';

export interface ProjectState {
  // Sync state from TanStack Query
  project: Project | null;
  stems: StemFiles | null;
  setProject: (project: Project | null) => void;
  setStems: (stems: StemFiles | null) => void;

  // Playback Control States
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  loopStart: number | null;
  loopEnd: number | null;
  isLoopEnabled: boolean;
  bookmarks: number[];
  currentChord: string;

  // Metronome States
  bpm: number;
  inputBpm: number;
  metronomeEnabled: boolean;
  metronomeVolume: number;
  startOffsetSeconds: number;
  currentBeat: number;

  // Track Mix States (Track controls)
  trackVolumes: Record<string, number>;
  trackMutes: Record<string, boolean>;
  trackSolos: Record<string, boolean>;

  // Playback Setters
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (currentTime: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (playbackRate: number) => void;
  setLoopStart: (loopStart: number | null) => void;
  setLoopEnd: (loopEnd: number | null) => void;
  setIsLoopEnabled: (isLoopEnabled: boolean) => void;
  setBookmarks: (bookmarks: number[]) => void;
  addBookmark: (time: number) => void;
  removeBookmark: (time: number) => void;
  setCurrentChord: (chord: string) => void;

  // Metronome Setters
  setBpm: (bpm: number) => void;
  setInputBpm: (bpm: number) => void;
  setMetronomeEnabled: (enabled: boolean) => void;
  setMetronomeVolume: (volume: number) => void;
  setStartOffsetSeconds: (offset: number) => void;
  setCurrentBeat: (beat: number) => void;

  // Track Setters
  setTrackVolume: (trackName: string, volume: number) => void;
  setTrackMute: (trackName: string, isMuted: boolean) => void;
  setTrackSolo: (trackName: string, isSolo: boolean) => void;
  toggleTrackMute: (trackName: string) => void;
  toggleTrackSolo: (trackName: string) => void;

  // Reset helper
  resetPlayer: () => void;
}

const initialPlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1.0,
  loopStart: null,
  loopEnd: null,
  isLoopEnabled: false,
  bookmarks: [],
  currentChord: '',
  bpm: 120,
  inputBpm: 120,
  metronomeEnabled: false,
  metronomeVolume: 1.0,
  startOffsetSeconds: 0,
  currentBeat: -1,
  trackVolumes: {
    vocals: 0.8,
    bass: 0.8,
    drums: 0.8,
    guitar: 0.8,
    piano: 0.8,
    other: 0.8,
  },
  trackMutes: {},
  trackSolos: {},
};

export const useProjectStore = create<ProjectState>((set) => ({
  // Synced backend states
  project: null,
  stems: null,
  setProject: (project) => {
    set((state) => {
      // Sync BPM from project metadata if bpm has not been customized or initialized
      const nextBpm =
        project?.bpm && state.bpm === initialPlayerState.bpm ? project.bpm : state.bpm;
      const nextInputBpm =
        project?.bpm && state.inputBpm === initialPlayerState.inputBpm
          ? project.bpm
          : state.inputBpm;
      return {
        project,
        bpm: nextBpm,
        inputBpm: nextInputBpm,
      };
    });
  },
  setStems: (stems) => set({ stems }),

  // Playback control state
  ...initialPlayerState,

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setLoopStart: (loopStart) => set({ loopStart }),
  setLoopEnd: (loopEnd) => set({ loopEnd }),
  setIsLoopEnabled: (isLoopEnabled) => set({ isLoopEnabled }),
  setBookmarks: (bookmarks) => set({ bookmarks }),
  addBookmark: (time) =>
    set((state) => {
      if (state.bookmarks.includes(time)) return state;
      return { bookmarks: [...state.bookmarks, time].sort((a, b) => a - b) };
    }),
  removeBookmark: (time) =>
    set((state) => ({
      bookmarks: state.bookmarks.filter((t) => t !== time),
    })),
  setCurrentChord: (currentChord) => set({ currentChord }),

  // Metronome states
  setBpm: (bpm) => set({ bpm }),
  setInputBpm: (inputBpm) => set({ inputBpm }),
  setMetronomeEnabled: (metronomeEnabled) => set({ metronomeEnabled }),
  setMetronomeVolume: (metronomeVolume) => set({ metronomeVolume }),
  setStartOffsetSeconds: (startOffsetSeconds) => set({ startOffsetSeconds }),
  setCurrentBeat: (currentBeat) => set({ currentBeat }),

  // Track Mix actions
  setTrackVolume: (trackName, volume) =>
    set((state) => ({
      trackVolumes: { ...state.trackVolumes, [trackName]: volume },
    })),
  setTrackMute: (trackName, isMuted) =>
    set((state) => ({
      trackMutes: { ...state.trackMutes, [trackName]: isMuted },
    })),
  setTrackSolo: (trackName, isSolo) =>
    set((state) => ({
      trackSolos: { ...state.trackSolos, [trackName]: isSolo },
    })),
  toggleTrackMute: (trackName) =>
    set((state) => {
      const isMuted = !state.trackMutes[trackName];
      return {
        trackMutes: { ...state.trackMutes, [trackName]: isMuted },
      };
    }),
  toggleTrackSolo: (trackName) =>
    set((state) => {
      const targetSolo = !state.trackSolos[trackName];
      const newSolos = { ...state.trackSolos, [trackName]: targetSolo };

      // If setting solo to true, we can keep track of solos.
      // But we will handle volume calculations in the player component/effects.
      return {
        trackSolos: newSolos,
      };
    }),

  resetPlayer: () => set(initialPlayerState),
}));
