import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  computeBoneQuaternion,
  findBoneByName,
  retargetBones,
  BONE_MAP,
} from '../src/character/retargetBones';
import type { Landmark3D } from '../src/mocap/poseStream';

function make33Landmarks(
  overrides: Record<number, { x: number; y: number; z: number }>
): Landmark3D[] {
  return Array.from({ length: 33 }, (_, i) => ({
    x: overrides[i]?.x ?? 0,
    y: overrides[i]?.y ?? 0,
    z: overrides[i]?.z ?? 0,
    visibility: 1,
  }));
}

describe('computeBoneQuaternion', () => {
  it('produces identity when from and to landmarks coincide (zero direction)', () => {
    const lms = make33Landmarks({});
    const restDir = new THREE.Vector3(-1, 0, 0);
    const q = computeBoneQuaternion(lms, 11, 13, restDir);
    expect(q.w).toBeCloseTo(1, 5);
    expect(q.x).toBeCloseTo(0, 5);
    expect(q.y).toBeCloseTo(0, 5);
    expect(q.z).toBeCloseTo(0, 5);
  });

  it('upperarm_l arm raised: rotated restDir should point upward', () => {
    // MediaPipe Y is positive-downward; elbow above shoulder → elbow.y < shoulder.y.
    // shoulder(11) at y=0.0, elbow(13) at y=-0.3 → elbow is 0.3m above shoulder.
    // In Three.js (Y flipped): direction from shoulder to elbow becomes (0, +0.3, 0) → up.
    const lms = make33Landmarks({
      11: { x: -0.3, y: 0.0, z: 0 },
      13: { x: -0.3, y: -0.3, z: 0 },
    });
    const restDir = new THREE.Vector3(-1, 0, 0);
    const q = computeBoneQuaternion(lms, 11, 13, restDir);

    const rotated = restDir.clone().applyQuaternion(q);
    expect(rotated.y).toBeGreaterThan(0.95);
    expect(Math.abs(rotated.x)).toBeLessThan(0.2);
  });

  it('upperarm_r arm raised: rotated restDir should point upward', () => {
    const lms = make33Landmarks({
      12: { x: 0.3, y: 0.0, z: 0 },
      14: { x: 0.3, y: -0.3, z: 0 },
    });
    const restDir = new THREE.Vector3(1, 0, 0);
    const q = computeBoneQuaternion(lms, 12, 14, restDir);

    const rotated = restDir.clone().applyQuaternion(q);
    expect(rotated.y).toBeGreaterThan(0.95);
    expect(Math.abs(rotated.x)).toBeLessThan(0.2);
  });

  it('T-pose arm horizontal: quaternion is approximately identity', () => {
    // shoulder at (-0.3, 0, 0), elbow at (-0.6, 0, 0) → Three.js direction: (-1, 0, 0)
    // same as restDir, so quaternion should be identity.
    const lms = make33Landmarks({
      11: { x: -0.3, y: 0.0, z: 0 },
      13: { x: -0.6, y: 0.0, z: 0 },
    });
    const restDir = new THREE.Vector3(-1, 0, 0);
    const q = computeBoneQuaternion(lms, 11, 13, restDir);

    expect(q.w).toBeCloseTo(1, 3);
    expect(Math.abs(q.x)).toBeLessThan(0.01);
    expect(Math.abs(q.y)).toBeLessThan(0.01);
    expect(Math.abs(q.z)).toBeLessThan(0.01);
  });

  it('arm pointing forward: rotated restDir should point along +Z', () => {
    // elbow is in front of shoulder in MediaPipe: shoulder.z > elbow.z (z away = positive)
    // Three.js flips Z, so forward in Three.js is -Z MediaPipe.
    // shoulder at (-0.3, 0, 0.1), elbow at (-0.3, 0, -0.2) → Three.js dir: (0, 0, 0.3) normalized (0,0,1)
    const lms = make33Landmarks({
      11: { x: -0.3, y: 0, z:  0.1 },
      13: { x: -0.3, y: 0, z: -0.2 },
    });
    const restDir = new THREE.Vector3(-1, 0, 0);
    const q = computeBoneQuaternion(lms, 11, 13, restDir);

    const rotated = restDir.clone().applyQuaternion(q);
    expect(rotated.z).toBeGreaterThan(0.95);
    expect(Math.abs(rotated.x)).toBeLessThan(0.2);
  });
});

