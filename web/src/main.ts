import * as THREE from 'three';
import { initScene } from './scene';
import { PoseStream } from './mocap/poseStream';
import { loadGLTFIntoScene } from './character/gltfLoader';
import { retargetBones } from './character/retargetBones';
import mannyGlbUrl from './assets/characters/manny.glb?url';
import type { LandmarkResult, Landmark3D } from './mocap/poseStream';
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
import { CameraTween } from './game/cameraTween';
import { CAMERA_PRESETS } from './game/cameraPresets';
import { flashLifeLoss, spawnExerciseFloat, spawnPhaseBanner } from './ui/feedback';

interface AnyClassifier {
  update(lm: (Point3D | null)[]): ExerciseState;
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const { scene, camera, renderer, controls } = initScene(canvas);

// Camera tween system
const cameraTween = new CameraTween();

let characterGroup: THREE.Group | null = null;
loadGLTFIntoScene(mannyGlbUrl, scene, {
  targetMaxDimension: 1.7,
}).then(group => {
  characterGroup = group;
}).catch(e => console.error("Failed to load manny:", e));

// Screen-space point just above the character, for floating rep feedback.
const _floatVec = new THREE.Vector3();
function characterFloatPoint(): { x: number; y: number } {
  if (characterGroup) characterGroup.getWorldPosition(_floatVec);
  else _floatVec.set(0, 0, 0);
  _floatVec.y += 1.5;
  const projected = _floatVec.clone().project(camera);
  const jitterX = (Math.random() - 0.5) * 70;
  return {
    x: (projected.x * 0.5 + 0.5) * window.innerWidth + jitterX,
    y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
  };
}

const poseStream = new PoseStream();
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
      const { gold, comboCount } = rewardTracker.recordRep(type, state.angle);
      goldStore.getState().addGold(gold, comboCount, rewardTracker.getVarietyCount());
      const pt = characterFloatPoint();
      spawnExerciseFloat(type, gold, comboCount, pt.x, pt.y);
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

const PHASE_BANNERS: Record<string, string> = {
  Exercise: '운동',
  Build: '건설',
  Defense: '방어',
  WaveClear: '클리어!',
};

let lastPhase = phaseStore.getState().phase;
let prevShowCharacter = true; // Menu starts with the character visible
let pendingCharacterReveal = false; // reveal the character only after the camera settles
let pendingNextRound = false; // after a cleared wave, auto-advance once the camera has returned
phaseStore.subscribe((state) => {
  if (state.phase !== lastPhase) {
    const banner = PHASE_BANNERS[state.phase];
    if (banner) spawnPhaseBanner(banner);
  }
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

  // Camera preset transition. WaveClear returns to the exercise (front) view.
  const presetKey =
    state.phase === 'Exercise' || state.phase === 'WaveClear' ? 'exercise'
    : state.phase === 'Menu' || state.phase === 'GameOver' ? 'menu'
    : 'defense';
  const preset = CAMERA_PRESETS[presetKey];
  // Start from the *actual* current look (controls.target), so orbiting never causes a jump.
  cameraTween.begin(camera, controls.target.clone(), preset);

  // Visibility: Exercise hides grid; Menu/Exercise/WaveClear/GameOver show the character.
  const showGrid = state.phase !== 'Exercise';
  const showCharacter = state.phase === 'Exercise' || state.phase === 'Menu' || state.phase === 'WaveClear' || state.phase === 'GameOver';
  // Pose inference only matters when the character is shown; pause it during Build/Defense.
  poseStream.setInferenceEnabled(showCharacter);
  grid.setVisible(showGrid);
  if (showCharacter && !prevShowCharacter) {
    // Summon: keep the character hidden until the camera tween settles.
    if (characterGroup) characterGroup.visible = false;
    pendingCharacterReveal = true;
  } else {
    if (characterGroup) characterGroup.visible = showCharacter;
    pendingCharacterReveal = false;
  }
  prevShowCharacter = showCharacter;

  // Cleared wave: auto-advance to the next exercise round once the camera has returned.
  pendingNextRound = state.phase === 'WaveClear';

  lastPhase = state.phase;
});

grid.onWaveComplete = () => {
  phaseStore.getState().waveCleared();
};

grid.onEnemyReachedEnd = () => {
  phaseStore.getState().loseLife();
  flashLifeLoss();
};

// Camera tween + Exercise timer tick
let lastTimerTime = performance.now();
function timerLoop(): void {
  const now = performance.now();
  const dt = Math.min((now - lastTimerTime) / 1000, 0.5);
  lastTimerTime = now;
  phaseStore.getState().tickTimer(dt);

  // Update camera tween each frame
  const updatedLookAt = cameraTween.update(camera);
  if (updatedLookAt) {
    controls.target.copy(updatedLookAt);
  }
  controls.enabled = !cameraTween.active;

  // Once the camera has finished returning: reveal the character, then auto-advance.
  if (!cameraTween.active) {
    if (pendingCharacterReveal) {
      if (characterGroup) characterGroup.visible = true;
      pendingCharacterReveal = false;
    }
    if (pendingNextRound) {
      pendingNextRound = false;
      phaseStore.getState().nextRound();
    }
  }

  requestAnimationFrame(timerLoop);
}
timerLoop();
