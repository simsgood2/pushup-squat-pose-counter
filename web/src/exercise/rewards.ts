import { createStore } from 'zustand/vanilla';
import { PUSHUP_DOWN_ANGLE } from './classifiers/pushup';
import { SQUAT_DOWN_ANGLE } from './classifiers/squat';
import { LUNGE_DOWN_ANGLE } from './classifiers/lunge';

export type ExerciseType = 'pushup' | 'squat' | 'jump' | 'lunge' | 'jumpingJack';

export const BASE_GOLD: Record<ExerciseType, number> = {
  pushup: 10,
  squat: 8,
  jump: 5,
  lunge: 12,
  jumpingJack: 4,
};

interface DepthConfig {
  downAngle: number;
  maxDeepRange: number;
}

const DEPTH_BONUS_CONFIG: Partial<Record<ExerciseType, DepthConfig>> = {
  pushup: { downAngle: PUSHUP_DOWN_ANGLE, maxDeepRange: 45 },
  squat:  { downAngle: SQUAT_DOWN_ANGLE,  maxDeepRange: 45 },
  lunge:  { downAngle: LUNGE_DOWN_ANGLE,  maxDeepRange: 40 },
};

/** 1.0 ~ 1.5: angle below down threshold adds up to 50% bonus. */
export function computeDepthBonus(type: ExerciseType, angle: number | null): number {
  if (angle === null) return 1.0;
  const cfg = DEPTH_BONUS_CONFIG[type];
  if (!cfg) return 1.0;
  const extra = Math.max(0, cfg.downAngle - angle);
  return 1.0 + 0.5 * Math.min(1, extra / cfg.maxDeepRange);
}

/**
 * 1.0 ~ 2.0: every 3 consecutive reps of the same exercise adds +0.2 multiplier.
 * comboCount is 1-based (1 = first rep, 3 = third consecutive rep).
 */
export function computeComboMultiplier(comboCount: number): number {
  return Math.min(2.0, 1.0 + 0.2 * Math.floor(comboCount / 3));
}

/** Gold for a single rep, rounded to nearest integer. */
export function computeGold(
  type: ExerciseType,
  angle: number | null,
  comboCount: number
): number {
  return Math.round(BASE_GOLD[type] * computeDepthBonus(type, angle) * computeComboMultiplier(comboCount));
}

export class RewardTracker {
  private _comboCount = 0;
  private _lastExercise: ExerciseType | null = null;
  private _variety = new Set<ExerciseType>();

  recordRep(type: ExerciseType, angle: number | null = null): { gold: number; comboCount: number } {
    if (type === this._lastExercise) {
      this._comboCount++;
    } else {
      this._comboCount = 1;
      this._lastExercise = type;
    }
    this._variety.add(type);
    const gold = computeGold(type, angle, this._comboCount);
    return { gold, comboCount: this._comboCount };
  }

  getVarietyCount(): number {
    return this._variety.size;
  }

  getComboCount(): number {
    return this._comboCount;
  }

  reset(): void {
    this._comboCount = 0;
    this._lastExercise = null;
    this._variety = new Set();
  }
}

export interface GoldState {
  gold: number;
  combo: number;
  variety: number;
  addGold: (amount: number, combo: number, variety: number) => void;
  spendGold: (amount: number) => boolean;
  reset: () => void;
}

export const goldStore = createStore<GoldState>()((set, get) => ({
  gold: 0,
  combo: 0,
  variety: 0,
  addGold: (amount, combo, variety) =>
    set((s) => ({ gold: s.gold + amount, combo, variety })),
  spendGold: (amount) => {
    const { gold } = get();
    if (gold < amount) return false;
    set({ gold: gold - amount });
    return true;
  },
  reset: () => set({ gold: 0, combo: 0, variety: 0 }),
}));
