export interface Vec3 { x: number; y: number; z: number }

export interface EnemyConfig {
  hp: number;
  speed: number;   // world units per second
  reward: number;  // gold on death
}

export const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
  basic: { hp: 100, speed: 1.2, reward: 10 },
};

export class EnemyLogic {
  readonly id: number;
  position: Vec3;
  private _hp: number;
  readonly maxHp: number;
  readonly speed: number;
  readonly reward: number;
  alive = true;
  reachedEnd = false;
  private path: Vec3[];
  private pathIndex = 0;

  constructor(id: number, config: EnemyConfig, path: Vec3[]) {
    this.id = id;
    this._hp = config.hp;
    this.maxHp = config.hp;
    this.speed = config.speed;
    this.reward = config.reward;
    this.path = path;
    this.position = { ...path[0] };
  }

  get hp(): number { return this._hp; }

  /** Returns true if this hit killed the enemy. */
  takeDamage(amount: number): boolean {
    if (!this.alive) return false;
    this._hp = Math.max(0, this._hp - amount);
    if (this._hp === 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  update(dt: number): void {
    if (!this.alive || this.reachedEnd) return;
    if (this.pathIndex >= this.path.length - 1) {
      this.reachedEnd = true;
      this.alive = false;
      return;
    }
    const target = this.path[this.pathIndex + 1];
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const step = this.speed * dt;
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
