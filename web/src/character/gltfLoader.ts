import type { Group, Scene } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { prepareFBXCharacter, type FBXCharacterOptions } from './fbxLoader';

export type GLTFCharacterOptions = FBXCharacterOptions;

export function loadGLTF(url: string): Promise<Group> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(url, gltf => resolve(gltf.scene), undefined, reject);
  });
}

export async function loadGLTFIntoScene(
  url: string,
  scene: Scene,
  options?: GLTFCharacterOptions
): Promise<Group> {
  const group = await loadGLTF(url);
  prepareFBXCharacter(group, options);
  scene.add(group);
  return group;
}