describe('findBoneByName', () => {
  it('finds a direct child by exact name', () => {
    const group = new THREE.Group();
    const bone = new THREE.Bone();
    bone.name = 'upperarm_l';
    group.add(bone);

    expect(findBoneByName(group, 'upperarm_l')).toBe(bone);
  });

  it('is case-insensitive', () => {
    const group = new THREE.Group();
    const bone = new THREE.Bone();
    bone.name = 'UpperArm_L';
    group.add(bone);

    expect(findBoneByName(group, 'upperarm_l')).toBe(bone);
  });

  it('finds a nested bone', () => {
    const root = new THREE.Group();
    const parent = new THREE.Bone();
    parent.name = 'spine_01';
    const child = new THREE.Bone();
    child.name = 'upperarm_l';
    parent.add(child);
    root.add(parent);

    expect(findBoneByName(root, 'upperarm_l')).toBe(child);
  });

  it('returns null when bone is not present', () => {
    const group = new THREE.Group();
    expect(findBoneByName(group, 'nonexistent')).toBeNull();
  });

  it('returns the first match when multiple bones share a name', () => {
    const group = new THREE.Group();
    const b1 = new THREE.Bone();
    b1.name = 'upperarm_l';
    const b2 = new THREE.Bone();
    b2.name = 'upperarm_l';
    group.add(b1);
    group.add(b2);

    expect(findBoneByName(group, 'upperarm_l')).toBe(b1);
  });
});

describe('retargetBones', () => {
  it('applies arm-raised rotation to upperarm_l bone', () => {
    const group = new THREE.Group();
    const bone = new THREE.Bone();
    bone.name = 'upperarm_l';
    group.add(bone);

    const lms = make33Landmarks({
      11: { x: -0.3, y: 0.0, z: 0 },
      13: { x: -0.3, y: -0.3, z: 0 },
    });
    retargetBones(group, lms);

    const restDir = new THREE.Vector3(-1, 0, 0);
    const rotated = restDir.applyQuaternion(bone.quaternion);
    expect(rotated.y).toBeGreaterThan(0.95);
  });

  it('applies correct rotation to upperarm_r bone', () => {
    const group = new THREE.Group();
    const bone = new THREE.Bone();
    bone.name = 'upperarm_r';
    group.add(bone);

    const lms = make33Landmarks({
      12: { x: 0.3, y: 0.0, z: 0 },
      14: { x: 0.3, y: -0.3, z: 0 },
    });
    retargetBones(group, lms);

    const restDir = new THREE.Vector3(1, 0, 0);
    const rotated = restDir.applyQuaternion(bone.quaternion);
    expect(rotated.y).toBeGreaterThan(0.95);
  });

  it('leaves bone at identity for fewer than 33 landmarks', () => {
    const group = new THREE.Group();
    const bone = new THREE.Bone();
    bone.name = 'upperarm_l';
    group.add(bone);

    const lms: Landmark3D[] = [{ x: 0, y: 0, z: 0, visibility: 1 }];
    retargetBones(group, lms);

    expect(bone.quaternion.w).toBeCloseTo(1, 5);
  });

  it('does not throw when model has no matching bones', () => {
    const group = new THREE.Group();
    const lms = make33Landmarks({
      11: { x: -0.3, y: 0.0, z: 0 },
      13: { x: -0.3, y: -0.3, z: 0 },
    });
    expect(() => retargetBones(group, lms)).not.toThrow();
  });

  it('updates multiple bones in a single call', () => {
    const group = new THREE.Group();
    const boneL = new THREE.Bone();
    boneL.name = 'upperarm_l';
    const boneR = new THREE.Bone();
    boneR.name = 'upperarm_r';
    group.add(boneL);
    group.add(boneR);

    const lms = make33Landmarks({
      11: { x: -0.3, y: 0.0, z: 0 },
      13: { x: -0.3, y: -0.3, z: 0 },
      12: { x:  0.3, y: 0.0, z: 0 },
      14: { x:  0.3, y: -0.3, z: 0 },
    });
    retargetBones(group, lms);

    const rotatedL = new THREE.Vector3(-1, 0, 0).applyQuaternion(boneL.quaternion);
    const rotatedR = new THREE.Vector3(1, 0, 0).applyQuaternion(boneR.quaternion);
    expect(rotatedL.y).toBeGreaterThan(0.95);
    expect(rotatedR.y).toBeGreaterThan(0.95);
  });
});

describe('BONE_MAP', () => {
  it('contains all expected UE5 mannequin bone names', () => {
    const names = BONE_MAP.map(e => e.boneName);
    expect(names).toContain('upperarm_l');
    expect(names).toContain('upperarm_r');
    expect(names).toContain('lowerarm_l');
    expect(names).toContain('lowerarm_r');
    expect(names).toContain('thigh_l');
    expect(names).toContain('thigh_r');
    expect(names).toContain('calf_l');
    expect(names).toContain('calf_r');
  });

  it('all restDir vectors are unit length', () => {
    for (const entry of BONE_MAP) {
      expect(entry.restDir.length()).toBeCloseTo(1, 5);
    }
  });

  it('all landmark indices are within 0-32', () => {
    for (const entry of BONE_MAP) {
      expect(entry.fromIdx).toBeGreaterThanOrEqual(0);
      expect(entry.fromIdx).toBeLessThanOrEqual(32);
      expect(entry.toIdx).toBeGreaterThanOrEqual(0);
      expect(entry.toIdx).toBeLessThanOrEqual(32);
    }
  });
});
