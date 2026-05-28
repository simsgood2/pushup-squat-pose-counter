import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeDepthBonus,
  computeComboMultiplier,
  computeGold,
  RewardTracker,
  goldStore,
  BASE_GOLD,
  type ExerciseType,
} from '../src/exercise/rewards';
import { PUSHUP_DOWN_ANGLE } from '../src/exercise/classifiers/pushup';
import { SQUAT_DOWN_ANGLE } from '../src/exercise/classifiers/squat';
import { LUNGE_DOWN_ANGLE } from '../src/exercise/classifiers/lunge';

// ─── computeDepthBonus ────────────────────────────────────────────────────────

describe('computeDepthBonus', () => {
  it('returns 1.0 when angle is null', () => {
    expect(computeDepthBonus('pushup', null)).toBe(1.0);
  });

  it('returns 1.0 for jump (no depth config)', () => {
    expect(computeDepthBonus('jump', 0.05)).toBe(1.0);
  });

  it('returns 1.0 for jumpingJack (no depth config)', () => {
    expect(computeDepthBonus('jumpingJack', null)).toBe(1.0);
  });

  it('returns 1.0 when pushup angle equals downAngle (no extra depth)', () => {
    expect(computeDepthBonus('pushup', PUSHUP_DOWN_ANGLE)).toBeCloseTo(1.0, 5);
  });

  it('returns 1.5 when pushup angle is 45° below downAngle', () => {
    expect(computeDepthBonus('pushup', PUSHUP_DOWN_ANGLE - 45)).toBeCloseTo(1.5, 5);
  });

  it('caps at 1.5 for pushup even when angle is 0', () => {
    expect(computeDepthBonus('pushup', 0)).toBe(1.5);
  });

  it('returns between 1.0 and 1.5 for intermediate pushup angle', () => {
    const bonus = computeDepthBonus('pushup', PUSHUP_DOWN_ANGLE - 22);
    expect(bonus).toBeGreaterThan(1.0);
    expect(bonus).toBeLessThan(1.5);
  });

  it('returns 1.0 when squat angle equals downAngle', () => {
    expect(computeDepthBonus('squat', SQUAT_DOWN_ANGLE)).toBeCloseTo(1.0, 5);
  });

  it('returns 1.5 when squat angle is 45° below downAngle', () => {
    expect(computeDepthBonus('squat', SQUAT_DOWN_ANGLE - 45)).toBeCloseTo(1.5, 5);
  });

  it('returns 1.5 when lunge angle is 40° below downAngle', () => {
    expect(computeDepthBonus('lunge', LUNGE_DOWN_ANGLE - 40)).toBeCloseTo(1.5, 5);
  });

  it('does not produce bonus above downAngle (angle too shallow)', () => {
    expect(computeDepthBonus('pushup', PUSHUP_DOWN_ANGLE + 10)).toBe(1.0);
  });
});

// ─── computeComboMultiplier ───────────────────────────────────────────────────

describe('computeComboMultiplier', () => {
  it('returns 1.0 for comboCount=1', () => {
    expect(computeComboMultiplier(1)).toBe(1.0);
  });

  it('returns 1.0 for comboCount=2', () => {
    expect(computeComboMultiplier(2)).toBe(1.0);
  });

  it('returns 1.2 for comboCount=3', () => {
    expect(computeComboMultiplier(3)).toBeCloseTo(1.2, 5);
  });

  it('returns 1.2 for comboCount=4', () => {
    expect(computeComboMultiplier(4)).toBeCloseTo(1.2, 5);
  });

  it('returns 1.2 for comboCount=5', () => {
    expect(computeComboMultiplier(5)).toBeCloseTo(1.2, 5);
  });

  it('returns 1.4 for comboCount=6', () => {
    expect(computeComboMultiplier(6)).toBeCloseTo(1.4, 5);
  });

  it('returns 1.6 for comboCount=9', () => {
    expect(computeComboMultiplier(9)).toBeCloseTo(1.6, 5);
  });

  it('returns 1.8 for comboCount=12', () => {
    expect(computeComboMultiplier(12)).toBeCloseTo(1.8, 5);
  });

  it('returns 2.0 for comboCount=15', () => {
    expect(computeComboMultiplier(15)).toBeCloseTo(2.0, 5);
  });

  it('caps at 2.0 for very large comboCount', () => {
    expect(computeComboMultiplier(100)).toBe(2.0);
  });
});

// ─── computeGold ─────────────────────────────────────────────────────────────

