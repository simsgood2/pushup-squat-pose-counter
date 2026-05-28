import { describe, it, expect, beforeEach } from 'vitest';
import {
  PushupClassifier,
  computePushupAngle,
  isPushupActive,
  type Landmarks,
} from '../src/exercise/classifiers/pushup';
import type { Point3D } from '../src/exercise/angle';

function emptyLandmarks(): Landmarks {
  return new Array(33).fill(null);
}

/**
 * Synthetic pushup-position landmarks.
 * Body is horizontal along x-axis (shoulder at x=0.3, hip at x=-0.5, same y=0).
 * MediaPipe worldLandmarks: y is down.
 *
 * 'up'  → arms extended (elbow barely bent) → angle ≈ 173° (> 155°)
 * 'down' → arms bent low (elbow below body) → angle ≈ 72°  (< 105°)
 */
function makePushupLandmarks(phase: 'up' | 'down'): Landmarks {
  const lms = emptyLandmarks();
  // Shoulders
  lms[11] = { x: 0.3, y: 0.0, z: 0.0 };  // LEFT_SHOULDER
  lms[12] = { x: 0.3, y: 0.0, z: 0.1 };  // RIGHT_SHOULDER
  // Hips — far along x, same y → body is horizontal
  lms[23] = { x: -0.5, y: 0.0, z: 0.0 }; // LEFT_HIP
  lms[24] = { x: -0.5, y: 0.0, z: 0.1 }; // RIGHT_HIP
  // Wrists near shoulder level
  lms[15] = { x: 0.0, y: 0.0, z: 0.0 };  // LEFT_WRIST
  lms[16] = { x: 0.0, y: 0.0, z: 0.1 };  // RIGHT_WRIST

  if (phase === 'up') {
    // Elbow barely below shoulder line → large angle
    lms[13] = { x: 0.15, y: 0.01, z: 0.0 }; // LEFT_ELBOW
    lms[14] = { x: 0.15, y: 0.01, z: 0.1 }; // RIGHT_ELBOW
  } else {
    // Elbow dropped low → small angle
    lms[13] = { x: 0.1, y: 0.2, z: 0.0 }; // LEFT_ELBOW
    lms[14] = { x: 0.1, y: 0.2, z: 0.1 }; // RIGHT_ELBOW
  }
  return lms;
}

/** Standing landmarks: shoulders above hips (body vertical → not a pushup). */
function makeStandingLandmarks(): Landmarks {
  const lms = emptyLandmarks();
  lms[11] = { x: -0.1, y: -0.4, z: 0.0 }; // LEFT_SHOULDER (high)
  lms[12] = { x:  0.1, y: -0.4, z: 0.0 }; // RIGHT_SHOULDER
  lms[13] = { x: -0.1, y: -0.2, z: 0.0 }; // LEFT_ELBOW
  lms[14] = { x:  0.1, y: -0.2, z: 0.0 }; // RIGHT_ELBOW
  lms[15] = { x: -0.1, y:  0.0, z: 0.0 }; // LEFT_WRIST
  lms[16] = { x:  0.1, y:  0.0, z: 0.0 }; // RIGHT_WRIST
  lms[23] = { x: -0.1, y:  0.0, z: 0.0 }; // LEFT_HIP (low)
  lms[24] = { x:  0.1, y:  0.0, z: 0.0 }; // RIGHT_HIP
  return lms;
}

describe('computePushupAngle', () => {
  it('returns null when all landmarks are null', () => {
    expect(computePushupAngle(emptyLandmarks())).toBeNull();
  });

  it('returns null when elbow landmarks are missing', () => {
    const lms = makePushupLandmarks('up');
    lms[13] = null;
    lms[14] = null;
    expect(computePushupAngle(lms)).toBeNull();
  });

  it('returns angle > 155 for extended-arm (up) position', () => {
    const angle = computePushupAngle(makePushupLandmarks('up'));
    expect(angle).not.toBeNull();
    expect(angle!).toBeGreaterThan(155);
  });

  it('returns angle < 105 for bent-arm (down) position', () => {
    const angle = computePushupAngle(makePushupLandmarks('down'));
    expect(angle).not.toBeNull();
    expect(angle!).toBeLessThan(105);
  });

  it('averages left and right arm angles when both are available', () => {
    const lms = makePushupLandmarks('up');
    // Both sides present → result equals single-side calculation (symmetric here)
    const angle = computePushupAngle(lms);
    expect(angle).not.toBeNull();
  });
});

describe('isPushupActive', () => {
  it('returns false when angle is null', () => {
    expect(isPushupActive(makePushupLandmarks('up'), null)).toBe(false);
  });

  it('returns false when required landmarks are missing', () => {
    const lms = emptyLandmarks();
    expect(isPushupActive(lms, 160)).toBe(false);
  });

  it('returns true for horizontal body with wrists near shoulder level', () => {
    const lms = makePushupLandmarks('up');
    const angle = computePushupAngle(lms)!;
    expect(isPushupActive(lms, angle)).toBe(true);
  });

  it('returns false for vertical (standing) body', () => {
    const lms = makeStandingLandmarks();
    const angle = computePushupAngle(lms)!;
    expect(isPushupActive(lms, angle)).toBe(false);
  });
});

describe('PushupClassifier', () => {
  let clf: PushupClassifier;

  beforeEach(() => {
    clf = new PushupClassifier();
  });

  it('starts with count=0 and phase=ready', () => {
    const s = clf.getState();
    expect(s.count).toBe(0);
    expect(s.phase).toBe('ready');
  });

  it('counts 1 rep after one full down→up cycle in pushup position', () => {
    clf.update(makePushupLandmarks('up'));   // ready (angle > upAngle)
    clf.update(makePushupLandmarks('down')); // → down
    clf.update(makePushupLandmarks('up'));   // → up, count++
    expect(clf.getState().count).toBe(1);
  });

  it('counts 2 reps after two full down→up cycles', () => {
    clf.update(makePushupLandmarks('up'));
    clf.update(makePushupLandmarks('down'));
    clf.update(makePushupLandmarks('up'));
    clf.update(makePushupLandmarks('down'));
    clf.update(makePushupLandmarks('up'));
    expect(clf.getState().count).toBe(2);
  });

  it('does not count a rep when body is NOT in pushup position (standing)', () => {
    const standing = makeStandingLandmarks();
    clf.update(standing);
    clf.update(standing);
    clf.update(standing);
    expect(clf.getState().count).toBe(0);
  });

  it('does not count a rep if down phase is never reached', () => {
    // Stay in extended-arm (up) position throughout
    clf.update(makePushupLandmarks('up'));
    clf.update(makePushupLandmarks('up'));
    expect(clf.getState().count).toBe(0);
  });

  it('reset() clears count and phase', () => {
    clf.update(makePushupLandmarks('up'));
    clf.update(makePushupLandmarks('down'));
    clf.update(makePushupLandmarks('up'));
    clf.reset();
    const s = clf.getState();
    expect(s.count).toBe(0);
    expect(s.phase).toBe('ready');
  });

  it('phase transitions to down when arms are bent in pushup position', () => {
    clf.update(makePushupLandmarks('up'));
    clf.update(makePushupLandmarks('down'));
    expect(clf.getState().phase).toBe('down');
  });

  it('active flag is false when body is not in pushup position', () => {
    const state = clf.update(makeStandingLandmarks());
    expect(state.active).toBe(false);
  });

  it('active flag is true when body is in pushup position', () => {
    const state = clf.update(makePushupLandmarks('up'));
    expect(state.active).toBe(true);
  });
});
