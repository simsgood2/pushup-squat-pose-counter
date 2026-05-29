import * as THREE from 'three';
import type { EnemyLogic } from './enemies';
import { TowerLogic, TOWER_CONFIGS, type TowerKind } from './towers';
import { WaveLogic, WAVES } from './waves';
import { goldStore } from '../exercise/rewards';
import { phaseStore } from '../game/phaseMachine';
import { towerSelectionStore } from './towerSelection';

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

  clearTowers(): void {
    for (const row of this._cells) {
      for (const cell of row) {
        cell.hasTower = false;
      }
    }
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
  private _mousemoveHandler: (e: MouseEvent) => void;
  private wave: WaveLogic;
  private _path: { x: number; y: number; z: number }[];
  private _pathCells = new Set<string>();
  private waveStarted = false;
  private animFrameId = 0;
  private lastUpdate = performance.now();
  private accumulatedTime = 0;
  private _inputEnabled = false;
  private _waveCompleteFired = false;
  private _lastReachedEndCount = 0;
  private _rangeRingMesh: THREE.Mesh;
  private _splashRingMesh: THREE.Mesh;
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

    this._path = this._buildPath();
    this._markPathCells();
    this.wave = new WaveLogic(this._path);

    this._rangeRingMesh = this._makeRingMesh(0xffffff, 0.4);
    this._splashRingMesh = this._makeRingMesh(0xff8844, 0.3);

    this._buildVisual();
    scene.add(this.gridGroup);

    this._clickHandler = this._handleClick.bind(this);
    this._mousemoveHandler = this._handleMousemove.bind(this);
    renderer.domElement.addEventListener('click', this._clickHandler);
    renderer.domElement.addEventListener('mousemove', this._mousemoveHandler);

    this._tick();
  }

  private _makeRingMesh(color: number, opacity: number): THREE.Mesh {
    const geo = new THREE.RingGeometry(0.92, 1.0, 64);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    this.scene.add(mesh);
    return mesh;
  }

  showRangePreview(x: number, z: number, kind: TowerKind): void {
    const cfg = TOWER_CONFIGS[kind];
    this._rangeRingMesh.position.set(x, 0.02, z);
    this._rangeRingMesh.scale.setScalar(cfg.range);
    this._rangeRingMesh.visible = true;

    if (kind === 'area' && cfg.splashRadius) {
      this._splashRingMesh.position.set(x, 0.02, z);
      this._splashRingMesh.scale.setScalar(cfg.splashRadius);
      this._splashRingMesh.visible = true;
    } else {
      this._splashRingMesh.visible = false;
    }
  }

  hideRangePreview(): void {
    this._rangeRingMesh.visible = false;
    this._splashRingMesh.visible = false;
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

  placeTowerAt(row: number, col: number, kind?: TowerKind): boolean {
    const k = kind ?? towerSelectionStore.getState().selectedKind;
    if (this._isPathCell(row, col)) return false;
    if (this._state.isOccupied(row, col)) return false;
    if (!goldStore.getState().spendGold(TOWER_CONFIGS[k].cost)) return false;
    if (!this._state.occupy(row, col)) return false;
    this._spawnTowerMesh(row, col, k);
    this._spawnTowerLogic(row, col, k);
    return true;
  }

  startWave(): void {
    for (const mesh of this.enemyMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.enemyMeshes.clear();
    const roundIndex = Math.min(phaseStore.getState().round - 1, WAVES.length - 1);
    this.wave.start(roundIndex);
    this.waveStarted = true;
    this._waveCompleteFired = false;
    this._lastReachedEndCount = 0;
  }

  reset(): void {
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

    this._state.clearTowers();
    this.waveStarted = false;
    this._waveCompleteFired = false;
    this._lastReachedEndCount = 0;
    this.wave = new WaveLogic(this._path);
    this.hideRangePreview();
  }

  private _buildPath(): { x: number; y: number; z: number }[] {
    const s = this._state;
    const cs = s.cellSize;
    const bl = s.cellCenter(s.rows - 1, 0);
    const tl = s.cellCenter(0, 0);
    const tr = s.cellCenter(0, s.cols - 1);
    const br = s.cellCenter(s.rows - 1, s.cols - 1);
    return [
      { x: bl.x, y: 0.1, z: bl.z + cs * 1.5 },  // spawn (outside grid)
      { x: bl.x, y: 0.1, z: bl.z },               // bottom-left
      { x: tl.x, y: 0.1, z: tl.z },               // top-left
      { x: tr.x, y: 0.1, z: tr.z },               // top-right
      { x: br.x, y: 0.1, z: br.z },               // bottom-right
      { x: br.x, y: 0.1, z: br.z + cs * 1.5 },   // end (outside grid)
    ];
  }

  private _markPathCells(): void {
    const { rows, cols } = this._state;
    this._pathCells.clear();
    for (let r = 0; r < rows; r++) {
      this._pathCells.add(`${r},0`);
      this._pathCells.add(`${r},${cols - 1}`);
    }
    for (let c = 0; c < cols; c++) {
      this._pathCells.add(`0,${c}`);
    }
  }

  private _isPathCell(row: number, col: number): boolean {
    return this._pathCells.has(`${row},${col}`);
  }

  private _buildVisual(): void {
    const { rows, cols, cellSize } = this._state;
    const totalW = cols * cellSize;
    const totalH = rows * cellSize;
    const sx = -totalW / 2;
    const sz = -totalH / 2;

    // Grid lines
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

    // Path floor tiles (brown)
    const pathMat = new THREE.MeshBasicMaterial({ color: 0x6b4f2e });
    for (const key of this._pathCells) {
      const [r, c] = key.split(',').map(Number);
      const center = this._state.cellCenter(r, c);
      const geo = new THREE.PlaneGeometry(cellSize, cellSize);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, pathMat);
      mesh.position.set(center.x, 0.005, center.z);
      this.gridGroup.add(mesh);
    }

    // Spawn marker (green cylinder at first path point)
    const spawn = this._path[0];
    const spawnGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16);
    const spawnMat = new THREE.MeshBasicMaterial({ color: 0x55ff88 });
    const spawnMesh = new THREE.Mesh(spawnGeo, spawnMat);
    spawnMesh.position.set(spawn.x, 0.025, spawn.z);
    this.gridGroup.add(spawnMesh);

    // End marker (red cylinder at last path point)
    const end = this._path[this._path.length - 1];
    const endGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16);
    const endMat = new THREE.MeshBasicMaterial({ color: 0xff5555 });
    const endMesh = new THREE.Mesh(endGeo, endMat);
    endMesh.position.set(end.x, 0.025, end.z);
    this.gridGroup.add(endMesh);
  }

  private _spawnTowerMesh(row: number, col: number, kind: TowerKind): void {
    const { cellSize } = this._state;
    const center = this._state.cellCenter(row, col);
    const h = cellSize * 0.8;
    const geo = new THREE.BoxGeometry(cellSize * 0.7, h, cellSize * 0.7);
    const mat = new THREE.MeshLambertMaterial({ color: TOWER_CONFIGS[kind].color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(center.x, h / 2, center.z);
    this.scene.add(mesh);
    this.towerMeshes.set(`${row},${col}`, mesh);
  }

  private _spawnTowerLogic(row: number, col: number, kind: TowerKind): void {
    const center = this._state.cellCenter(row, col);
    this.towerLogics.set(`${row},${col}`, new TowerLogic(row, col, {
      x: center.x,
      y: this._state.cellSize * 0.8,
      z: center.z,
    }, kind));
  }

  private _spawnEnemyMesh(enemy: EnemyLogic): void {
    const radius = 0.09 * (enemy.config.scale ?? 1);
    const geo = new THREE.SphereGeometry(radius, 16, 12);
    const mat = new THREE.MeshLambertMaterial({ color: enemy.config.color ?? 0xff5555 });
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
      const gold = tower.update(dt, this.wave.enemies);
      if (gold > 0) {
        const gs = goldStore.getState();
        gs.addGold(gold, gs.combo, gs.variety);
      }
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

  private _handleMousemove(event: MouseEvent): void {
    const phase = phaseStore.getState().phase;
    if (phase !== 'Build' && phase !== 'Defense') {
      this.hideRangePreview();
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hitPoint = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(this.groundPlane, hitPoint)) {
      this.hideRangePreview();
      return;
    }
    const cellCoord = this._state.worldToCell(hitPoint.x, hitPoint.z);
    if (!cellCoord) {
      this.hideRangePreview();
      return;
    }
    const center = this._state.cellCenter(cellCoord.row, cellCoord.col);
    const kind = towerSelectionStore.getState().selectedKind;
    this.showRangePreview(center.x, center.z, kind);
  }

  dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    this.renderer.domElement.removeEventListener('click', this._clickHandler);
    this.renderer.domElement.removeEventListener('mousemove', this._mousemoveHandler);
    this.scene.remove(this.gridGroup);
    this.scene.remove(this._rangeRingMesh);
    this.scene.remove(this._splashRingMesh);
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
