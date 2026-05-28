import * as THREE from 'three';
import type { Landmark3D } from '../mocap/poseStream';

export type BoneMapping = {
  boneName: string;
  childBoneName: string;
  fromIdx: number;
  toIdx: number;
  restDir: THREE.Vector3;
};

type BoneRestPose = {
  bone: THREE.Object3D;
  childBone: THREE.Object3D;
  bindWorldQuaternion: THREE.Quaternion;
  bindWorldDirection: THREE.Vector3;
};

const REST_POSE_CACHE = new WeakMap<THREE.Object3D, Map<string, BoneRestPose>>();

// MediaPipe landmark pairs → UE5 mannequin arm bone names.
// restDir is kept for direction-only tests; runtime retargeting uses the loaded skeleton bind pose.
export const BONE_MAP: BoneMapping[] = [
  { boneName: 'upperarm_l', childBoneName: 'lowerarm_l', fromIdx: 11, toIdx: 13, restDir: new THREE.Vector3(-1, 0, 0) },
  { boneName: 'upperarm_r', childBoneName: 'lowerarm_r', fromIdx: 12, toIdx: 14, restDir: new THREE.Vector3(1, 0, 0) },
  { boneName: 'lowerarm_l', childBoneName: 'hand_l', fromIdx: 13, toIdx: 15, restDir: new THREE.Vector3(-1, 0, 0) },
  { boneName: 'lowerarm_r', childBoneName: 'hand_r', fromIdx: 14, toIdx: 16, restDir: new THREE.Vector3(1, 0, 0) },
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

  const restPose = getRestPose(model);
  for (const entry of BONE_MAP) {
    applyMappedBoneRotation(model, restPose, entry, worldLandmarks);
    model.updateWorldMatrix(true, true);
  }
}

function getRestPose(model: THREE.Group): Map<string, BoneRestPose> {
  const cached = REST_POSE_CACHE.get(model);
  if (cached) return cached;

  const restPose = new Map<string, BoneRestPose>();
  model.updateWorldMatrix(true, true);

  for (const entry of BONE_MAP) {
    const bone = findBoneByName(model, entry.boneName);
    const childBone = findBoneByName(model, entry.childBoneName);
    if (!bone || !childBone) continue;

    const bonePosition = bone.getWorldPosition(new THREE.Vector3());
    const childPosition = childBone.getWorldPosition(new THREE.Vector3());
    const bindWorldDirection = childPosition.sub(bonePosition);
    if (bindWorldDirection.length() < 0.001) continue;

    restPose.set(entry.boneName, {
      bone,
      childBone,
      bindWorldQuaternion: bone.getWorldQuaternion(new THREE.Quaternion()),
      bindWorldDirection: bindWorldDirection.normalize(),
    });
  }

  REST_POSE_CACHE.set(model, restPose);
  return restPose;
}

function applyMappedBoneRotation(
  model: THREE.Group,
  restPose: Map<string, BoneRestPose>,
  entry: BoneMapping,
  worldLandmarks: Landmark3D[]
): void {
  const pose = restPose.get(entry.boneName);
  if (!pose) return;

  const targetDirection = getLandmarkDirection(worldLandmarks, entry.fromIdx, entry.toIdx);
  if (!targetDirection) return;

  model.updateWorldMatrix(true, true);
  const parentWorldQuaternion = pose.bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  const deltaWorldQuaternion = new THREE.Quaternion().setFromUnitVectors(
    pose.bindWorldDirection,
    targetDirection
  );
  const targetWorldQuaternion = deltaWorldQuaternion.multiply(pose.bindWorldQuaternion);
  const targetLocalQuaternion = parentWorldQuaternion.invert().multiply(targetWorldQuaternion);

  pose.bone.quaternion.copy(targetLocalQuaternion);
}

function getLandmarkDirection(
  worldLandmarks: Landmark3D[],
  fromIdx: number,
  toIdx: number
): THREE.Vector3 | null {
  const from = worldLandmarks[fromIdx];
  const to = worldLandmarks[toIdx];
  if (!from || !to) return null;

  const direction = new THREE.Vector3(
    to.x - from.x,
    -(to.y - from.y),
    -(to.z - from.z)
  );

  if (direction.length() < 0.001) {
    return null;
  }
  return direction.normalize();
}
