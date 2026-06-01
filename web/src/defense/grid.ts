import * as THREE from 'three';
import type { EnemyLogic } from './enemies';
import { TowerLogic, TOWER_CONFIGS, type TowerKind } from './towers';
import { WaveLogic, WAVES } from './waves';
import { goldStore } from '../exercise/rewards';
import { phaseStore } from '../game/phaseMachine';
import { towerSelectionStore } from './towerSelection';
import { createTowerObject, createEnemyObject, disposeObject3D, type TowerVisual } from './visuals';
import { EffectsManager, makeGlowSprite } from './effects';

const PROJECTILE_COLORS: Record<TowerKind, number> = {
  basic: 0x66aaff,
  area: 0xffaa55,
  slow: 0x88ddff,
};

const TRAIL_LENGTH = 8;

// Cells of buildable margin between the board edge and the ⊓ path, so towers
// can be placed on both sides of the road (not just inside it).
const PATH_MARGIN = 2;

interface ProjectileViz {
  glow: THREE.Sprite;
  core: THREE.Mesh;
  trail: THREE.Line;
  positions: THREE.Vector3[];
}

const COLORS = {
  bgDeep:    0x07090d,
  bgPanel:   0x0e1218,
  accentCyan:  0x00ffd1,
  accentBlue:  0x4d8aff,
  warn:        0xff3360,
  gridLine:    0x1a3340,
  gridLineHi:  0x33ffd1,
  pathBase:    0x0a1e26,
  pathGlow:    0x00ffd1,
  buildPanel:  0x0a1822,
  buildGrid:   0x2a5c66,
  textBase:    0xe6f1ff,
  textDim:     0x7d92b0,
};

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
  private towerVisuals = new Map<string, TowerVisual>();
  private towerLogics = new Map<string, TowerLogic>();
  private enemyMeshes = new Map<number, THREE.Object3D>();
  private projectileViz = new Map<number, ProjectileViz>();
  private effects: EffectsManager;
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
  private _hoverCellMesh: THREE.Mesh;
  private _spawnMarkerMesh: THREE.Mesh;
  private _endMarkerMesh: THREE.Mesh;
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
    this.effects = new EffectsManager(scene);

    this._path = this._buildPath();
    this._markPathCells();
    this.wave = new WaveLogic(this._path);

    this._rangeRingMesh = this._makeRingMesh(0xffffff, 0.4);
    this._splashRingMesh = this._makeRingMesh(0xff8844, 0.3);

    this._hoverCellMesh = this._makeHoverCellMesh();
    this._spawnMarkerMesh = new THREE.Mesh();
    this._endMarkerMesh = new THREE.Mesh();

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

  private _makeHoverCellMesh(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.gridLineHi, transparent: true, opacity: 0.35 });
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

  setVisible(visible: boolean): void {
    this.gridGroup.visible = visible;
    for (const tv of this.towerVisuals.values()) {
      tv.object.visible = visible;
    }
    for (const mesh of this.enemyMeshes.values()) {
      mesh.visible = visible;
    }
    for (const viz of this.projectileViz.values()) {
      viz.glow.visible = visible;
      viz.core.visible = visible;
      viz.trail.visible = visible;
    }
    this.effects.setVisible(visible);
    this._rangeRingMesh.visible = visible && this._rangeRingMesh.visible;
    this._splashRingMesh.visible = visible && this._splashRingMesh.visible;
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
      disposeObject3D(mesh);
    }
    this.enemyMeshes.clear();
    this._clearProjectileViz();
    this.effects.clear();
    const roundIndex = Math.min(phaseStore.getState().round - 1, WAVES.length - 1);
    this.wave.start(roundIndex);
    this.waveStarted = true;
    this._waveCompleteFired = false;
    this._lastReachedEndCount = 0;
  }

  reset(): void {
    for (const tv of this.towerVisuals.values()) {
      this.scene.remove(tv.object);
      disposeObject3D(tv.object);
    }
    this.towerVisuals.clear();
    this.towerLogics.clear();

    for (const mesh of this.enemyMeshes.values()) {
      this.scene.remove(mesh);
      disposeObject3D(mesh);
    }
    this.enemyMeshes.clear();

    this._clearProjectileViz();
    this.effects.clear();

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
    const m = PATH_MARGIN;
    const upCol = m;
    const downCol = s.cols - 1 - m;
    const topRow = m;
    const botRow = s.rows - 1;
    const up = s.cellCenter(botRow, upCol);        // bottom of the up-leg
    const upTop = s.cellCenter(topRow, upCol);     // top-left corner
    const downTop = s.cellCenter(topRow, downCol); // top-right corner
    const down = s.cellCenter(botRow, downCol);    // bottom of the down-leg
    return [
      { x: up.x, y: 0.1, z: up.z + cs * 1.5 },     // spawn (outside grid)
      { x: up.x, y: 0.1, z: up.z },
      { x: upTop.x, y: 0.1, z: upTop.z },
      { x: downTop.x, y: 0.1, z: downTop.z },
      { x: down.x, y: 0.1, z: down.z },
      { x: down.x, y: 0.1, z: down.z + cs * 1.5 }, // end (outside grid)
    ];
  }

  private _markPathCells(): void {
    const { rows, cols } = this._state;
    const m = PATH_MARGIN;
    const upCol = m;
    const downCol = cols - 1 - m;
    const topRow = m;
    const botRow = rows - 1;
    this._pathCells.clear();
    for (let r = topRow; r <= botRow; r++) {
      this._pathCells.add(`${r},${upCol}`);
      this._pathCells.add(`${r},${downCol}`);
    }
    for (let c = upCol; c <= downCol; c++) {
      this._pathCells.add(`${topRow},${c}`);
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

    // Buildable = whole board except the path cells; road is drawn on top.
    const xLeft = sx;
    const xRight = sx + totalW;
    const zTop = sz;
    const zBottom = sz + totalH;

    // Faint panel across the whole board so it reads as the placement surface.
    const panelGeo = new THREE.PlaneGeometry(totalW, totalH);
    panelGeo.rotateX(-Math.PI / 2);
    const panelMat = new THREE.MeshBasicMaterial({ color: COLORS.buildPanel, transparent: true, opacity: 0.35 });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(0, 0.004, 0);
    this.gridGroup.add(panel);

    // Faint grid lines across the whole board.
    const gridMat = new THREE.LineBasicMaterial({ color: COLORS.buildGrid, transparent: true, opacity: 0.5 });
    for (let r = 0; r <= rows; r++) {
      const z = sz + r * cellSize;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(xLeft, 0.006, z),
        new THREE.Vector3(xRight, 0.006, z),
      ]);
      this.gridGroup.add(new THREE.Line(geo, gridMat));
    }
    for (let c = 0; c <= cols; c++) {
      const x = sx + c * cellSize;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.006, zTop),
        new THREE.Vector3(x, 0.006, zBottom),
      ]);
      this.gridGroup.add(new THREE.Line(geo, gridMat));
    }

    // Continuous road ribbon over the path (drawn above the grid).
    this._buildRoad();

    // Spawn marker (cyan cylinder at first path point)
    const spawn = this._path[0];
    const spawnGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16);
    const spawnMat = new THREE.MeshBasicMaterial({ color: COLORS.accentCyan });
    this._spawnMarkerMesh = new THREE.Mesh(spawnGeo, spawnMat);
    this._spawnMarkerMesh.position.set(spawn.x, 0.015, spawn.z);
    this.gridGroup.add(this._spawnMarkerMesh);

    // End marker (warn/red cylinder at last path point)
    const end = this._path[this._path.length - 1];
    const endGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16);
    const endMat = new THREE.MeshBasicMaterial({ color: COLORS.warn });
    this._endMarkerMesh = new THREE.Mesh(endGeo, endMat);
    this._endMarkerMesh.position.set(end.x, 0.015, end.z);
    this.gridGroup.add(this._endMarkerMesh);
  }

  /** Continuous glowing road ribbon following the enemy path polyline. */
  private _buildRoad(): void {
    const rw = this._state.cellSize * 0.82;
    const glowMat = new THREE.MeshBasicMaterial({
      color: COLORS.pathGlow, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const roadMat = new THREE.MeshBasicMaterial({ color: COLORS.pathBase, transparent: true, opacity: 0.92 });

    for (let i = 0; i < this._path.length - 1; i++) {
      const a = this._path[i];
      const b = this._path[i + 1];
      this._addRoadSegment(a, b, rw + 0.1, glowMat, 0.007); // soft glowing shoulder
      this._addRoadSegment(a, b, rw, roadMat, 0.009);       // road body (above grid)
    }

    // Glowing centerline conveys the travel direction.
    const centerGeo = new THREE.BufferGeometry().setFromPoints(
      this._path.map((p) => new THREE.Vector3(p.x, 0.011, p.z))
    );
    const centerMat = new THREE.LineBasicMaterial({ color: COLORS.pathGlow, transparent: true, opacity: 0.45 });
    this.gridGroup.add(new THREE.Line(centerGeo, centerMat));
  }

  /** Adds one axis-aligned road quad, extended by `width` to fill corners. */
  private _addRoadSegment(
    a: { x: number; z: number },
    b: { x: number; z: number },
    width: number,
    mat: THREE.Material,
    y: number
  ): void {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const horizontal = Math.abs(dx) > Math.abs(dz);
    const w = horizontal ? len + width : width;
    const h = horizontal ? width : len + width;
    const geo = new THREE.PlaneGeometry(w, h);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
    this.gridGroup.add(mesh);
  }

  private _spawnTowerMesh(row: number, col: number, kind: TowerKind): void {
    const center = this._state.cellCenter(row, col);
    const visual = createTowerObject(kind);
    visual.object.position.set(center.x, 0, center.z);
    this.scene.add(visual.object);
    this.towerVisuals.set(`${row},${col}`, visual);
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
    const mesh = createEnemyObject(enemy.config);
    mesh.position.set(enemy.position.x, enemy.position.y + 0.12, enemy.position.z);
    this.scene.add(mesh);
    this.enemyMeshes.set(enemy.id, mesh);
  }

  private _syncEnemyMeshes(): void {
    for (const enemy of this.wave.enemies) {
      const mesh = this.enemyMeshes.get(enemy.id);
      if (!mesh) continue;
      mesh.position.set(enemy.position.x, enemy.position.y + 0.12, enemy.position.z);
      if (!enemy.alive) {
        // Killed enemies burst + drop gold; ones that reached the exit just leave.
        if (!enemy.reachedEnd) {
          this.effects.spawnDeath(
            { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
            enemy.config.color ?? 0xff5566,
            enemy.config.scale ?? 1
          );
          if (enemy.reward > 0) {
            this.effects.spawnGold({ x: mesh.position.x, y: mesh.position.y, z: mesh.position.z });
          }
        }
        this.scene.remove(mesh);
        disposeObject3D(mesh);
        this.enemyMeshes.delete(enemy.id);
      }
    }
  }

  private _syncProjectiles(): void {
    const live = new Set<number>();
    for (const tower of this.towerLogics.values()) {
      for (const proj of tower.projectiles) {
        live.add(proj.id);
        let viz = this.projectileViz.get(proj.id);
        if (!viz) {
          viz = this._makeProjectileViz(proj.kind, proj.position);
          this.projectileViz.set(proj.id, viz);
        }
        const p = proj.position;
        viz.glow.position.set(p.x, p.y, p.z);
        viz.core.position.set(p.x, p.y, p.z);
        viz.positions.push(new THREE.Vector3(p.x, p.y, p.z));
        if (viz.positions.length > TRAIL_LENGTH) viz.positions.shift();
        this._updateTrailGeometry(viz);
      }
    }
    for (const [id, viz] of this.projectileViz) {
      if (!live.has(id)) {
        this._removeProjectileViz(viz);
        this.projectileViz.delete(id);
      }
    }
  }

  private _makeProjectileViz(kind: TowerKind, pos: { x: number; y: number; z: number }): ProjectileViz {
    const color = PROJECTILE_COLORS[kind];
    const glow = makeGlowSprite(color, 0.18);
    glow.position.set(pos.x, pos.y, pos.z);
    this.scene.add(glow);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 10, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    core.position.set(pos.x, pos.y, pos.z);
    this.scene.add(core);

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(TRAIL_LENGTH * 3);
    const colors = new Float32Array(TRAIL_LENGTH * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const f = i / (TRAIL_LENGTH - 1); // 0 = tail (dim), 1 = head (bright)
      colors[i * 3] = c.r * f;
      colors[i * 3 + 1] = c.g * f;
      colors[i * 3 + 2] = c.b * f;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const trail = new THREE.Line(geo, mat);
    this.scene.add(trail);

    return { glow, core, trail, positions: [] };
  }

  private _updateTrailGeometry(viz: ProjectileViz): void {
    const attr = viz.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const pts = viz.positions;
    const n = pts.length;
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const srcIdx = n - TRAIL_LENGTH + i;
      const p = srcIdx >= 0 ? pts[srcIdx] : pts[0];
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    attr.needsUpdate = true;
  }

  private _removeProjectileViz(viz: ProjectileViz): void {
    this.scene.remove(viz.glow);
    viz.glow.material.dispose();
    this.scene.remove(viz.core);
    viz.core.geometry.dispose();
    (viz.core.material as THREE.Material).dispose();
    this.scene.remove(viz.trail);
    viz.trail.geometry.dispose();
    (viz.trail.material as THREE.Material).dispose();
  }

  private _clearProjectileViz(): void {
    for (const viz of this.projectileViz.values()) this._removeProjectileViz(viz);
    this.projectileViz.clear();
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
    this._syncProjectiles();
    this.effects.update(elapsed);

    const nowSec = now / 1000;

    // Tower cores spin + pulse for a sense of life.
    const corePulse = 1 + 0.12 * Math.sin(nowSec * 3);
    for (const tv of this.towerVisuals.values()) {
      tv.core.rotation.y = nowSec * 1.5;
      tv.core.scale.setScalar(corePulse);
    }

    // Enemies slowly rotate (boss ring orbits).
    for (const mesh of this.enemyMeshes.values()) {
      mesh.rotation.y = nowSec * 0.9;
    }

    // Update marker pulse animation
    const t = nowSec * 4; // frequency: 4 rad/s
    const pulse = 1 + 0.15 * Math.sin(t);
    this._spawnMarkerMesh.scale.x = pulse;
    this._spawnMarkerMesh.scale.z = pulse;
    this._endMarkerMesh.scale.x = pulse;
    this._endMarkerMesh.scale.z = pulse;

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
      if (tower.impacts.length > 0) {
        for (const im of tower.impacts) {
          this.effects.spawnHit(im.position, PROJECTILE_COLORS[im.kind]);
        }
        tower.impacts.length = 0;
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
      this._hoverCellMesh.visible = false;
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
      this._hoverCellMesh.visible = false;
      return;
    }
    const cellCoord = this._state.worldToCell(hitPoint.x, hitPoint.z);
    if (!cellCoord) {
      this.hideRangePreview();
      this._hoverCellMesh.visible = false;
      return;
    }
    const center = this._state.cellCenter(cellCoord.row, cellCoord.col);
    const kind = towerSelectionStore.getState().selectedKind;
    this.showRangePreview(center.x, center.z, kind);

    // Hover cell highlighting
    const isPath = this._isPathCell(cellCoord.row, cellCoord.col);
    const isOccupied = this._state.isOccupied(cellCoord.row, cellCoord.col);
    const shouldHighlight = !isPath && !isOccupied;

    this._hoverCellMesh.position.set(center.x, 0.008, center.z);
    this._hoverCellMesh.scale.set(this._state.cellSize, 1, this._state.cellSize);
    if (shouldHighlight) {
      (this._hoverCellMesh.material as THREE.MeshBasicMaterial).color.setHex(COLORS.gridLineHi);
      (this._hoverCellMesh.material as THREE.MeshBasicMaterial).opacity = 0.35;
    } else if (isPath || isOccupied) {
      (this._hoverCellMesh.material as THREE.MeshBasicMaterial).color.setHex(COLORS.warn);
      (this._hoverCellMesh.material as THREE.MeshBasicMaterial).opacity = 0.35;
    }
    this._hoverCellMesh.visible = true;
  }

  dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    this.renderer.domElement.removeEventListener('click', this._clickHandler);
    this.renderer.domElement.removeEventListener('mousemove', this._mousemoveHandler);
    this.scene.remove(this.gridGroup);
    this.scene.remove(this._rangeRingMesh);
    this.scene.remove(this._splashRingMesh);
    this.scene.remove(this._hoverCellMesh);
    this._hoverCellMesh.geometry.dispose();
    (this._hoverCellMesh.material as THREE.Material).dispose();
    for (const tv of this.towerVisuals.values()) {
      this.scene.remove(tv.object);
      disposeObject3D(tv.object);
    }
    this.towerVisuals.clear();
    this.towerLogics.clear();
    for (const mesh of this.enemyMeshes.values()) {
      this.scene.remove(mesh);
      disposeObject3D(mesh);
    }
    this.enemyMeshes.clear();
    this._clearProjectileViz();
    this.effects.dispose();
  }
}
