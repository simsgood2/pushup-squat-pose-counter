import * as THREE from 'three';
import type { LandmarkResult } from '../mocap/poseStream';

// MediaPipe Pose 33 landmark bone connections
const BONE_CONNECTIONS: [number, number][] = [
  // Face outline
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  // Shoulders
  [11, 12],
  // Left arm
  [11, 13], [13, 15],
  // Right arm
  [12, 14], [14, 16],
  // Torso
  [11, 23], [12, 24], [23, 24],
  // Left leg
  [23, 25], [25, 27], [27, 29], [29, 31],
  // Right leg
  [24, 26], [26, 28], [28, 30], [30, 32],
];

export class StickFigure {
  private spheres: THREE.Mesh[] = [];
  private boneMeshes: THREE.Mesh[] = [];
  private group: THREE.Group;
  private _visibleCount = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const sphereGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

    for (let i = 0; i < 33; i++) {
      const mesh = new THREE.Mesh(sphereGeo, sphereMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.spheres.push(mesh);
    }

    const boneMat = new THREE.MeshBasicMaterial({ color: 0x44cc88 });
    for (let i = 0; i < BONE_CONNECTIONS.length; i++) {
      // Unit cylinder along Y axis, scaled per bone
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 6), boneMat);
      cyl.visible = false;
      this.group.add(cyl);
      this.boneMeshes.push(cyl);
    }
  }

  get visibleCount(): number {
    return this._visibleCount;
  }

  update(result: LandmarkResult): void {
    const wl = result.worldLandmarks?.[0];
    if (!wl || wl.length < 33) {
      this.spheres.forEach(s => (s.visible = false));
      this.boneMeshes.forEach(b => (b.visible = false));
      this._visibleCount = 0;
      return;
    }

    // MediaPipe worldLandmarks: x right, y down, z away-from-camera (meters)
    // Three.js: x right, y up, z toward-viewer → flip Y and Z
    for (let i = 0; i < 33; i++) {
      const lm = wl[i];
      this.spheres[i].position.set(lm.x, -lm.y, -lm.z);
      this.spheres[i].visible = true;
    }
    this._visibleCount = 33;

    const up = new THREE.Vector3(0, 1, 0);
    BONE_CONNECTIONS.forEach(([a, b], idx) => {
      const pA = this.spheres[a].position;
      const pB = this.spheres[b].position;
      const dir = new THREE.Vector3().subVectors(pB, pA);
      const len = dir.length();
      const bone = this.boneMeshes[idx];

      if (len < 0.001) {
        bone.visible = false;
        return;
      }

      bone.position.addVectors(pA, pB).multiplyScalar(0.5);
      bone.scale.set(1, len, 1);
      bone.quaternion.setFromUnitVectors(up, dir.normalize());
      bone.visible = true;
    });
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}
