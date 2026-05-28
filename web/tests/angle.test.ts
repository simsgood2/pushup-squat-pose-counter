import { describe, it, expect } from 'vitest';
import { angleDegrees, average } from '../src/exercise/angle';

describe('angleDegrees', () => {
  it('returns 90° for a right angle', () => {
    const a = { x: 1, y: 0, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    const c = { x: 0, y: 1, z: 0 };
    expect(angleDegrees(a, b, c)).toBeCloseTo(90, 5);
  });

  it('returns 180° for collinear points', () => {
    const a = { x: -1, y: 0, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    const c = { x: 1, y: 0, z: 0 };
    expect(angleDegrees(a, b, c)).toBeCloseTo(180, 5);
  });

  it('returns 0° when a and c coincide with b', () => {
    const b = { x: 0, y: 0, z: 0 };
    expect(angleDegrees(b, b, b)).toBe(0);
  });

  it('returns 45° for a 45-degree angle in the xy plane', () => {
    const a = { x: 1, y: 0, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    const c = { x: 1, y: 1, z: 0 };
    expect(angleDegrees(a, b, c)).toBeCloseTo(45, 5);
  });

  it('works with 3D z-axis displacement', () => {
    const a = { x: 1, y: 0, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    const c = { x: 0, y: 0, z: 1 };
    expect(angleDegrees(a, b, c)).toBeCloseTo(90, 5);
  });

  it('returns 0 when one vector is zero-length (ab zero)', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    const c = { x: 1, y: 0, z: 0 };
    expect(angleDegrees(a, b, c)).toBe(0);
  });

  it('returns 60° for an equilateral triangle vertex', () => {
    // Equilateral triangle: A=(0,0,0), B=(1,0,0), C=(0.5, sqrt(3)/2, 0)
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 1, y: 0, z: 0 };
    const c = { x: 0.5, y: Math.sqrt(3) / 2, z: 0 };
    expect(angleDegrees(a, b, c)).toBeCloseTo(60, 4);
  });
});

describe('average', () => {
  it('returns null for empty array', () => {
    expect(average([])).toBeNull();
  });

  it('returns null when all values are null', () => {
    expect(average([null, null])).toBeNull();
  });

  it('returns the single value for one-element array', () => {
    expect(average([42])).toBe(42);
  });

  it('returns the mean of multiple values', () => {
    expect(average([10, 20, 30])).toBeCloseTo(20, 5);
  });

  it('ignores null and undefined entries', () => {
    expect(average([10, null, 30, undefined])).toBeCloseTo(20, 5);
  });
});
