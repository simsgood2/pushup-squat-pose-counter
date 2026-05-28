import { describe, it, expect, beforeEach } from 'vitest';
import {
  JumpingJackClassifier,
  isArmsRaised,
  isFeetApart,
  isFeetTogether,
  type Landmarks,
} from '../src/exercise/classifiers/jumpingJack';

function emptyLandmarks(): Landmarks {
  return new Array(33).fill(null);
}

/**
 * Closed position (jack 'down'): arms at sides, feet together.
 * MediaPipe y is positive-downward. Wrist below shoulder → wrist.y > shoulder.y.
 * Feet close: |left_ankle.x - right_ankle.x| = 0.1 ≤ 0.15
 */
function makeJackClosed(): Landmarks {
  const lms = emptyLandmarks();
  lms[11] = { x: -0.2, y: -0.5, z: 0.0 }; // LEFT_SHOULDER
  lms[12] = { x:  0.2, y: -0.5, z: 0.0 }; // RIGHT_SHOULDER
  lms[15] = { x: -0.2, y:  0.3, z: 0.0 }; // LEFT_WRIST (below shoulder)
  lms[16] = { x:  0.2, y:  0.3, z: 0.0 }; // RIGHT_WRIST
  lms[27] = { x: -0.05, y: 0.45, z: 0.0 }; // LEFT_ANKLE  (|Δx| = 0.10)
  lms[28] = { x:  0.05, y: 0.45, z: 0.0 }; // RIGHT_ANKLE
  return lms;
}

/**
 * Open position (jack 'up'): arms raised overhead, feet apart.
 * Wrist above shoulder → wrist.y < shoulder.y - 0.05.
 * Feet far: |left_ankle.x - right_ankle.x| = 0.4 ≥ 0.25
 */
function makeJackOpen(): Landmarks {
  const lms = emptyLandmarks();
  lms[11] = { x: -0.2, y: -0.5, z: 0.0 }; // LEFT_SHOULDER
  lms[12] = { x:  0.2, y: -0.5, z: 0.0 }; // RIGHT_SHOULDER
  lms[15] = { x: -0.5, y: -0.6, z: 0.0 }; // LEFT_WRIST (above shoulder: -0.6 < -0.55)
  lms[16] = { x:  0.5, y: -0.6, z: 0.0 }; // RIGHT_WRIST
  lms[27] = { x: -0.2, y: 0.45, z: 0.0 }; // LEFT_ANKLE  (|Δx| = 0.40)
  lms[28] = { x:  0.2, y: 0.45, z: 0.0 }; // RIGHT_ANKLE
  return lms;
}

describe('isArmsRaised', () => {
  it('returns false when arms are at sides (wrists below shoulders)', () => {
    expect(isArmsRaised(makeJackClosed())).toBe(false);
  });

  it('returns true when arms are overhead (wrists above shoulders)', () => {
    expect(isArmsRaised(makeJackOpen())).toBe(true);
  });

  it('returns false when shoulder/wrist landmarks are missing', () => {
    expect(isArmsRaised(emptyLandmarks())).toBe(false);
  });
});

describe('isFeetApart', () => {
  it('returns false when feet are close together', () => {
    expect(isFeetApart(makeJackClosed())).toBe(false);
  });

  it('returns true when feet are spread apart', () => {
    expect(isFeetApart(makeJackOpen())).toBe(true);
  });

  it('returns false when ankle landmarks are missing', () => {
    expect(isFeetApart(emptyLandmarks())).toBe(false);
  });
});

describe('isFeetTogether', () => {
  it('returns true when feet are close together', () => {
    expect(isFeetTogether(makeJackClosed())).toBe(true);
  });

  it('returns false when feet are spread apart', () => {
    expect(isFeetTogether(makeJackOpen())).toBe(false);
  });

  it('returns false when ankle landmarks are missing', () => {
    expect(isFeetTogether(emptyLandmarks())).toBe(false);
  });
});

describe('JumpingJackClassifier', () => {
  let clf: JumpingJackClassifier;

  beforeEach(() => {
    clf = new JumpingJackClassifier();
  });

  it('starts with count=0 and phase=ready', () => {
    const s = clf.getState();
    expect(s.count).toBe(0);
    expect(s.phase).toBe('ready');
  });

  it('transitions to phase=down on closed position', () => {
    clf.update(makeJackClosed());
    expect(clf.getState().phase).toBe('down');
  });

  it('counts 1 rep after one closed→open cycle', () => {
    clf.update(makeJackClosed()); // → down
    clf.update(makeJackOpen());   // → up, count++
    expect(clf.getState().count).toBe(1);
  });

  it('counts 2 reps after two full cycles', () => {
    clf.update(makeJackClosed());
    clf.update(makeJackOpen());   // count = 1
    clf.update(makeJackClosed());
    clf.update(makeJackOpen());   // count = 2
    expect(clf.getState().count).toBe(2);
  });

  it('does not count when open position never reached', () => {
    clf.update(makeJackClosed());
    clf.update(makeJackClosed());
    expect(clf.getState().count).toBe(0);
  });

  it('does not count when starting open without prior closed', () => {
    // Phase starts at 'ready', open does not trigger count
    clf.update(makeJackOpen());
    expect(clf.getState().count).toBe(0);
  });

  it('active flag is true for closed position', () => {
    const state = clf.update(makeJackClosed());
    expect(state.active).toBe(true);
  });

  it('active flag is true for open position', () => {
    const state = clf.update(makeJackOpen());
    expect(state.active).toBe(true);
  });

  it('active flag is false when landmarks are missing', () => {
    const state = clf.update(emptyLandmarks());
    expect(state.active).toBe(false);
  });

  it('reset() clears count and phase', () => {
    clf.update(makeJackClosed());
    clf.update(makeJackOpen());
    clf.reset();
    const s = clf.getState();
    expect(s.count).toBe(0);
    expect(s.phase).toBe('ready');
  });
});
