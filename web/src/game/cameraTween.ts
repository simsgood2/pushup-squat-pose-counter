import * as THREE from 'three';
import type { CameraPreset } from './cameraPresets';

export class CameraTween {
  private start = 0;
  private duration = 1.0;
  private from?: { pos: THREE.Vector3; look: THREE.Vector3 };
  private to?: { pos: THREE.Vector3; look: THREE.Vector3 };
  active = false;

  begin(camera: THREE.PerspectiveCamera, currentLookAt: THREE.Vector3, target: CameraPreset, duration = 1.0): void {
    this.from = { pos: camera.position.clone(), look: currentLookAt.clone() };
    this.to   = { pos: target.position.clone(), look: target.lookAt.clone() };
    this.start = performance.now();
    this.duration = duration;
    this.active = true;
  }

  /** Returns updated look-at point, or null if no tween. */
  update(camera: THREE.PerspectiveCamera): THREE.Vector3 | null {
    if (!this.active || !this.from || !this.to) return null;
    const t = Math.min(1, (performance.now() - this.start) / 1000 / this.duration);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(this.from.pos, this.to.pos, e);
    const look = new THREE.Vector3().lerpVectors(this.from.look, this.to.look, e);
    camera.lookAt(look);
    if (t >= 1) this.active = false;
    return look;
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
