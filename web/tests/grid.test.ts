import { describe, it, expect } from 'vitest';
import { GridState } from '../src/defense/grid';

describe('GridState', () => {
  it('initialises with zero towers', () => {
    const g = new GridState(8, 8, 0.4);
    expect(g.towerCount).toBe(0);
  });

  it('worldToCell returns correct cell for origin', () => {
    const g = new GridState(8, 8, 0.4);
    // Grid spans [-1.6, 1.6] in X and Z. (0, 0) falls in col=4, row=4.
    const result = g.worldToCell(0, 0);
    expect(result).not.toBeNull();
    expect(result!.col).toBe(4);
    expect(result!.row).toBe(4);
  });

  it('worldToCell returns null for out-of-bounds world coordinates', () => {
    const g = new GridState(8, 8, 0.4);
    expect(g.worldToCell(100, 100)).toBeNull();
    expect(g.worldToCell(-100, -100)).toBeNull();
    expect(g.worldToCell(1.7, 0)).toBeNull();
  });

  it('occupy returns true and increments towerCount', () => {
    const g = new GridState(8, 8, 0.4);
    expect(g.occupy(0, 0)).toBe(true);
    expect(g.towerCount).toBe(1);
  });

  it('occupy returns false when cell already occupied', () => {
    const g = new GridState(8, 8, 0.4);
    g.occupy(0, 0);
    expect(g.occupy(0, 0)).toBe(false);
    expect(g.towerCount).toBe(1);
  });

  it('occupy returns false for out-of-bounds cell', () => {
    const g = new GridState(8, 8, 0.4);
    expect(g.occupy(-1, 0)).toBe(false);
    expect(g.occupy(0, 8)).toBe(false);
    expect(g.occupy(8, 0)).toBe(false);
  });

  it('isOccupied reflects tower placement', () => {
    const g = new GridState(8, 8, 0.4);
    expect(g.isOccupied(3, 3)).toBe(false);
    g.occupy(3, 3);
    expect(g.isOccupied(3, 3)).toBe(true);
    expect(g.isOccupied(3, 4)).toBe(false);
  });

  it('isOccupied returns false for out-of-bounds', () => {
    const g = new GridState(8, 8, 0.4);
    expect(g.isOccupied(-1, 0)).toBe(false);
    expect(g.isOccupied(0, 8)).toBe(false);
  });

  it('cellCenter returns correct world position for (0, 0)', () => {
    const g = new GridState(8, 8, 0.4);
    // startX = -1.6, center of (0,0) = -1.6 + 0.5*0.4 = -1.4
    const c = g.cellCenter(0, 0);
    expect(c.x).toBeCloseTo(-1.4, 5);
    expect(c.z).toBeCloseTo(-1.4, 5);
  });

  it('worldToCell and cellCenter are inverses', () => {
    const g = new GridState(8, 8, 0.4);
    for (const [row, col] of [[0, 0], [3, 5], [7, 7], [4, 4]] as [number, number][]) {
      const center = g.cellCenter(row, col);
      const cell = g.worldToCell(center.x, center.z);
      expect(cell).not.toBeNull();
      expect(cell!.row).toBe(row);
      expect(cell!.col).toBe(col);
    }
  });

  it('towerCount tracks multiple towers placed at distinct cells', () => {
    const g = new GridState(8, 8, 0.4);
    g.occupy(0, 0);
    g.occupy(1, 1);
    g.occupy(2, 2);
    expect(g.towerCount).toBe(3);
  });

  it('getCell returns the correct cell object', () => {
    const g = new GridState(8, 8, 0.4);
    const cell = g.getCell(2, 3);
    expect(cell).not.toBeNull();
    expect(cell!.row).toBe(2);
    expect(cell!.col).toBe(3);
    expect(cell!.hasTower).toBe(false);
  });

  it('getCell returns null for out-of-bounds', () => {
    const g = new GridState(8, 8, 0.4);
    expect(g.getCell(-1, 0)).toBeNull();
    expect(g.getCell(0, 8)).toBeNull();
  });

  it('worldToCell boundary: first cell starts at -totalW/2', () => {
    const g = new GridState(4, 4, 1.0);
    // startX = -2.0, first col starts at -2.0, second at -1.0
    expect(g.worldToCell(-2.0, -2.0)!.col).toBe(0);
    expect(g.worldToCell(-1.0, -2.0)!.col).toBe(1);
    expect(g.worldToCell(1.9, -2.0)!.col).toBe(3);
    expect(g.worldToCell(2.0, -2.0)).toBeNull(); // exactly on boundary = out of bounds
  });
});
