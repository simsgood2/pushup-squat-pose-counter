import { describe, it, expect, beforeEach } from 'vitest';
import {
  LungeClassifier,
  computeLungeAngle,
  isLungeActive,
  LUNGE_DOWN_ANGLE,
  LUNGE_UP_ANGLE,
  type Landmarks,
} from '../src/exercise/classifiers/lunge';

function emptyLandmarks(): Landmarks {
  return new Array(33).fill(null);
}

/**
 * Lunge landmarks.
 *
 * 'down': front (left) knee angle ≈ 104.7° (< 110°), back (right) knee = 180°.
 *         Large z-separation between knees (0.55m).
 * 'up':   both knees straight (180°), z-separation still present (0.3m).
 */
function makeLungeLandmarks(phase: 'up' | 'down'): Landmarks {
  const lms = emptyLandmarks();

  if (phase === 'down') {
    // Front (left) leg — knee bent forward producing ~104.7°
    lms[23] = { x: -0.1, y: -0.3,  z: 0.3  }; // LEFT_HIP
    lms[25] = { x: -0.1, y:  0.05, z: 0.55 }; // LEFT_KNEE (bent forward)
    lms[27] = { x: -0.1, y:  0.35, z: 0.3  }; // LEFT_ANKLE
    // Back (right) leg — straight
    lms[24] = { x:  0.1, y: -0.3,  z: 0.0  }; // RIGHT_HIP
    lms[26] = { x:  0.1, y:  0.1,  z: 0.0  }; // RIGHT_KNEE
    lms[28] = { x:  0.1, y:  0.5,  z: 0.0  }; // RIGHT_ANKLE
  } else {
    // Both legs straight (≈180°) but z-separated so lunge is still active
    lms[23] = { x: -0.1, y: -0.4,  z: 0.3  }; // LEFT_HIP
    lms[25] = { x: -0.1, y:  0.0,  z: 0.3  }; // LEFT_KNEE
    lms[27] = { x: -0.1, y:  0.45, z: 0.3  }; // LEFT_ANKLE
    lms[24] = { x:  0.1, y: -0.4,  z: 0.0  }; // RIGHT_HIP
    lms[26] = { x:  0.1, y:  0.0,  z: 0.0  }; // RIGHT_KNEE
    lms[28] = { x:  0.1, y:  0.45, z: 0.0  }; // RIGHT_ANKLE
  }
  return lms;
}

/** Standing: both knees at z=0 (no depth separation → not a lunge). */
function makeStandingLandmarks(): Landmarks {
  const lms = emptyLandmarks();
  lms[23] = { x: -0.1, y: -0.4, z: 0.0 }; // LEFT_HIP
  lms[25] = { x: -0.1, y:  0.0, z: 0.0 }; // LEFT_KNEE
  lms[27] = { x: -0.1, y:  0.45, z: 0.0 }; // LEFT_ANKLE
  lms[24] = { x:  0.1, y: -0.4, z: 0.0 }; // RIGHT_HIP
  lms[26] = { x:  0.1, y:  0.0, z: 0.0 }; // RIGHT_KNEE
  lms[28] = { x:  0.1, y:  0.45, z: 0.0 }; // RIGHT_ANKLE
  return lms;
}

describe('computeLungeAngle', () => {
  it('returns null when all landmarks are null', () => {
    expect(computeLungeAngle(emptyLandmarks())).toBeNull();
  });

  it('returns null when knee landmarks are missing', () => {
    const lms = makeLungeLandmarks('up');
    lms[25] = null;
    lms[26] = null;
    expect(computeLungeAngle(lms)).toBeNull();
  });

  it('returns the front (smaller) knee angle for lunge-down position', () => {
    const angle = computeLungeAngle(makeLungeLandmarks('down'));
    expect(angle).not.toBeNull();
    expect(angle!).toBeLessThan(LUNGE_DOWN_ANGLE); // < 110°
  });

  it('returns angle > up-threshold for straight-leg (lunge-up) position', () => {
    const angle = computeLungeAngle(makeLungeLandmarks('up'));
    expect(angle).not.toBeNull();
    expect(angle!).toBeGreaterThan(LUNGE_UP_ANGLE); // > 160°
  });

  it('uses the minimum of both knee angles (front leg)', () => {
    // Both landmarks present → min is returned, not average
    const angle = computeLungeAngle(makeLungeLandmarks('down'));
    expect(angle!).toBeLessThan(LUNGE_DOWN_ANGLE);
  });
});

describe('isLungeActive', () => {
  it('returns false when angle is null', () => {
    expect(isLungeActive(makeLungeLandmarks('up'), null)).toBe(false);
  });

  it('returns false when knee landmarks are missing', () => {
    expect(isLungeActive(emptyLandmarks(), 90)).toBe(false);
  });

  it('returns true when knees have large z-separation (lunge position)', () => {
    const lms = makeLungeLandmarks('down');
    const angle = computeLungeAngle(lms)!;
    expect(isLungeActive(lms, angle)).toBe(true);
  });

  it('returns false when knees are at the same z (standing/squat)', () => {
    const lms = makeStandingLandmarks();
    const angle = computeLungeAngle(lms);
    expect(isLungeActive(lms, angle)).toBe(false);
  });
});

describe('LungeClassifier', () => {
  let clf: LungeClassifier;

  beforeEach(() => {
    clf = new LungeClassifier();
  });

  it('starts with count=0 and phase=ready', () => {
    const s = clf.getState();
    expect(s.count).toBe(0);
    expect(s.phase).toBe('ready');
  });

  it('counts 1 rep after one full down→up cycle in lunge position', () => {
    clf.update(makeLungeLandmarks('up'));   // ready (angle > upAngle)
    clf.update(makeLungeLandmarks('down')); // → down
    clf.update(makeLungeLandmarks('up'));   // → up, count++
    expect(clf.getState().count).toBe(1);
  });

  it('counts 2 reps after two full cycles', () => {
    clf.update(makeLungeLandmarks('up'));
    clf.update(makeLungeLandmarks('down'));
    clf.update(makeLungeLandmarks('up'));
    clf.update(makeLungeLandmarks('down'));
    clf.update(makeLungeLandmarks('up'));
    expect(clf.getState().count).toBe(2);
  });

  it('does not count when not in lunge position (standing — no z-separation)', () => {
    const standing = makeStandingLandmarks();
    clf.update(standing);
    clf.update(standing);
    clf.update(standing);
    expect(clf.getState().count).toBe(0);
  });

  it('does not count if down phase is never reached', () => {
    clf.update(makeLungeLandmarks('up'));
    clf.update(makeLungeLandmarks('up'));
    expect(clf.getState().count).toBe(0);
  });

  it('phase transitions to down when front knee bends in lunge', () => {
    clf.update(makeLungeLandmarks('up'));
    clf.update(makeLungeLandmarks('down'));
    expect(clf.getState().phase).toBe('down');
  });

  it('active flag is false for standing (no z-separation)', () => {
    const state = clf.update(makeStandingLandmarks());
    expect(state.active).toBe(false);
  });

  it('active flag is true when knees have z-separation', () => {
    const state = clf.update(makeLungeLandmarks('up'));
    expect(state.active).toBe(true);
  });

  it('reset() clears count and phase', () => {
    clf.update(makeLungeLandmarks('up'));
    clf.update(makeLungeLandmarks('down'));
    clf.update(makeLungeLandmarks('up'));
    clf.reset();
    const s = clf.getState();
    expect(s.count).toBe(0);
    expect(s.phase).toBe('ready');
  });
});
