import { EnemyLogic, ENEMY_CONFIGS, type Vec3 } from './enemies';

export interface EnemySpawn {
  type: string;
  delay: number; // seconds after wave start
}

export interface WaveConfig {
  spawns: EnemySpawn[];
}

export const WAVES: WaveConfig[] = [
  {
    spawns: [
      { type: 'basic', delay: 0 },
      { type: 'basic', delay: 2 },
      { type: 'basic', delay: 4 },
      { type: 'basic', delay: 6 },
      { type: 'basic', delay: 8 },
    ],
  },
];

export class WaveLogic {
  private path: Vec3[];
  private pending: EnemySpawn[] = [];
  private _time = 0;
  private _nextId = 0;
  readonly enemies: EnemyLogic[] = [];
  private _active = false;
  complete = false;

  constructor(path: Vec3[]) {
    this.path = path;
  }

  start(waveIndex: number): void {
    const wave = WAVES[waveIndex];
    if (!wave) return;
    this.pending = [...wave.spawns];
    this._time = 0;
    this._active = true;
    this.complete = false;
    this.enemies.length = 0;
    this._nextId = 0;
  }

  get alive(): EnemyLogic[] {
    return this.enemies.filter(e => e.alive);
  }

  get killedCount(): number {
    return this.enemies.filter(e => !e.alive && !e.reachedEnd).length;
  }

  get reachedEndCount(): number {
    return this.enemies.filter(e => e.reachedEnd).length;
  }

  /** Advances time by dt; returns currently-alive enemies after update. */
  update(dt: number, onSpawn?: (e: EnemyLogic) => void): EnemyLogic[] {
    if (!this._active) return [];
    this._time += dt;

    const remaining: EnemySpawn[] = [];
    for (const spawn of this.pending) {
      if (this._time >= spawn.delay) {
        const config = ENEMY_CONFIGS[spawn.type];
        if (config) {
          const e = new EnemyLogic(this._nextId++, config, this.path);
          this.enemies.push(e);
          onSpawn?.(e);
        }
      } else {
        remaining.push(spawn);
      }
    }
    this.pending = remaining;

    for (const e of this.enemies) {
      e.update(dt);
    }

    if (this.pending.length === 0 && this.enemies.length > 0 && this.enemies.every(e => !e.alive)) {
      this.complete = true;
      this._active = false;
    }

    return this.alive;
  }
}
