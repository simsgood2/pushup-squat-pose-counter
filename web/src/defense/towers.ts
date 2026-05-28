import type { Vec3, EnemyLogic } from './enemies';

export interface TowerConfig {
  range: number;
  damage: number;
  fireRate: number;       // shots per second
  projectileSpeed: number;
}

export const TOWER_CONFIGS: Record<string, TowerConfig> = {
  basic: { range: 1.8, damage: 50, fireRate: 1.5, projectileSpeed: 6 },
};

export interface ProjectileState {
  position: Vec3;
  targetId: number;
  speed: number;
  damage: number;
}

export class TowerLogic {
  readonly row: number;
  readonly col: number;
  readonly position: Vec3;
  readonly range: number;
  readonly damage: number;
  readonly fireRate: number;
  readonly projectileSpeed: number;
  private _cooldown = 0;
  readonly projectiles: ProjectileState[] = [];

  constructor(row: number, col: number, position: Vec3, config: TowerConfig = TOWER_CONFIGS.basic) {
    this.row = row;
    this.col = col;
    this.position = { ...position };
    this.range = config.range;
    this.damage = config.damage;
    this.fireRate = config.fireRate;
    this.projectileSpeed = config.projectileSpeed;
  }

  get cooldown(): number { return this._cooldown; }

  /** Updates tower logic; returns gold earned this tick. */
  update(dt: number, enemies: EnemyLogic[]): number {
    this._cooldown -= dt;
    let goldEarned = 0;

    if (this._cooldown <= 0) {
      const target = this._findTarget(enemies);
      if (target) {
        this.projectiles.push({
          position: { ...this.position },
          targetId: target.id,
          speed: this.projectileSpeed,
          damage: this.damage,
        });
        this._cooldown = 1 / this.fireRate;
      }
    }

    const keep: ProjectileState[] = [];
    for (const proj of this.projectiles) {
      const target = enemies.find(e => e.id === proj.targetId && e.alive);
      if (!target) continue; // target already dead — discard

      const dx = target.position.x - proj.position.x;
      const dz = target.position.z - proj.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const step = proj.speed * dt;

      if (step >= dist) {
        // Hit target
        const killed = target.takeDamage(proj.damage);
        if (killed) goldEarned += target.reward;
      } else {
        proj.position.x += (dx / dist) * step;
        proj.position.z += (dz / dist) * step;
        keep.push(proj);
      }
    }
    this.projectiles.length = 0;
    this.projectiles.push(...keep);

    return goldEarned;
  }

  private _findTarget(enemies: EnemyLogic[]): EnemyLogic | null {
    let closest: EnemyLogic | null = null;
    let minDist = this.range;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = e.distanceTo2D(this.position);
      if (d < minDist) { minDist = d; closest = e; }
    }
    return closest;
  }
}
