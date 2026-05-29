import { createStore } from 'zustand/vanilla';

export type Phase = 'Menu' | 'Exercise' | 'Build' | 'Defense' | 'WaveClear' | 'GameOver';

export const EXERCISE_DURATION = 60;
export const INITIAL_LIVES = 20;

export interface PhaseState {
  phase: Phase;
  round: number;
  exerciseTimeLeft: number;
  lives: number;
  start: () => void;
  exerciseTimeout: () => void;
  startBuild: () => void;
  startWave: () => void;
  waveCleared: () => void;
  gameOver: () => void;
  loseLife: () => void;
  nextRound: () => void;
  setPhase: (p: Phase) => void;
  tickTimer: (dt: number) => void;
}

export const phaseStore = createStore<PhaseState>()((set, get) => ({
  phase: 'Menu',
  round: 1,
  exerciseTimeLeft: EXERCISE_DURATION,
  lives: INITIAL_LIVES,

  start: () => {
    if (get().phase !== 'Menu') return;
    set({ phase: 'Exercise', exerciseTimeLeft: EXERCISE_DURATION });
  },

  exerciseTimeout: () => {
    if (get().phase !== 'Exercise') return;
    set({ phase: 'Build' });
  },

  startBuild: () => {
    if (get().phase !== 'Exercise') return;
    set({ phase: 'Build' });
  },

  startWave: () => {
    if (get().phase !== 'Build') return;
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

  loseLife: () => {
    const s = get();
    if (s.phase !== 'Defense') return;
    const next = s.lives - 1;
    if (next <= 0) {
      set({ lives: 0 });
      get().gameOver();
    } else {
      set({ lives: next });
    }
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
