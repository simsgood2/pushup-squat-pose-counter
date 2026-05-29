import * as THREE from 'three';
import { initScene } from './scene';
import { PoseStream } from './mocap/poseStream';
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
import { phaseStore } from './game/phaseMachine';
import { TowerPanel } from './ui/TowerPanel';

interface AnyClassifier {
  update(lm: (Point3D | null)[]): ExerciseState;
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const { scene, camera, renderer } = initScene(canvas);

let characterGroup: THREE.Group | null = null;
loadGLTFIntoScene(mannyGlbUrl, scene, {
  targetMaxDimension: 1.7,
}).then(group => {
  characterGroup = group;
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

poseStream.start('/models/pose_landmarker_lite.task').catch(() => {
  // Webcam not available
});

const grid = new DefenseGrid(scene, camera, renderer);
new TowerPanel(grid);

// Phase wiring
const canBuild = (p: string) => p === 'Build' || p === 'Defense';
exerciseEnabled = phaseStore.getState().phase === 'Exercise';
grid.setInputEnabled(canBuild(phaseStore.getState().phase));

let lastPhase = phaseStore.getState().phase;
phaseStore.subscribe((state) => {
  exerciseEnabled = state.phase === 'Exercise';
  grid.setInputEnabled(canBuild(state.phase));
  if (state.phase === 'Defense' && lastPhase !== 'Defense') {
    grid.startWave();
  }
  if (state.phase === 'Menu' && lastPhase === 'GameOver') {
    grid.reset();
    rewardTracker.reset();
    Object.keys(prevCounts).forEach(k => { prevCounts[k as ExerciseType] = 0; });
  }
  lastPhase = state.phase;
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
