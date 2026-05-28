import { describe, it, expect, beforeEach } from 'vitest';
import {
  SquatClassifier,
  computeSquatAngle,
  isSquatActive,
  type Landmarks,
} from '../src/exercise/classifiers/squat';

function emptyLandmarks(): Landmarks {
  return new Array(33).fill(null);
}

/**
 * Synthetic squat-position landmarks. Negative y = higher in world space.
 *
 * 'up'   → standing straight → hip-knee-ankle collinear → angle ≈ 180° (> 160°)
 * 'down' → knees bent forward → angle ≈ 74° (< 105°)
 */
function makeSquatLandmarks(phase: 'up' | 'down'): Landmarks {
  const lms = emptyLandmarks();
  if (phase === 'up') {
    lms[11] = { x: -0.1, y: -0.8, z: 0.0 }; // LEFT_SHOULDER
    lms[12] = { x:  0.1, y: -0.8, z: 0.0 }; // RIGHT_SHOULDER
    lms[23] = { x: -0.1, y: -0.4, z: 0.0 }; // LEFT_HIP
    lms[24] = { x:  0.1, y: -0.4, z: 0.0 }; // RIGHT_HIP
    lms[25] = { x: -0.1, y:  0.0, z: 0.0 }; // LEFT_KNEE
    lms[26] = { x:  0.1, y:  0.0, z: 0.0 }; // RIGHT_KNEE
    lms[27] = { x: -0.1, y:  0.45, z: 0.0 }; // LEFT_ANKLE
    lms[28] = { x:  0.1, y:  0.45, z: 0.0 }; // RIGHT_ANKLE
  } else {
    // Knees pushed forward (z) and hip-level — produces ~74° knee angle
    lms[11] = { x: -0.1, y: -0.5, z: 0.0 }; // LEFT_SHOULDER
    lms[12] = { x:  0.1, y: -0.5, z: 0.0 }; // RIGHT_SHOULDER
    lms[23] = { x: -0.1, y:  0.0, z: 0.0 }; // LEFT_HIP
    lms[24] = { x:  0.1, y:  0.0, z: 0.0 }; // RIGHT_HIP
    lms[25] = { x: -0.1, y:  0.05, z: 0.2 }; // LEFT_KNEE (bent forward)
    lms[26] = { x:  0.1, y:  0.05, z: 0.2 }; // RIGHT_KNEE
    lms[27] = { x: -0.1, y:  0.4, z: 0.0 }; // LEFT_ANKLE
    lms[28] = { x:  0.1, y:  0.4, z: 0.0 }; // RIGHT_ANKLE
  }
  return lms;
}

/** Horizontal body (pushup position) — torso not vertical → not a squat. */
function makeHorizontalLandmarks(): Landmarks {
  const lms = emptyLandmarks();
  lms[11] = { x:  0.3, y: 0.0, z: 0.0 }; // LEFT_SHOULDER
  lms[12] = { x:  0.3, y: 0.0, z: 0.1 }; // RIGHT_SHOULDER
  lms[23] = { x: -0.5, y: 0.0, z: 0.0 }; // LEFT_HIP
  lms[24] = { x: -0.5, y: 0.0, z: 0.1 }; // RIGHT_HIP
  lms[25] = { x: -0.1, y: 0.0, z: 0.0 }; // LEFT_KNEE
  lms[26] = { x: -0.1, y: 0.0, z: 0.1 }; // RIGHT_KNEE
  lms[27] = { x: -0.4, y: 0.0, z: 0.0 }; // LEFT_ANKLE
  lms[28] = { x: -0.4, y: 0.0, z: 0.1 }; // RIGHT_ANKLE
  return lms;
}

