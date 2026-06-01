import * as THREE from 'three';
import type { Group, Scene } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export type FBXCharacterOptions = {
  targetHeight?: number;
  targetMaxDimension?: number;
  scale?: number;
  rotation?: Partial<Pick<THREE.Euler, 'x' | 'y' | 'z'>>;
  centerXZ?: boolean;
  snapToGround?: boolean;
  brightenDarkMaterials?: boolean;
  replaceMaterials?: boolean;
  fallbackColor?: THREE.ColorRepresentation;
};

export function loadFBX(url: string): Promise<Group> {
  return new Promise((resolve, reject) => {
    new FBXLoader().load(url, resolve, undefined, reject);
  });
}

export function prepareFBXCharacter(group: Group, options: FBXCharacterOptions = {}): Group {
  const {
    targetHeight,
    targetMaxDimension,
    scale,
    rotation,
    centerXZ = true,
    snapToGround = true,
    brightenDarkMaterials = true,
    replaceMaterials = false,
    fallbackColor = 0xc8d0dc,
  } = options;

  if (rotation?.x !== undefined) group.rotation.x = rotation.x;
  if (rotation?.y !== undefined) group.rotation.y = rotation.y;
  if (rotation?.z !== undefined) group.rotation.z = rotation.z;
  if (scale !== undefined) group.scale.setScalar(scale);

  group.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (replaceMaterials) {
      mesh.material = replaceMaterial(mesh.material, fallbackColor);
    } else if (brightenDarkMaterials) {
      mesh.material = brightenMaterial(mesh.material, fallbackColor);
    }
  });

  fitModelToGround(group, targetHeight, targetMaxDimension, centerXZ, snapToGround);
  return group;
}

export async function loadFBXIntoScene(
  url: string,
  scene: Scene,
  options?: FBXCharacterOptions
): Promise<Group> {
  const group = await loadFBX(url);
  prepareFBXCharacter(group, options);
  scene.add(group);
  return group;
}

function fitModelToGround(
  group: Group,
  targetHeight: number | undefined,
  targetMaxDimension: number | undefined,
  centerXZ: boolean,
  snapToGround: boolean
): void {
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  group.updateWorldMatrix(true, true);
  box.setFromObject(group);
  box.getSize(size);

  const maxDimension = Math.max(size.x, size.y, size.z);
  const targetSize = targetMaxDimension ?? targetHeight;
  const currentSize = targetMaxDimension !== undefined ? maxDimension : size.y;

  if (targetSize !== undefined && currentSize > 0.0001) {
    group.scale.multiplyScalar(targetSize / currentSize);
    group.updateWorldMatrix(true, true);
    box.setFromObject(group);
  }

  box.getCenter(center);
  if (centerXZ) {
    group.position.x -= center.x;
    group.position.z -= center.z;
  }

  if (snapToGround) {
    group.position.y -= box.min.y;
  }
}

function brightenMaterial(
  material: THREE.Material | THREE.Material[],
  fallbackColor: THREE.ColorRepresentation
): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) return material.map(item => brightenSingleMaterial(item, fallbackColor));
  return brightenSingleMaterial(material, fallbackColor);
}

function brightenSingleMaterial(
  material: THREE.Material,
  fallbackColor: THREE.ColorRepresentation
): THREE.Material {
  const hasColor = 'color' in material && material.color instanceof THREE.Color;

  if (!hasColor) return material;

  const meshMaterial = material as THREE.MeshBasicMaterial & { map?: THREE.Texture | null };
  const luminance = meshMaterial.color.r + meshMaterial.color.g + meshMaterial.color.b;
  if (luminance > 0.12) return material;

  meshMaterial.color.set(fallbackColor);
  meshMaterial.map = null;
  material.needsUpdate = true;
  return material;
}

function replaceMaterial(
  material: THREE.Material | THREE.Material[],
  fallbackColor: THREE.ColorRepresentation
): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) return material.map(item => createFallbackMaterial(item, fallbackColor));
  return createFallbackMaterial(material, fallbackColor);
}

function createFallbackMaterial(
  source: THREE.Material,
  fallbackColor: THREE.ColorRepresentation
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: fallbackColor,
    roughness: 0.65,
    metalness: 0.05,
    side: source.side,
    transparent: source.transparent,
    opacity: source.opacity,
  });
}
