import * as THREE from 'three';

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
  private groundPlane: THREE.Plane;
  private _clickHandler: (e: MouseEvent) => void;

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
    this._buildVisual();
    scene.add(this.gridGroup);
    this._clickHandler = this._handleClick.bind(this);
    renderer.domElement.addEventListener('click', this._clickHandler);
  }

  get towerCount(): number {
    return this._state.towerCount;
  }

  placeTowerAt(row: number, col: number): boolean {
    if (!this._state.occupy(row, col)) return false;
    this._spawnTowerMesh(row, col);
    return true;
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

  private _handleClick(event: MouseEvent): void {
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
    this.renderer.domElement.removeEventListener('click', this._clickHandler);
    this.scene.remove(this.gridGroup);
    for (const mesh of this.towerMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.towerMeshes.clear();
  }
}
