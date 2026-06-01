import type { Vec3, EnemyLogic } from './enemies';

export type TowerKind = 'basic' | 'area' | 'slow';

export interface TowerConfig {
  kind: TowerKind;
  cost: number;
  range: number;
  damage: number;
  fireInterval: number;
  projectileSpeed: number;
  color: number;
  splashRadius?: number;
  slowMultiplier?: number;
  slowDuration?: number;
}

export const TOWER_CONFIGS: Record<TowerKind, TowerConfig> = {
  basic: { kind: 'basic', cost: 30, range: 1.2, damage: 50, fireInterval: 0.6,  projectileSpeed: 4.5, color: 0x4488ff },
  area:  { kind: 'area',  cost: 70, range: 1.0, damage: 35, fireInterval: 1.0,  projectileSpeed: 4.0, color: 0xff8844, splashRadius: 0.55 },
  slow:  { kind: 'slow',  cost: 55, range: 1.4, damage: 15, fireInterval: 0.7,  projectileSpeed: 5.0, color: 0x66ccff, slowMultiplier: 0.45, slowDuration: 2.5 },
};

export interface ProjectileState {
  id: number;
  position: Vec3;
  targetId: number;
  speed: number;
  damage: number;
  kind: TowerKind;
}

/** Emitted when a projectile lands, so the renderer can spawn hit/death/gold FX. */
export interface ImpactEvent {
  position: Vec3;
  kind: TowerKind;
  /** True if this impact killed at least one enemy. */
  killed: boolean;
}

let _projectileIdSeq = 0;

export class TowerLogic {
  readonly row: number;
  readonly col: number;
  readonly position: Vec3;
  readonly config: TowerConfig;
  private _cooldown = 0;
  readonly projectiles: ProjectileState[] = [];
  /** Impacts that landed this tick; the renderer reads and clears this. */
  readonly impacts: ImpactEvent[] = [];

  constructor(row: number, col: number, position: Vec3, kind: TowerKind = 'basic') {
    this.row = row;
    this.col = col;
    this.position = { ...position };
    this.config = TOWER_CONFIGS[kind];
  }

  get range(): number { return this.config.range; }
  get damage(): number { return this.config.damage; }
  get cooldown(): number { return this._cooldown; }

  /** Updates tower logic; returns gold earned this tick. */
  update(dt: number, enemies: EnemyLogic[]): number {
    this._cooldown -= dt;
    let goldEarned = 0;

    if (this._cooldown <= 0) {
      const target = this._findTarget(enemies);
      if (target) {
        this.projectiles.push({
          id: _projectileIdSeq++,
          position: { ...this.position },
          targetId: target.id,
          speed: this.config.projectileSpeed,
          damage: this.config.damage,
          kind: this.config.kind,
        });
        this._cooldown = this.config.fireInterval;
      }
    }

    const keep: ProjectileState[] = [];
    for (const proj of this.projectiles) {
      const target = enemies.find(e => e.id === proj.targetId && e.alive);
      if (!target) continue;

      const dx = target.position.x - proj.position.x;
      const dz = target.position.z - proj.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const step = proj.speed * dt;

      if (step >= dist) {
        const hitPos = { ...target.position };
        let killedAny = false;
        if (proj.kind === 'area' && this.config.splashRadius) {
          for (const e of enemies) {
            if (!e.alive) continue;
            if (e.distanceTo2D(hitPos) <= this.config.splashRadius) {
              const killed = e.takeDamage(proj.damage);
              if (killed) { goldEarned += e.reward; killedAny = true; }
            }
          }
        } else {
          const killed = target.takeDamage(proj.damage);
          if (killed) { goldEarned += target.reward; killedAny = true; }
          if (proj.kind === 'slow' && this.config.slowMultiplier !== undefined && this.config.slowDuration !== undefined) {
            if (target.alive) target.applySlow(this.config.slowMultiplier, this.config.slowDuration);
          }
        }
        this.impacts.push({ position: hitPos, kind: proj.kind, killed: killedAny });
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
    let minDist = this.config.range;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = e.distanceTo2D(this.position);
      if (d < minDist) { minDist = d; closest = e; }
    }
    return closest;
  }
}
