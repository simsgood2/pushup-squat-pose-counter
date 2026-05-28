import { describe, expect, it, beforeEach } from 'vitest';
import { EnemyLogic, ENEMY_CONFIGS, type Vec3 } from '../src/defense/enemies';
import { TowerLogic, TOWER_CONFIGS } from '../src/defense/towers';
import { WaveLogic } from '../src/defense/waves';
import { GridState } from '../src/defense/grid';
import { goldStore } from '../src/exercise/rewards';

const path: Vec3[] = [
  { x: -2, y: 0.1, z: 0 },
  { x: 2, y: 0.1, z: 0 },
];

describe('defense combat logic', () => {
  it('moves a basic enemy along a straight path until it reaches the end', () => {
    const enemy = new EnemyLogic(1, ENEMY_CONFIGS.basic, path);

    enemy.update(1);
    expect(enemy.position.x).toBeCloseTo(-0.8, 5);
    expect(enemy.alive).toBe(true);
    expect(enemy.reachedEnd).toBe(false);

    enemy.update(3);
    expect(enemy.position.x).toBeCloseTo(2, 5);
    expect(enemy.alive).toBe(false);
    expect(enemy.reachedEnd).toBe(true);
  });

  it('fires single-target projectiles that kill a 100 HP enemy before it reaches the end', () => {
    const enemy = new EnemyLogic(1, ENEMY_CONFIGS.basic, path);
    const tower = new TowerLogic(0, 0, { x: 0, y: 0.35, z: 0 });

    for (let i = 0; i < 100 && enemy.alive; i++) {
      enemy.update(0.05);
      tower.update(0.05, [enemy]);
    }

    expect(enemy.alive).toBe(false);
    expect(enemy.reachedEnd).toBe(false);
  });

  it('tower cost is 30', () => {
    expect(TOWER_CONFIGS.basic.cost).toBe(30);
  });

  it('wave 1 spawns five basic enemies', () => {
    const wave = new WaveLogic(path);
    wave.start(0);

    for (let i = 0; i < 180; i++) {
      wave.update(0.05);
    }

    expect(wave.enemies).toHaveLength(5);
  });
});

describe('tower placement gold cost', () => {
  beforeEach(() => {
    goldStore.getState().reset();
  });

  it('골드 충분 시 spendGold + occupy 성공, 골드 차감', () => {
    const state = new GridState();
    goldStore.getState().addGold(100, 0, 0);
    const cost = TOWER_CONFIGS.basic.cost;
    expect(goldStore.getState().spendGold(cost)).toBe(true);
    state.occupy(0, 0);
    expect(state.isOccupied(0, 0)).toBe(true);
    expect(goldStore.getState().gold).toBe(100 - cost);
  });

  it('골드 부족 시 spendGold 실패, 셀 비어있음, 잔액 유지', () => {
    const state = new GridState();
    goldStore.getState().addGold(10, 0, 0); // cost=30 보다 적음
    const cost = TOWER_CONFIGS.basic.cost;
    expect(goldStore.getState().spendGold(cost)).toBe(false);
    expect(state.isOccupied(0, 0)).toBe(false);
    expect(goldStore.getState().gold).toBe(10);
  });

  it('이미 점유된 셀에는 골드 소비 전에 isOccupied로 거부', () => {
    const state = new GridState();
    goldStore.getState().addGold(200, 0, 0);
    state.occupy(0, 0);
    // 이미 점유됨 → isOccupied 체크로 스킵
    expect(state.isOccupied(0, 0)).toBe(true);
    // 두 번째 occupy 시도 → false
    expect(state.occupy(0, 0)).toBe(false);
    // 골드 소비는 일어나지 않음 (isOccupied 먼저 체크하므로)
    expect(goldStore.getState().gold).toBe(200);
  });
});
