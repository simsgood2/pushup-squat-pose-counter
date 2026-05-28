import * as THREE from 'three';
import type { Landmark3D } from '../mocap/poseStream';

export type BoneMapping = {
  boneName: string;
  fromIdx: number;
  toIdx: number;
  restDir: THREE.Vector3;
};

// MediaPipe landmark pairs → UE5 mannequin bone names + T-pose rest directions.
// restDir: bone's pointing direction in Three.js space when character is in T-pose.
export const BONE_MAP: BoneMapping[] = [
  { boneName: 'upperarm_l', fromIdx: 11, toIdx: 13, restDir: new THREE.Vector3(-1, 0, 0) },
  { boneName: 'lowerarm_l', fromIdx: 13, toIdx: 15, restDir: new THREE.Vector3(-1, 0, 0) },
  { boneName: 'upperarm_r', fromIdx: 12, toIdx: 14, restDir: new THREE.Vector3(1, 0, 0) },
  { boneName: 'lowerarm_r', fromIdx: 14, toIdx: 16, restDir: new THREE.Vector3(1, 0, 0) },
  { boneName: 'thigh_l',    fromIdx: 23, toIdx: 25, restDir: new THREE.Vector3(0, -1, 0) },
  { boneName: 'calf_l',     fromIdx: 25, toIdx: 27, restDir: new THREE.Vector3(0, -1, 0) },
  { boneName: 'thigh_r',    fromIdx: 24, toIdx: 26, restDir: new THREE.Vector3(0, -1, 0) },
  { boneName: 'calf_r',     fromIdx: 26, toIdx: 28, restDir: new THREE.Vector3(0, -1, 0) },
];

// Returns a quaternion that rotates restDir to align with the direction
// from worldLandmarks[fromIdx] to worldLandmarks[toIdx] in Three.js space.
// MediaPipe world coords (x=right, y=down, z=away) are converted by flipping Y and Z.
export function computeBoneQuaternion(
  worldLandmarks: Landmark3D[],
  fromIdx: number,
  toIdx: number,
  restDir: THREE.Vector3
): THREE.Quaternion {
  const from = worldLandmarks[fromIdx];
  const to = worldLandmarks[toIdx];

  const dir = new THREE.Vector3(
    to.x - from.x,
    -(to.y - from.y),
    -(to.z - from.z)
  );

  if (dir.length() < 0.001) {
    return new THREE.Quaternion();
  }

  dir.normalize();
  return new THREE.Quaternion().setFromUnitVectors(restDir.clone().normalize(), dir);
}

export function findBoneByName(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  const lower = name.toLowerCase();
  root.traverse(obj => {
    if (found) return;
    if (obj.name.toLowerCase() === lower) {
      found = obj;
    }
  });
  return found;
}

export function retargetBones(model: THREE.Group, worldLandmarks: Landmark3D[]): void {
  if (!worldLandmarks || worldLandmarks.length < 33) return;

  for (const entry of BONE_MAP) {
    const bone = findBoneByName(model, entry.boneName);
    if (!bone) continue;

    const q = computeBoneQuaternion(
      worldLandmarks,
      entry.fromIdx,
      entry.toIdx,
      entry.restDir
    );
    bone.quaternion.copy(q);
  }
}
