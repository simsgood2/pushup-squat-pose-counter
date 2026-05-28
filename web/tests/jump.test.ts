import { describe, it, expect, beforeEach } from 'vitest';
import {
  JumpClassifier,
  computeJumpAnkleY,
  JUMP_LIFT_THRESHOLD,
  type Landmarks,
} from '../src/exercise/classifiers/jump';

function emptyLandmarks(): Landmarks {
  return new Array(33).fill(null);
}

/**
 * Ground position: ankles at y=0.45 (typical standing height in MediaPipe world coords).
 * MediaPipe y is positive-downward, so y=0.45 means ankles are below hip.
 */
function makeGroundLandmarks(): Landmarks {
  const lms = emptyLandmarks();
  lms[27] = { x: -0.1, y: 0.45, z: 0.0 }; // LEFT_ANKLE
  lms[28] = { x:  0.1, y: 0.45, z: 0.0 }; // RIGHT_ANKLE
  return lms;
}

/**
 * Airborne position: ankles at y=0.20 (0.25m above ground baseline, > 0.1m threshold).
 */
function makeAirLandmarks(): Landmarks {
  const lms = emptyLandmarks();
  lms[27] = { x: -0.1, y: 0.20, z: 0.0 }; // LEFT_ANKLE — 0.25m above baseline
  lms[28] = { x:  0.1, y: 0.20, z: 0.0 }; // RIGHT_ANKLE
  return lms;
}

/** Calibrate the classifier with CALIBRATION_FRAMES ground frames so detection starts. */
function calibrate(clf: JumpClassifier, frames = 3): void {
  for (let i = 0; i < frames; i++) clf.update(makeGroundLandmarks());
}

describe('computeJumpAnkleY', () => {
  it('returns null when all landmarks are null', () => {
    expect(computeJumpAnkleY(emptyLandmarks())).toBeNull();
  });

  it('returns null when ankle landmarks are missing', () => {
    const lms = makeGroundLandmarks();
    lms[27] = null;
    lms[28] = null;
    expect(computeJumpAnkleY(lms)).toBeNull();
  });

  it('returns the ankle y value when both ankles are present', () => {
    const y = computeJumpAnkleY(makeGroundLandmarks());
    expect(y).not.toBeNull();
    expect(y!).toBeCloseTo(0.45);
  });

  it('returns the average y when only one ankle is available', () => {
    const lms = makeGroundLandmarks();
    lms[28] = null; // remove right ankle
    const y = computeJumpAnkleY(lms);
    expect(y).not.toBeNull();
    expect(y!).toBeCloseTo(0.45);
  });
});

describe('JumpClassifier', () => {
  let clf: JumpClassifier;

  beforeEach(() => {
    clf = new JumpClassifier();
  });

  it('starts with count=0 and phase=ready', () => {
    const s = clf.getState();
    expect(s.count).toBe(0);
    expect(s.phase).toBe('ready');
  });

  it('returns active=false during calibration frames', () => {
    const state1 = clf.update(makeGroundLandmarks());
    expect(state1.active).toBe(false);
    const state2 = clf.update(makeGroundLandmarks());
    expect(state2.active).toBe(false);
  });

  it('becomes active after calibration completes', () => {
    calibrate(clf);
    const state = clf.update(makeGroundLandmarks());
    expect(state.active).toBe(true);
  });

  it('transitions to phase=down when grounded after calibration', () => {
    calibrate(clf);
    const state = clf.update(makeGroundLandmarks());
    expect(state.phase).toBe('down');
  });

  it('transitions to phase=up when airborne', () => {
    calibrate(clf);
    clf.update(makeGroundLandmarks()); // → down
    const state = clf.update(makeAirLandmarks()); // → up
    expect(state.phase).toBe('up');
  });

  it('counts 1 rep after one grounded→airborne cycle', () => {
    calibrate(clf);
    clf.update(makeGroundLandmarks()); // → down
    clf.update(makeAirLandmarks());   // → up, count++
    expect(clf.getState().count).toBe(1);
  });

  it('counts 2 reps after two full cycles', () => {
    calibrate(clf);
    clf.update(makeGroundLandmarks());
    clf.update(makeAirLandmarks());   // count = 1
    clf.update(makeGroundLandmarks()); // → down again
    clf.update(makeAirLandmarks());   // count = 2
    expect(clf.getState().count).toBe(2);
  });

  it('does not count when never airborne', () => {
    calibrate(clf);
    clf.update(makeGroundLandmarks());
    clf.update(makeGroundLandmarks());
    clf.update(makeGroundLandmarks());
    expect(clf.getState().count).toBe(0);
  });

  it('does not count when landmarks are null', () => {
    clf.update(emptyLandmarks());
    clf.update(emptyLandmarks());
    expect(clf.getState().count).toBe(0);
  });

  it('JUMP_LIFT_THRESHOLD is 0.1m', () => {
    expect(JUMP_LIFT_THRESHOLD).toBe(0.1);
  });

  it('reset() clears count and phase and restarts calibration', () => {
    calibrate(clf);
    clf.update(makeGroundLandmarks());
    clf.update(makeAirLandmarks());
    clf.reset();
    const s = clf.getState();
    expect(s.count).toBe(0);
    expect(s.phase).toBe('ready');
    // After reset, should be in calibration mode again
    const state = clf.update(makeGroundLandmarks());
    expect(state.active).toBe(false);
  });
});