describe('computeGold', () => {
  it('returns base gold with no depth bonus and no combo', () => {
    // angle above downAngle → no depth, comboCount=1 → no combo
    expect(computeGold('pushup', PUSHUP_DOWN_ANGLE + 20, 1)).toBe(BASE_GOLD.pushup);
  });

  it('applies depth bonus for pushup at max depth', () => {
    const expected = Math.round(BASE_GOLD.pushup * 1.5 * 1.0);
    expect(computeGold('pushup', PUSHUP_DOWN_ANGLE - 45, 1)).toBe(expected);
  });

  it('applies combo multiplier at comboCount=3', () => {
    const expected = Math.round(BASE_GOLD.squat * 1.0 * 1.2);
    expect(computeGold('squat', null, 3)).toBe(expected);
  });

  it('applies both depth and combo bonuses', () => {
    const depth = computeDepthBonus('lunge', LUNGE_DOWN_ANGLE - 20);
    const combo = computeComboMultiplier(6);
    const expected = Math.round(BASE_GOLD.lunge * depth * combo);
    expect(computeGold('lunge', LUNGE_DOWN_ANGLE - 20, 6)).toBe(expected);
  });

  it('returns base gold for jump regardless of angle', () => {
    expect(computeGold('jump', 0.5, 1)).toBe(BASE_GOLD.jump);
  });

  it('returns base gold for jumpingJack', () => {
    expect(computeGold('jumpingJack', null, 1)).toBe(BASE_GOLD.jumpingJack);
  });

  it('caps combo at 2.0x for extreme combo', () => {
    const expected = Math.round(BASE_GOLD.pushup * 1.0 * 2.0);
    expect(computeGold('pushup', PUSHUP_DOWN_ANGLE + 10, 100)).toBe(expected);
  });
});

// ─── RewardTracker ────────────────────────────────────────────────────────────

describe('RewardTracker', () => {
  let tracker: RewardTracker;

  beforeEach(() => {
    tracker = new RewardTracker();
  });

  it('starts with comboCount=0 and variety=0', () => {
    expect(tracker.getComboCount()).toBe(0);
    expect(tracker.getVarietyCount()).toBe(0);
  });

  it('first rep returns comboCount=1 and base gold', () => {
    const { gold, comboCount } = tracker.recordRep('squat', null);
    expect(comboCount).toBe(1);
    expect(gold).toBe(BASE_GOLD.squat);
  });

  it('increments comboCount for consecutive same exercise', () => {
    tracker.recordRep('pushup', null);
    tracker.recordRep('pushup', null);
    const { comboCount } = tracker.recordRep('pushup', null);
    expect(comboCount).toBe(3);
  });

  it('resets comboCount to 1 when exercise type changes', () => {
    tracker.recordRep('pushup', null);
    tracker.recordRep('pushup', null);
    const { comboCount } = tracker.recordRep('squat', null);
    expect(comboCount).toBe(1);
  });

  it('awards 1.2x on 3rd consecutive rep', () => {
    tracker.recordRep('jump', null);
    tracker.recordRep('jump', null);
    const { gold } = tracker.recordRep('jump', null);
    expect(gold).toBe(Math.round(BASE_GOLD.jump * 1.2));
  });

  it('tracks variety count', () => {
    tracker.recordRep('pushup', null);
    tracker.recordRep('squat', null);
    tracker.recordRep('jump', null);
    expect(tracker.getVarietyCount()).toBe(3);
  });

  it('does not double-count repeated exercise types in variety', () => {
    tracker.recordRep('pushup', null);
    tracker.recordRep('pushup', null);
    tracker.recordRep('squat', null);
    expect(tracker.getVarietyCount()).toBe(2);
  });

  it('reset() clears combo, variety, and last exercise', () => {
    tracker.recordRep('pushup', null);
    tracker.recordRep('pushup', null);
    tracker.reset();
    expect(tracker.getComboCount()).toBe(0);
    expect(tracker.getVarietyCount()).toBe(0);
    // After reset, same exercise starts fresh combo
    const { comboCount } = tracker.recordRep('pushup', null);
    expect(comboCount).toBe(1);
  });

  it('accumulates gold correctly over multiple reps', () => {
    let totalGold = 0;
    // 4 pushups: reps 1,2 at 1.0x; rep 3 at 1.2x; rep 4 at 1.2x
    for (let i = 0; i < 4; i++) {
      totalGold += tracker.recordRep('pushup', null).gold;
    }
    const expected =
      BASE_GOLD.pushup * 1 +  // rep 1: combo=1 → 1.0x
      BASE_GOLD.pushup * 1 +  // rep 2: combo=2 → 1.0x
      Math.round(BASE_GOLD.pushup * 1.2) +  // rep 3: combo=3 → 1.2x
      Math.round(BASE_GOLD.pushup * 1.2);   // rep 4: combo=4 → 1.2x
    expect(totalGold).toBe(expected);
  });
});

// ─── goldStore ────────────────────────────────────────────────────────────────

describe('goldStore', () => {
  beforeEach(() => {
    goldStore.getState().reset();
  });

  it('starts with gold=0, combo=0, variety=0', () => {
    const s = goldStore.getState();
    expect(s.gold).toBe(0);
    expect(s.combo).toBe(0);
    expect(s.variety).toBe(0);
  });

  it('addGold accumulates gold', () => {
    goldStore.getState().addGold(10, 1, 1);
    goldStore.getState().addGold(8, 2, 2);
    expect(goldStore.getState().gold).toBe(18);
  });

  it('addGold updates combo and variety', () => {
    goldStore.getState().addGold(12, 3, 2);
    const s = goldStore.getState();
    expect(s.combo).toBe(3);
    expect(s.variety).toBe(2);
  });

  it('reset() zeroes gold, combo, and variety', () => {
    goldStore.getState().addGold(100, 5, 3);
    goldStore.getState().reset();
    const s = goldStore.getState();
    expect(s.gold).toBe(0);
    expect(s.combo).toBe(0);
    expect(s.variety).toBe(0);
  });
});
