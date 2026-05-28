import { createStore } from 'zustand/vanilla';

export type Phase = 'Menu' | 'Exercise' | 'Defense' | 'WaveClear' | 'GameOver';

export const EXERCISE_DURATION = 60;

export interface PhaseState {
  phase: Phase;
  round: number;
  exerciseTimeLeft: number;
  start: () => void;
  exerciseTimeout: () => void;
  startDefense: () => void;
  waveCleared: () => void;
  gameOver: () => void;
  nextRound: () => void;
  setPhase: (p: Phase) => void;
  tickTimer: (dt: number) => void;
}

export const phaseStore = createStore<PhaseState>()((set, get) => ({
  phase: 'Menu',
  round: 1,
  exerciseTimeLeft: EXERCISE_DURATION,

  start: () => {
    if (get().phase !== 'Menu') return;
    set({ phase: 'Exercise', exerciseTimeLeft: EXERCISE_DURATION });
  },

  exerciseTimeout: () => {
    if (get().phase !== 'Exercise') return;
    set({ phase: 'Defense' });
  },

  startDefense: () => {
    if (get().phase !== 'Exercise') return;
    set({ phase: 'Defense' });
  },

  waveCleared: () => {
    if (get().phase !== 'Defense') return;
    set((s) => ({ phase: 'WaveClear', round: s.round + 1 }));
  },

  gameOver: () => {
    if (get().phase !== 'Defense') return;
    set({ phase: 'GameOver' });
  },

  nextRound: () => {
    if (get().phase !== 'WaveClear') return;
    set({ phase: 'Exercise', exerciseTimeLeft: EXERCISE_DURATION });
  },

  setPhase: (p: Phase) => set({ phase: p }),

  tickTimer: (dt: number) => {
    const s = get();
    if (s.phase !== 'Exercise') return;
    if (s.exerciseTimeLeft <= 0) return;
    const next = Math.max(0, s.exerciseTimeLeft - dt);
    set({ exerciseTimeLeft: next });
    if (next === 0) {
      get().exerciseTimeout();
    }
  },
}));
