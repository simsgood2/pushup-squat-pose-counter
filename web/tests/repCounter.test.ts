import { describe, it, expect, beforeEach } from 'vitest';
import { RepetitionCounter } from '../src/exercise/repCounter';

describe('RepetitionCounter', () => {
  let counter: RepetitionCounter;

  beforeEach(() => {
    counter = new RepetitionCounter(105, 155);
  });

  it('starts with count 0 and phase ready', () => {
    const state = counter.getState();
    expect(state.count).toBe(0);
    expect(state.phase).toBe('ready');
    expect(state.angle).toBeNull();
    expect(state.active).toBe(false);
  });

  it('returns state with null angle unchanged when angle is null', () => {
    const state = counter.update(null, true);
    expect(state.angle).toBeNull();
    expect(state.phase).toBe('ready');
  });

  it('transitions ready → down when angle <= downAngle', () => {
    const state = counter.update(100, true);
    expect(state.phase).toBe('down');
  });

  it('does not transition ready → down when angle > downAngle', () => {
    const state = counter.update(110, true);
    expect(state.phase).toBe('ready');
  });

  it('transitions down → up when angle >= upAngle and increments count', () => {
    counter.update(100, true);
    const state = counter.update(160, true);
    expect(state.phase).toBe('up');
    expect(state.count).toBe(1);
  });

  it('does not increment count if angle goes down without reaching downAngle', () => {
    counter.update(110, true);
    counter.update(160, true);
    expect(counter.getState().count).toBe(0);
  });

  it('counts two full reps on complete down-up-down-up cycle', () => {
    counter.update(100, true);
    counter.update(160, true);
    counter.update(100, true);
    counter.update(160, true);
    expect(counter.getState().count).toBe(2);
  });

  it('resets phase to ready when active becomes false', () => {
    counter.update(100, true);
    expect(counter.getState().phase).toBe('down');
    counter.update(100, false);
    expect(counter.getState().phase).toBe('ready');
  });

  it('does not count a rep if active is false mid-cycle', () => {
    counter.update(100, true);
    counter.update(100, false);
    counter.update(160, true);
    expect(counter.getState().count).toBe(0);
  });

  it('transitions up → down on second descent (from up phase)', () => {
    counter.update(100, true);
    counter.update(160, true);
    const state = counter.update(100, true);
    expect(state.phase).toBe('down');
  });

  it('exact boundary: angle == downAngle transitions to down', () => {
    const state = counter.update(105, true);
    expect(state.phase).toBe('down');
  });

  it('exact boundary: angle == upAngle transitions to up', () => {
    counter.update(100, true);
    const state = counter.update(155, true);
    expect(state.phase).toBe('up');
    expect(state.count).toBe(1);
  });

  it('reset() restores initial state', () => {
    counter.update(100, true);
    counter.update(160, true);
    counter.reset();
    const state = counter.getState();
    expect(state.count).toBe(0);
    expect(state.phase).toBe('ready');
    expect(state.angle).toBeNull();
  });

  it('artificial angle sequence: [120,100,160,100,160] yields count=2', () => {
    const angles = [120, 100, 160, 100, 160];
    for (const a of angles) counter.update(a, true);
    expect(counter.getState().count).toBe(2);
  });

  it('artificial angle sequence: all mid-range yields count=0', () => {
    for (const a of [130, 130, 130]) counter.update(a, true);
    expect(counter.getState().count).toBe(0);
  });
});
