export interface Vec3 { x: number; y: number; z: number }

export interface EnemyConfig {
  hp: number;
  speed: number;
  reward: number;
  damageReduction?: number;
  scale?: number;
  color?: number;
}

export const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
  basic:   { hp: 100,  speed: 1.2, reward: 10 },
  fast:    { hp: 60,   speed: 2.4, reward: 15, color: 0xffd866 },
  armored: { hp: 280,  speed: 0.9, reward: 25, damageReduction: 0.45, color: 0x9aa5b8 },
  boss:    { hp: 2000, speed: 0.7, reward: 250, damageReduction: 0.25, scale: 2.2, color: 0xb854ff },
};

export class EnemyLogic {
  readonly id: number;
  position: Vec3;
  private _hp: number;
  readonly maxHp: number;
  readonly speed: number;
  readonly reward: number;
  readonly damageReduction: number;
  readonly config: EnemyConfig;
  alive = true;
  reachedEnd = false;
  slowMultiplier = 1;
  slowUntil = 0;
  private path: Vec3[];
  private pathIndex = 0;

  constructor(id: number, config: EnemyConfig, path: Vec3[]) {
    this.id = id;
    this._hp = config.hp;
    this.maxHp = config.hp;
    this.speed = config.speed;
    this.reward = config.reward;
    this.damageReduction = config.damageReduction ?? 0;
    this.config = config;
    this.path = path;
    this.position = { ...path[0] };
  }

  get hp(): number { return this._hp; }

  takeDamage(amount: number): boolean {
    if (!this.alive) return false;
    const effective = amount * (1 - this.damageReduction);
    this._hp = Math.max(0, this._hp - effective);
    if (this._hp === 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  applySlow(multiplier: number, duration: number): void {
    const now = performance.now() / 1000;
    if (multiplier < this.slowMultiplier || now >= this.slowUntil) {
      this.slowMultiplier = multiplier;
    }
    this.slowUntil = now + duration;
  }

  update(dt: number): void {
    if (!this.alive || this.reachedEnd) return;

    const now = performance.now() / 1000;
    const slow = now < this.slowUntil ? this.slowMultiplier : 1;
    if (now >= this.slowUntil) this.slowMultiplier = 1;

    if (this.pathIndex >= this.path.length - 1) {
      this.reachedEnd = true;
      this.alive = false;
      return;
    }
    const target = this.path[this.pathIndex + 1];
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const step = this.speed * slow * dt;
    if (step >= dist) {
      this.position = { ...target };
      this.pathIndex++;
      if (this.pathIndex >= this.path.length - 1) {
        this.reachedEnd = true;
        this.alive = false;
      }
    } else {
      this.position.x += (dx / dist) * step;
      this.position.z += (dz / dist) * step;
    }
  }

  distanceTo2D(pos: Vec3): number {
    const dx = pos.x - this.position.x;
    const dz = pos.z - this.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
