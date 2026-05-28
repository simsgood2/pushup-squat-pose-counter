import { describe, expect, it } from 'vitest';
import { EnemyLogic, ENEMY_CONFIGS, type Vec3 } from '../src/defense/enemies';
import { TowerLogic } from '../src/defense/towers';
import { WaveLogic } from '../src/defense/waves';

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

  it('wave 1 spawns five basic enemies', () => {
    const wave = new WaveLogic(path);
    wave.start(0);

    for (let i = 0; i < 180; i++) {
      wave.update(0.05);
    }

    expect(wave.enemies).toHaveLength(5);
  });
});
