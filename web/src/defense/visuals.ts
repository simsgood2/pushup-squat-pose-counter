import * as THREE from 'three';
import { TOWER_CONFIGS, type TowerKind } from './towers';
import type { EnemyConfig } from './enemies';

/**
 * Procedural geometry factory for towers and enemies.
 *
 * All visuals are built from Three.js primitives + emissive MeshStandardMaterial
 * so the T4.9 bloom pass picks up the neon glow. To swap in real GLB assets later,
 * only the internals of `createTowerObject` / `createEnemyObject` need to change —
 * their signatures (and the animated `core` contract) stay the same.
 */

export interface TowerVisual {
  /** Root object placed at the cell center (origin at ground level). */
  object: THREE.Group;
  /** Sub-object the grid spins/pulses each frame for a sense of life. */
  core: THREE.Object3D;
}

function neonMaterial(
  color: number,
  emissiveIntensity: number,
  metalness = 0.4,
  roughness = 0.4
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity,
    metalness,
    roughness,
  });
}

function enableShadows(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
}

/** Recursively dispose geometries and materials of an object tree. */
export function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = (mesh as THREE.Mesh).material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) (mat as THREE.Material).dispose();
  });
}

export function createTowerObject(kind: TowerKind): TowerVisual {
  const color = TOWER_CONFIGS[kind].color;
  const group = new THREE.Group();
  let core: THREE.Object3D;

  if (kind === 'area') {
    // Wide squat base + spinning ring + pulsing orange core.
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.17, 0.08, 24),
      neonMaterial(color, 0.25, 0.5, 0.5)
    );
    base.position.y = 0.04;
    group.add(base);

    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.06, 16),
      neonMaterial(color, 0.4)
    );
    collar.position.y = 0.11;
    group.add(collar);

    core = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.022, 12, 32),
      neonMaterial(color, 1.4, 0.3, 0.3)
    );
    ring.rotation.x = Math.PI / 2;
    core.add(ring);
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.055, 0),
      neonMaterial(color, 1.6, 0.2, 0.3)
    );
    core.add(orb);
    core.position.y = 0.2;
    group.add(core);
  } else if (kind === 'slow') {
    // Tall slender spire + pulsing cyan tip.
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.1, 20),
      neonMaterial(color, 0.25, 0.5, 0.5)
    );
    base.position.y = 0.05;
    group.add(base);

    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.22, 16),
      neonMaterial(color, 0.7, 0.3, 0.35)
    );
    spire.position.y = 0.21;
    group.add(spire);

    core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.05, 0),
      neonMaterial(color, 1.8, 0.2, 0.25)
    );
    core.position.y = 0.34;
    group.add(core);
  } else {
    // basic: hex base + central pillar + spinning octahedron core.
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.15, 0.12, 6),
      neonMaterial(color, 0.25, 0.5, 0.5)
    );
    base.position.y = 0.06;
    group.add(base);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.14, 12),
      neonMaterial(color, 0.5)
    );
    pillar.position.y = 0.18;
    group.add(pillar);

    core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.07, 0),
      neonMaterial(color, 1.6, 0.2, 0.25)
    );
    core.position.y = 0.3;
    group.add(core);
  }

  enableShadows(group);
  return { object: group, core };
}

export function createEnemyObject(config: EnemyConfig): THREE.Object3D {
  const color = config.color ?? 0xff5566;
  const scale = config.scale ?? 1;
  const group = new THREE.Group();

  switch (config.kind) {
    case 'fast': {
      // Sleek elongated dart.
      const body = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.08, 0),
        neonMaterial(color, 1.1, 0.3, 0.3)
      );
      body.scale.set(0.75, 0.75, 1.7);
      group.add(body);
      break;
    }
    case 'armored': {
      // Chunky faceted shell, metallic, low glow.
      const shell = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.12, 0),
        neonMaterial(color, 0.25, 0.85, 0.35)
      );
      group.add(shell);
      const coreOrb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.055, 0),
        neonMaterial(0x66ccff, 1.2, 0.2, 0.3)
      );
      group.add(coreOrb);
      break;
    }
    case 'boss': {
      // Large menacing core with an orbiting ring.
      const body = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.16, 0),
        neonMaterial(color, 1.0, 0.4, 0.3)
      );
      group.add(body);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.025, 12, 36),
        neonMaterial(0xff66ff, 1.4, 0.3, 0.3)
      );
      ring.rotation.x = Math.PI / 2.4;
      group.add(ring);
      break;
    }
    default: {
      // basic: simple faceted orb.
      const body = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.1, 0),
        neonMaterial(color, 1.0, 0.3, 0.35)
      );
      group.add(body);
      break;
    }
  }

  group.scale.setScalar(scale);
  enableShadows(group);
  return group;
}
