import * as THREE from 'three';
import type { EnemyLogic } from './enemies';
import { TowerLogic, TOWER_CONFIGS } from './towers';
import { WaveLogic } from './waves';
import { goldStore } from '../exercise/rewards';

export interface GridCell {
  row: number;
  col: number;
  hasTower: boolean;
}

export class GridState {
  readonly rows: number;
  readonly cols: number;
  readonly cellSize: number;
  private _cells: GridCell[][];

  constructor(rows = 8, cols = 8, cellSize = 0.4) {
    this.rows = rows;
    this.cols = cols;
    this.cellSize = cellSize;
    this._cells = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({ row: r, col: c, hasTower: false }))
    );
  }

  worldToCell(wx: number, wz: number): { row: number; col: number } | null {
    const startX = -(this.cols * this.cellSize) / 2;
    const startZ = -(this.rows * this.cellSize) / 2;
    const col = Math.floor((wx - startX) / this.cellSize);
    const row = Math.floor((wz - startZ) / this.cellSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return { row, col };
  }

  cellCenter(row: number, col: number): { x: number; z: number } {
    const startX = -(this.cols * this.cellSize) / 2;
    const startZ = -(this.rows * this.cellSize) / 2;
    return {
      x: startX + (col + 0.5) * this.cellSize,
      z: startZ + (row + 0.5) * this.cellSize,
    };
  }

  isOccupied(row: number, col: number): boolean {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;
    return this._cells[row][col].hasTower;
  }

  occupy(row: number, col: number): boolean {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;
    if (this._cells[row][col].hasTower) return false;
    this._cells[row][col].hasTower = true;
    return true;
  }

  get towerCount(): number {
    let count = 0;
    for (const row of this._cells) for (const cell of row) if (cell.hasTower) count++;
    return count;
  }

  getCell(row: number, col: number): GridCell | null {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return this._cells[row][col];
  }
}

