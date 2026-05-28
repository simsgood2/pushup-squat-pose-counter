import * as THREE from 'three';
import { initScene } from './scene';
import { PoseStream } from './mocap/poseStream';
import { StickFigure } from './character/stickFigure';
import { loadGLTFIntoScene } from './character/gltfLoader';
import { retargetBones } from './character/retargetBones';
import mannyGlbUrl from './assets/characters/manny.glb?url';
import type { LandmarkResult, Landmark3D } from './mocap/poseStream';
import { ExerciseHud } from './ui/ExerciseHud';
import { PhaseHud } from './ui/PhaseHud';
import { PushupClassifier } from './exercise/classifiers/pushup';
import { SquatClassifier } from './exercise/classifiers/squat';
import { JumpClassifier } from './exercise/classifiers/jump';
import { LungeClassifier } from './exercise/classifiers/lunge';
import { JumpingJackClassifier } from './exercise/classifiers/jumpingJack';
import { RewardTracker, goldStore, type ExerciseType } from './exercise/rewards';
import type { Point3D } from './exercise/angle';
import type { ExerciseState } from './exercise/repCounter';
import { DefenseGrid } from './defense/grid';
import { phaseStore, type Phase } from './game/phaseMachine';

interface AnyClassifier {
  update(lm: (Point3D | null)[]): ExerciseState;
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const { scene, camera, renderer } = initScene(canvas);

const stickFigure = new StickFigure(scene);
let characterGroup: THREE.Group | null = null;
loadGLTFIntoScene(mannyGlbUrl, scene, {
  targetMaxDimension: 1.7,
}).then(group => {
  characterGroup = group;
  exposeCharacterDebug(group);
}).catch(e => console.error("Failed to load manny:", e));

const poseStream = new PoseStream();
const hud = new ExerciseHud();
new PhaseHud();

const classifiers: { type: ExerciseType; clf: AnyClassifier }[] = [
  { type: 'pushup',      clf: new PushupClassifier() },
  { type: 'squat',       clf: new SquatClassifier() },
  { type: 'jump',        clf: new JumpClassifier() },
  { type: 'lunge',       clf: new LungeClassifier() },
  { type: 'jumpingJack', clf: new JumpingJackClassifier() },
];

const prevCounts: Record<ExerciseType, number> = {
  pushup: 0, squat: 0, jump: 0, lunge: 0, jumpingJack: 0,
};

const rewardTracker = new RewardTracker();
let exerciseEnabled = false;

function processLandmarks(result: LandmarkResult): void {
  stickFigure.update(result);

  if (characterGroup && result.worldLandmarks?.[0]) {
    retargetBones(characterGroup, result.worldLandmarks[0] as Landmark3D[]);
  }

  if (!exerciseEnabled) return;

  const lm = (result.worldLandmarks?.[0] ?? []) as (Point3D | null)[];
  for (const { type, clf } of classifiers) {
    const state = clf.update(lm);
    if (state.count > prevCounts[type]) {
      prevCounts[type] = state.count;
      hud.setExercise(type);
      const { gold, comboCount } = rewardTracker.recordRep(type, state.angle);
      goldStore.getState().addGold(gold, comboCount, rewardTracker.getVarietyCount());
    }
  }
}

poseStream.subscribe(processLandmarks);

(window as unknown as Record<string, unknown>)['__stickFigure'] = stickFigure;
poseStream.start('/models/pose_landmarker_lite.task').catch(() => {
  // Webcam not available (e.g. test env) — rely on __updatePose injection
});

const grid = new DefenseGrid(scene, camera, renderer);

// Phase wiring
exerciseEnabled = phaseStore.getState().phase === 'Exercise';
grid.setInputEnabled(phaseStore.getState().phase === 'Defense');

phaseStore.subscribe((state) => {
  exerciseEnabled = state.phase === 'Exercise';
  grid.setInputEnabled(state.phase === 'Defense');
});

grid.onWaveComplete = () => {
  phaseStore.getState().waveCleared();
};

grid.onEnemyReachedEnd = () => {
  phaseStore.getState().loseLife();
};

// Exercise timer tick
let lastTimerTime = performance.now();
function timerLoop(): void {
  const now = performance.now();
  const dt = Math.min((now - lastTimerTime) / 1000, 0.5);
  lastTimerTime = now;
  phaseStore.getState().tickTimer(dt);
  requestAnimationFrame(timerLoop);
}
timerLoop();

const win = window as unknown as Record<string, unknown>;
win['__stickFigureReady'] = true;
win['__hudReady'] = true;
win['__updatePose'] = (result: LandmarkResult) => {
  processLandmarks(result);
  win['__visibleSphereCount'] = stickFigure.visibleCount;
};
win['__gridReady'] = true;
win['__phase'] = () => phaseStore.getState().phase;
win['__forcePhase'] = (p: Phase) => phaseStore.getState().setPhase(p);
win['__round'] = () => phaseStore.getState().round;
Object.defineProperty(window, '__gridTowerCount', {
  get: () => grid.towerCount,
  configurable: true,
});
Object.defineProperty(window, '__defenseSpawnedEnemyCount', {
  get: () => grid.spawnedEnemyCount,
  configurable: true,
});
Object.defineProperty(window, '__defenseAliveEnemyCount', {
  get: () => grid.aliveEnemyCount,
  configurable: true,
});
Object.defineProperty(window, '__defenseKilledEnemyCount', {
  get: () => grid.killedEnemyCount,
  configurable: true,
});
Object.defineProperty(window, '__defenseReachedEndCount', {
  get: () => grid.reachedEndCount,
  configurable: true,
});
Object.defineProperty(window, '__defenseWaveComplete', {
  get: () => grid.waveComplete,
  configurable: true,
});
win['__placeGridTower'] = (row: number, col: number) => grid.placeTowerAt(row, col);
win['__gridCellScreenPoint'] = (row: number, col: number) => grid.cellScreenPoint(row, col);
win['__startDefenseWave'] = () => grid.startWave();
win['__gold'] = () => goldStore.getState().gold;
win['__addGold'] = (n: number) => goldStore.getState().addGold(n, 0, 0);
win['__lives'] = () => phaseStore.getState().lives;
win['__setLives'] = (n: number) => phaseStore.setState({ lives: n });

function exposeCharacterDebug(group: THREE.Group): void {
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  const boneNames: string[] = [];
  const materialNames = new Set<string>();

  group.traverse(object => {
    if (object instanceof THREE.Bone) boneNames.push(object.name);
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      materialNames.add(material.name || material.type);
    }
  });

  win['__characterReady'] = true;
  win['__characterBoneNames'] = boneNames;
  win['__characterBounds'] = {
    min: bounds.min.toArray(),
    max: bounds.max.toArray(),
    size: size.toArray(),
  };
  win['__characterMaterialNames'] = Array.from(materialNames);
}
