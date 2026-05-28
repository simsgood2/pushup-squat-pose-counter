import type { Group, Scene } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export function loadFBX(url: string): Promise<Group> {
  return new Promise((resolve, reject) => {
    new FBXLoader().load(url, resolve, undefined, reject);
  });
}

export async function loadFBXIntoScene(url: string, scene: Scene): Promise<Group> {
  const group = await loadFBX(url);
  scene.add(group);
  return group;
}
