import * as THREE from 'three';

export interface CameraPreset {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

export const CAMERA_PRESETS: Record<'exercise' | 'defense' | 'menu', CameraPreset> = {
  // 운동: 캐릭터 정면 흉상~전신, 약간 위에서 내려다봄
  exercise: {
    position: new THREE.Vector3(0, 1.4, 3.2),
    lookAt:   new THREE.Vector3(0, 1.0, 0),
  },
  // 디펜스: 그리드 비스듬한 탑다운, 경로가 화면을 채우도록 당겨봄
  defense: {
    position: new THREE.Vector3(0, 4.7, 4.3),
    lookAt:   new THREE.Vector3(0, 0, 0.2),
  },
  // 메뉴/WaveClear/GameOver: 디펜스와 유사하지만 약간 다른 각도로 캐릭터도 살짝 보이게
  menu: {
    position: new THREE.Vector3(0.6, 4.0, 5.2),
    lookAt:   new THREE.Vector3(0, 0.8, 0),
  },
};