export class DefenseGrid {
  private _state: GridState;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private gridGroup: THREE.Group;
  private towerMeshes = new Map<string, THREE.Mesh>();
  private towerLogics = new Map<string, TowerLogic>();
  private enemyMeshes = new Map<number, THREE.Mesh>();
  private projectileMeshes: THREE.Mesh[] = [];
  private groundPlane: THREE.Plane;
  private _clickHandler: (e: MouseEvent) => void;
  private wave: WaveLogic;
  private waveStarted = false;
  private animFrameId = 0;
  private lastUpdate = performance.now();
  private accumulatedTime = 0;
  private _inputEnabled = false;
  private _waveCompleteFired = false;
  private _lastReachedEndCount = 0;
  onWaveComplete: (() => void) | null = null;
  onEnemyReachedEnd: (() => void) | null = null;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    rows = 8,
    cols = 8,
    cellSize = 0.4
  ) {
    this._state = new GridState(rows, cols, cellSize);
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.gridGroup = new THREE.Group();
    this.wave = new WaveLogic(this._buildPath());
    this._buildVisual();
    scene.add(this.gridGroup);
    this._clickHandler = this._handleClick.bind(this);
    renderer.domElement.addEventListener('click', this._clickHandler);
    this._tick();
  }

  setInputEnabled(enabled: boolean): void {
    this._inputEnabled = enabled;
  }

  get towerCount(): number {
    return this._state.towerCount;
  }

  get aliveEnemyCount(): number {
    return this.wave.alive.length;
  }

  get killedEnemyCount(): number {
    return this.wave.killedCount;
  }

  get reachedEndCount(): number {
    return this.wave.reachedEndCount;
  }

  get spawnedEnemyCount(): number {
    return this.wave.enemies.length;
  }

  get waveComplete(): boolean {
    return this.wave.complete;
  }

  cellScreenPoint(row: number, col: number): { x: number; y: number } | null {
    const cell = this._state.getCell(row, col);
    if (!cell) return null;

    const center = this._state.cellCenter(row, col);
    const projected = new THREE.Vector3(center.x, 0, center.z).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + ((projected.x + 1) / 2) * rect.width,
      y: rect.top + ((-projected.y + 1) / 2) * rect.height,
    };
  }

  placeTowerAt(row: number, col: number): boolean {
    if (this._state.isOccupied(row, col)) return false;
    if (!goldStore.getState().spendGold(TOWER_CONFIGS.basic.cost)) return false;
    if (!this._state.occupy(row, col)) return false;
    this._spawnTowerMesh(row, col);
    this._spawnTowerLogic(row, col);
    if (!this.waveStarted) {
      this.wave.start(0);
      this.waveStarted = true;
    }
    return true;
  }

  startWave(): void {
    if (!this.waveStarted) {
      this.wave.start(0);
      this.waveStarted = true;
    }
  }

  private _buildPath(): { x: number; y: number; z: number }[] {
    const row = Math.floor(this._state.rows / 2);
    const left = this._state.cellCenter(row, 0);
    const right = this._state.cellCenter(row, this._state.cols - 1);
    return [
      { x: left.x - this._state.cellSize * 1.5, y: 0.1, z: left.z },
      { x: right.x + this._state.cellSize * 1.5, y: 0.1, z: right.z },
    ];
  }

  private _buildVisual(): void {
    const { rows, cols, cellSize } = this._state;
    const totalW = cols * cellSize;
    const totalH = rows * cellSize;
    const sx = -totalW / 2;
    const sz = -totalH / 2;
    const mat = new THREE.LineBasicMaterial({ color: 0x00ff88, opacity: 0.5, transparent: true });
    for (let r = 0; r <= rows; r++) {
      const z = sz + r * cellSize;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(sx, 0.01, z),
        new THREE.Vector3(sx + totalW, 0.01, z),
      ]);
      this.gridGroup.add(new THREE.Line(geo, mat));
    }
    for (let c = 0; c <= cols; c++) {
      const x = sx + c * cellSize;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.01, sz),
        new THREE.Vector3(x, 0.01, sz + totalH),
      ]);
      this.gridGroup.add(new THREE.Line(geo, mat));
    }
  }

  private _spawnTowerMesh(row: number, col: number): void {
    const { cellSize } = this._state;
    const center = this._state.cellCenter(row, col);
    const h = cellSize * 0.8;
    const geo = new THREE.BoxGeometry(cellSize * 0.7, h, cellSize * 0.7);
    const mat = new THREE.MeshLambertMaterial({ color: 0x4488ff });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(center.x, h / 2, center.z);
    this.scene.add(mesh);
    this.towerMeshes.set(`${row},${col}`, mesh);
  }

  private _spawnTowerLogic(row: number, col: number): void {
    const center = this._state.cellCenter(row, col);
    this.towerLogics.set(`${row},${col}`, new TowerLogic(row, col, {
      x: center.x,
      y: this._state.cellSize * 0.8,
      z: center.z,
    }));
  }

  private _spawnEnemyMesh(enemy: EnemyLogic): void {
    const geo = new THREE.SphereGeometry(0.09, 16, 12);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff5555 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
    this.scene.add(mesh);
    this.enemyMeshes.set(enemy.id, mesh);
  }

  private _syncEnemyMeshes(): void {
    for (const enemy of this.wave.enemies) {
      const mesh = this.enemyMeshes.get(enemy.id);
      if (!mesh) continue;
      mesh.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
      if (!enemy.alive) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.enemyMeshes.delete(enemy.id);
      }
    }
  }

  private _syncProjectileMeshes(): void {
    for (const mesh of this.projectileMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.projectileMeshes = [];

    for (const tower of this.towerLogics.values()) {
      for (const projectile of tower.projectiles) {
        const geo = new THREE.SphereGeometry(0.035, 10, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffee66 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(projectile.position.x, projectile.position.y, projectile.position.z);
        this.scene.add(mesh);
        this.projectileMeshes.push(mesh);
      }
    }
  }

  private _tick(): void {
    const now = performance.now();
    const elapsed = Math.min((now - this.lastUpdate) / 1000, 1);
    this.lastUpdate = now;
    this.accumulatedTime += elapsed;

    const fixedStep = 0.05;
    let steps = 0;
    while (this.accumulatedTime >= fixedStep && steps < 30) {
      this._updateSimulation(fixedStep);
      this.accumulatedTime -= fixedStep;
      steps++;
    }

    this._syncEnemyMeshes();
    this._syncProjectileMeshes();

    this.animFrameId = requestAnimationFrame(() => this._tick());
  }

  private _updateSimulation(dt: number): void {
    if (!this.waveStarted || this.waveComplete) return;
    this.wave.update(dt, enemy => this._spawnEnemyMesh(enemy));
    for (const tower of this.towerLogics.values()) {
      tower.update(dt, this.wave.enemies);
    }
    const newReached = this.wave.reachedEndCount - this._lastReachedEndCount;
    if (newReached > 0) {
      this._lastReachedEndCount = this.wave.reachedEndCount;
      for (let i = 0; i < newReached; i++) {
        this.onEnemyReachedEnd?.();
      }
    }

    if (this.wave.complete && !this._waveCompleteFired) {
      this._waveCompleteFired = true;
      this.onWaveComplete?.();
    }
  }

  private _handleClick(event: MouseEvent): void {
    if (!this._inputEnabled) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hitPoint = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(this.groundPlane, hitPoint)) return;
    const cellCoord = this._state.worldToCell(hitPoint.x, hitPoint.z);
    if (!cellCoord) return;
    this.placeTowerAt(cellCoord.row, cellCoord.col);
  }

  dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    this.renderer.domElement.removeEventListener('click', this._clickHandler);
    this.scene.remove(this.gridGroup);
    for (const mesh of this.towerMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.towerMeshes.clear();
    this.towerLogics.clear();
    for (const mesh of this.enemyMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.enemyMeshes.clear();
    for (const mesh of this.projectileMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.projectileMeshes = [];
  }
}
