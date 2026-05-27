import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PoseStream } from '../src/mocap/poseStream';
import type { LandmarkResult } from '../src/mocap/poseStream';

describe('PoseStream subscribe/unsubscribe', () => {
  let stream: PoseStream;

  beforeEach(() => {
    stream = new PoseStream();
  });

  it('subscribe returns an unsubscribe function', () => {
    const cb = vi.fn();
    const unsub = stream.subscribe(cb);
    expect(typeof unsub).toBe('function');
  });

  it('subscriber receives dispatched landmark results', () => {
    const cb = vi.fn();
    stream.subscribe(cb);
    const result: LandmarkResult = { landmarks: [], worldLandmarks: [] };
    (stream as unknown as { dispatch(r: LandmarkResult): void }).dispatch(result);
    expect(cb).toHaveBeenCalledWith(result);
  });

  it('unsubscribe function removes the callback', () => {
    const cb = vi.fn();
    const unsub = stream.subscribe(cb);
    unsub();
    (stream as unknown as { dispatch(r: LandmarkResult): void }).dispatch({
      landmarks: [],
      worldLandmarks: [],
    });
    expect(cb).not.toHaveBeenCalled();
  });

  it('multiple subscribers all receive results', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    stream.subscribe(cb1);
    stream.subscribe(cb2);
    const result: LandmarkResult = { landmarks: [], worldLandmarks: [] };
    (stream as unknown as { dispatch(r: LandmarkResult): void }).dispatch(result);
    expect(cb1).toHaveBeenCalledWith(result);
    expect(cb2).toHaveBeenCalledWith(result);
  });

  it('only active subscribers receive results after partial unsubscribe', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = stream.subscribe(cb1);
    stream.subscribe(cb2);
    unsub1();
    (stream as unknown as { dispatch(r: LandmarkResult): void }).dispatch({
      landmarks: [],
      worldLandmarks: [],
    });
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });
});
