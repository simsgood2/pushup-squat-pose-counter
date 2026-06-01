import * as THREE from 'three';
import type { Vec3 } from './enemies';

/**
 * Transient particle effects for the defense board: projectile glow sprites,
 * hit sparks, enemy death bursts, and gold pickups. Everything uses additive
 * blending + a procedurally generated radial-gradient texture, so there are no
 * external asset dependencies.
 */

let _glowTexture: THREE.Texture | null = null;

/** Shared soft radial-gradient sprite texture (white core -> transparent). */
export function glowTexture(): THREE.Texture {
  if (_glowTexture) return _glowTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  _glowTexture = tex;
  return tex;
}

/** Build an additive glow sprite (caller positions/scales it). */
export function makeGlowSprite(color: number, scale: number): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(scale);
  return sprite;
}

interface Particle {
  object: THREE.Object3D;
  material: THREE.SpriteMaterial | THREE.MeshBasicMaterial;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  scale0: number;
  scale1: number;
  opacity0: number;
}

export class EffectsManager {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private particles: Particle[] = [];
  private ringGeo: THREE.RingGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.ringGeo = new THREE.RingGeometry(0.6, 1.0, 32);
    this.ringGeo.rotateX(-Math.PI / 2);
  }

  private addSpark(
    pos: Vec3, color: number, speed: number, life: number,
    scale0: number, scale1: number, opacity0: number, upBias = 0
  ): void {
    const sprite = makeGlowSprite(color, scale0);
    sprite.position.set(pos.x, pos.y, pos.z);
    this.group.add(sprite);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    this.particles.push({
      object: sprite,
      material: sprite.material,
      vx: Math.sin(phi) * Math.cos(theta) * speed,
      vy: Math.cos(phi) * speed * 0.5 + upBias,
      vz: Math.sin(phi) * Math.sin(theta) * speed,
      age: 0, life, scale0, scale1, opacity0,
    });
  }

  /** Small spark burst at a projectile impact. */
  spawnHit(pos: Vec3, color: number): void {
    for (let i = 0; i < 5; i++) {
      this.addSpark(pos, color, 0.7, 0.22, 0.12, 0.02, 0.9);
    }
  }

  /** Expanding ring + puff when an enemy dies. */
  spawnDeath(pos: Vec3, color: number, scale = 1): void {
    const ringMat = new THREE.MeshBasicMaterial({
      color, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(this.ringGeo, ringMat);
    ring.position.set(pos.x, pos.y + 0.01, pos.z);
    this.group.add(ring);
    this.particles.push({
      object: ring, material: ringMat,
      vx: 0, vy: 0, vz: 0, age: 0, life: 0.45,
      scale0: 0.08 * scale, scale1: 0.5 * scale, opacity0: 0.8,
    });
    for (let i = 0; i < 7; i++) {
      this.addSpark(pos, color, 0.9 * scale, 0.4, 0.14 * scale, 0.02, 0.9);
    }
  }

  /** Gold sparkles drifting upward on a kill reward. */
  spawnGold(pos: Vec3): void {
    for (let i = 0; i < 5; i++) {
      this.addSpark(pos, 0xffdd55, 0.35, 0.6, 0.1, 0.02, 1.0, 0.6);
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        this.group.remove(p.object);
        p.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.object.position.x += p.vx * dt;
      p.object.position.y += p.vy * dt;
      p.object.position.z += p.vz * dt;
      const s = p.scale0 + (p.scale1 - p.scale0) * t;
      p.object.scale.setScalar(s);
      p.material.opacity = p.opacity0 * (1 - t);
    }
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** Remove all active particles (e.g. on reset). */
  clear(): void {
    for (const p of this.particles) {
      this.group.remove(p.object);
      p.material.dispose();
    }
    this.particles.length = 0;
  }

  dispose(): void {
    this.clear();
    this.scene.remove(this.group);
    this.ringGeo.dispose();
  }
}