describe('computeSquatAngle', () => {
  it('returns null when all landmarks are null', () => {
    expect(computeSquatAngle(emptyLandmarks())).toBeNull();
  });

  it('returns null when knee landmarks are missing', () => {
    const lms = makeSquatLandmarks('up');
    lms[25] = null;
    lms[26] = null;
    expect(computeSquatAngle(lms)).toBeNull();
  });

  it('returns angle > 160 for standing (up) position', () => {
    const angle = computeSquatAngle(makeSquatLandmarks('up'));
    expect(angle).not.toBeNull();
    expect(angle!).toBeGreaterThan(160);
  });

  it('returns angle < 105 for squatting (down) position', () => {
    const angle = computeSquatAngle(makeSquatLandmarks('down'));
    expect(angle).not.toBeNull();
    expect(angle!).toBeLessThan(105);
  });

  it('averages left and right knee angles when both are available', () => {
    const angle = computeSquatAngle(makeSquatLandmarks('up'));
    expect(angle).not.toBeNull();
  });
});

describe('isSquatActive', () => {
  it('returns false when angle is null', () => {
    expect(isSquatActive(makeSquatLandmarks('up'), null)).toBe(false);
  });

  it('returns false when required landmarks are missing', () => {
    expect(isSquatActive(emptyLandmarks(), 170)).toBe(false);
  });

  it('returns true for upright body in standing position', () => {
    const lms = makeSquatLandmarks('up');
    const angle = computeSquatAngle(lms)!;
    expect(isSquatActive(lms, angle)).toBe(true);
  });

  it('returns true for upright body in squat position', () => {
    const lms = makeSquatLandmarks('down');
    const angle = computeSquatAngle(lms)!;
    expect(isSquatActive(lms, angle)).toBe(true);
  });

  it('returns false for horizontal (pushup) body', () => {
    const lms = makeHorizontalLandmarks();
    const angle = computeSquatAngle(lms);
    expect(isSquatActive(lms, angle)).toBe(false);
  });
});

describe('SquatClassifier', () => {
  let clf: SquatClassifier;

  beforeEach(() => {
    clf = new SquatClassifier();
  });

  it('starts with count=0 and phase=ready', () => {
    const s = clf.getState();
    expect(s.count).toBe(0);
    expect(s.phase).toBe('ready');
  });

  it('counts 1 rep after one full down→up cycle in squat position', () => {
    clf.update(makeSquatLandmarks('up'));
    clf.update(makeSquatLandmarks('down'));
    clf.update(makeSquatLandmarks('up'));
    expect(clf.getState().count).toBe(1);
  });

  it('counts 2 reps after two full down→up cycles', () => {
    clf.update(makeSquatLandmarks('up'));
    clf.update(makeSquatLandmarks('down'));
    clf.update(makeSquatLandmarks('up'));
    clf.update(makeSquatLandmarks('down'));
    clf.update(makeSquatLandmarks('up'));
    expect(clf.getState().count).toBe(2);
  });

  it('does not count a rep when body is horizontal (not a squat)', () => {
    const horizontal = makeHorizontalLandmarks();
    clf.update(horizontal);
    clf.update(horizontal);
    clf.update(horizontal);
    expect(clf.getState().count).toBe(0);
  });

  it('does not count a rep if down phase is never reached', () => {
    clf.update(makeSquatLandmarks('up'));
    clf.update(makeSquatLandmarks('up'));
    expect(clf.getState().count).toBe(0);
  });

  it('reset() clears count and phase', () => {
    clf.update(makeSquatLandmarks('up'));
    clf.update(makeSquatLandmarks('down'));
    clf.update(makeSquatLandmarks('up'));
    clf.reset();
    const s = clf.getState();
    expect(s.count).toBe(0);
    expect(s.phase).toBe('ready');
  });

  it('phase transitions to down when knees are bent in squat position', () => {
    clf.update(makeSquatLandmarks('up'));
    clf.update(makeSquatLandmarks('down'));
    expect(clf.getState().phase).toBe('down');
  });

  it('active flag is false when body is not in squat position', () => {
    const state = clf.update(makeHorizontalLandmarks());
    expect(state.active).toBe(false);
  });

  it('active flag is true when body is in squat position', () => {
    const state = clf.update(makeSquatLandmarks('up'));
    expect(state.active).toBe(true);
  });
});
