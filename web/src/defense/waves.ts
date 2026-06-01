import { EnemyLogic, ENEMY_CONFIGS, type Vec3, type EnemyKind } from './enemies';

export interface EnemySpawn {
  type: EnemyKind;
  delay: number;
}

export interface WaveConfig {
  spawns: EnemySpawn[];
}

export const WAVES: WaveConfig[] = [
  // R1: basic only
  { spawns: [
    { type: 'basic', delay: 0 },
    { type: 'basic', delay: 1.5 },
    { type: 'basic', delay: 3 },
    { type: 'basic', delay: 4.5 },
    { type: 'basic', delay: 6 },
  ]},
  // R2: basic + fast
  { spawns: [
    { type: 'basic', delay: 0 },
    { type: 'fast',  delay: 1 },
    { type: 'basic', delay: 2 },
    { type: 'fast',  delay: 3 },
    { type: 'basic', delay: 4 },
    { type: 'basic', delay: 5.5 },
    { type: 'fast',  delay: 7 },
  ]},
  // R3: armored intro
  { spawns: [
    { type: 'basic',   delay: 0 },
    { type: 'armored', delay: 1.5 },
    { type: 'fast',    delay: 3 },
    { type: 'basic',   delay: 4 },
    { type: 'armored', delay: 5.5 },
    { type: 'fast',    delay: 6.5 },
    { type: 'basic',   delay: 8 },
  ]},
  // R4: all 3 mixed
  { spawns: [
    { type: 'fast',    delay: 0 },
    { type: 'basic',   delay: 0.8 },
    { type: 'armored', delay: 1.5 },
    { type: 'fast',    delay: 2.5 },
    { type: 'basic',   delay: 3 },
    { type: 'fast',    delay: 4 },
    { type: 'armored', delay: 5 },
    { type: 'basic',   delay: 6 },
    { type: 'armored', delay: 7 },
    { type: 'fast',    delay: 8.5 },
  ]},
  // R5: boss + escort
  { spawns: [
    { type: 'fast',    delay: 0 },
    { type: 'fast',    delay: 0.8 },
    { type: 'armored', delay: 2 },
    { type: 'armored', delay: 3.5 },
    { type: 'boss',    delay: 5 },
    { type: 'fast',    delay: 6 },
    { type: 'fast',    delay: 7 },
  ]},
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
    const idx = Math.min(Math.max(0, waveIndex), WAVES.length - 1);
    const wave = WAVES[idx];
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
