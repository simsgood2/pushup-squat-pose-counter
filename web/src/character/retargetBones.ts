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
  smoothedLocalQuaternion: THREE.Quaternion;
};

const REST_POSE_CACHE = new WeakMap<THREE.Object3D, Map<string, BoneRestPose>>();

// Mirror mode: subject's right (12/14/16, 24/26/28) drives the character's left bones,
// and subject's left (11/13/15, 23/25/27) drives the character's right bones.
// Combined with the X-flip in `getLandmarkDirection`, the character feels like
// the user's mirror image: raising your right arm raises the character's left arm
// on the same side of the screen.
// `restDir` is informational only; runtime retargeting uses the loaded skeleton bind pose.
export const BONE_MAP: BoneMapping[] = [
  // Arms
  { boneName: 'upperarm_l', childBoneName: 'lowerarm_l', fromIdx: 12, toIdx: 14, restDir: new THREE.Vector3(-1, 0, 0) },
  { boneName: 'upperarm_r', childBoneName: 'lowerarm_r', fromIdx: 11, toIdx: 13, restDir: new THREE.Vector3(1, 0, 0) },
  { boneName: 'lowerarm_l', childBoneName: 'hand_l',     fromIdx: 14, toIdx: 16, restDir: new THREE.Vector3(-1, 0, 0) },
  { boneName: 'lowerarm_r', childBoneName: 'hand_r',     fromIdx: 13, toIdx: 15, restDir: new THREE.Vector3(1, 0, 0) },
  // Legs
  { boneName: 'thigh_l',    childBoneName: 'calf_l',     fromIdx: 24, toIdx: 26, restDir: new THREE.Vector3(0, -1, 0) },
  { boneName: 'thigh_r',    childBoneName: 'calf_r',     fromIdx: 23, toIdx: 25, restDir: new THREE.Vector3(0, -1, 0) },
  { boneName: 'calf_l',     childBoneName: 'foot_l',     fromIdx: 26, toIdx: 28, restDir: new THREE.Vector3(0, -1, 0) },
  { boneName: 'calf_r',     childBoneName: 'foot_r',     fromIdx: 25, toIdx: 27, restDir: new THREE.Vector3(0, -1, 0) },
];

const MIN_VISIBILITY = 0.1;       // below this we ignore the landmark entirely
const FULL_VISIBILITY = 0.6;      // at/above this we apply the full smoothing factor
const MAX_SMOOTHING_FACTOR = 0.35; // per-frame slerp at full confidence
const MIN_DIRECTION_LENGTH = 0.02;

export function computeBoneQuaternion(
  worldLandmarks: Landmark3D[],
  fromIdx: number,
  toIdx: number,
  restDir: THREE.Vector3
): THREE.Quaternion {
  const dir = getLandmarkDirection(worldLandmarks, fromIdx, toIdx);
  if (!dir) return new THREE.Quaternion();
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

  const missing: string[] = [];
  for (const entry of BONE_MAP) {
    const bone = findBoneByName(model, entry.boneName);
    const childBone = findBoneByName(model, entry.childBoneName);
    if (!bone || !childBone) {
      missing.push(`${entry.boneName}->${entry.childBoneName}`);
      continue;
    }

    const bonePosition = bone.getWorldPosition(new THREE.Vector3());
    const childPosition = childBone.getWorldPosition(new THREE.Vector3());
    const bindWorldDirection = childPosition.sub(bonePosition);
    if (bindWorldDirection.length() < 0.001) continue;

    restPose.set(entry.boneName, {
      bone,
      childBone,
      bindWorldQuaternion: bone.getWorldQuaternion(new THREE.Quaternion()),
      bindWorldDirection: bindWorldDirection.normalize(),
      smoothedLocalQuaternion: bone.quaternion.clone(),
    });
  }

  if (missing.length > 0) {
    const allBones: string[] = [];
    model.traverse(o => {
      if ((o as THREE.Bone).isBone) allBones.push(o.name);
    });
    // eslint-disable-next-line no-console
    console.warn('[retarget] missing bones:', missing, '\nactual bones in model:', allBones);
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

  const from = worldLandmarks[entry.fromIdx];
  const to = worldLandmarks[entry.toIdx];
  const fromVis = from?.visibility ?? 1;
  const toVis = to?.visibility ?? 1;
  const confidence = Math.min(fromVis, toVis);

  let targetLocalQuaternion: THREE.Quaternion | null = null;

  if (confidence >= MIN_VISIBILITY) {
    const targetDirection = getLandmarkDirection(worldLandmarks, entry.fromIdx, entry.toIdx);
    if (targetDirection) {
      model.updateWorldMatrix(true, true);
      const parentWorldQuaternion =
        pose.bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
      const deltaWorldQuaternion = new THREE.Quaternion().setFromUnitVectors(
        pose.bindWorldDirection,
        targetDirection
      );
      const targetWorldQuaternion = deltaWorldQuaternion.multiply(pose.bindWorldQuaternion);
      targetLocalQuaternion = parentWorldQuaternion.invert().multiply(targetWorldQuaternion);
    }
  }

  // Below MIN_VISIBILITY or degenerate direction: hold the previous smoothed pose
  // so unrecognized parts stay still instead of jittering toward random noise.
  if (!targetLocalQuaternion) {
    pose.bone.quaternion.copy(pose.smoothedLocalQuaternion);
    return;
  }

  // Confidence-scaled smoothing: low confidence → tiny slerp factor → bone moves
  // very slowly. High confidence → full slerp factor → responsive tracking.
  const t = Math.min(1, Math.max(0, (confidence - MIN_VISIBILITY) / (FULL_VISIBILITY - MIN_VISIBILITY)));
  const slerpFactor = MAX_SMOOTHING_FACTOR * t;
  pose.smoothedLocalQuaternion.slerp(targetLocalQuaternion, slerpFactor);
  pose.bone.quaternion.copy(pose.smoothedLocalQuaternion);
}

// MediaPipe world coords: x=subject's right, y=down, z=away-from-camera.
// We flip X to produce a mirror image, and flip Y/Z to convert into Three.js
// (y-up, z-toward-viewer) space.
function getLandmarkDirection(
  worldLandmarks: Landmark3D[],
  fromIdx: number,
  toIdx: number
): THREE.Vector3 | null {
  const from = worldLandmarks[fromIdx];
  const to = worldLandmarks[toIdx];
  if (!from || !to) return null;

  const direction = new THREE.Vector3(
    -(to.x - from.x),
    -(to.y - from.y),
    -(to.z - from.z)
  );

  if (direction.length() < MIN_DIRECTION_LENGTH) {
    return null;
  }
  return direction.normalize();
}
