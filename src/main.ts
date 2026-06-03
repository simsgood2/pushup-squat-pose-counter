import { initScene } from './scene';
import { PoseStream } from './mocap/poseStream';
import type { LandmarkResult } from './mocap/poseStream';
import { PhaseHud } from './ui/PhaseHud';
import { PushupClassifier } from './exercise/classifiers/pushup';
import { SquatClassifier } from './exercise/classifiers/squat';
import { RewardTracker, goldStore } from './exercise/rewards';
import type { Point3D } from './exercise/angle';
import type { ExerciseState } from './exercise/repCounter';
import { DefenseGrid } from './defense/grid';
import { phaseStore } from './game/phaseMachine';
import { TowerPanel } from './ui/TowerPanel';
import { CameraTween } from './game/cameraTween';
import { CAMERA_PRESETS } from './game/cameraPresets';
import { flashLifeLoss, spawnPhaseBanner } from './ui/feedback';

interface AnyClassifier {
  update(lm: (Point3D | null)[]): ExerciseState;
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const { scene, camera, renderer, controls } = initScene(canvas);

const cameraTween = new CameraTween();
const fixedCameraPreset = CAMERA_PRESETS.defense;
camera.position.copy(fixedCameraPreset.position);
controls.target.copy(fixedCameraPreset.lookAt);
camera.lookAt(fixedCameraPreset.lookAt);
controls.enableRotate = false;
controls.update();

const poseStream = new PoseStream();
new PhaseHud();

type CountedExerciseType = 'pushup' | 'squat';

const classifiers: { type: CountedExerciseType; clf: AnyClassifier }[] = [
  { type: 'pushup',      clf: new PushupClassifier() },
  { type: 'squat',       clf: new SquatClassifier() },
];

const prevCounts: Record<CountedExerciseType, number> = {
  pushup: 0,
  squat: 0,
};

const exerciseCounterPanel = document.createElement('div');
exerciseCounterPanel.className = 'hud-panel';
exerciseCounterPanel.style.cssText = [
  'position: fixed',
  'left: 16px',
  'top: 16px',
  'z-index: 110',
  'min-width: 170px',
  'font-size: 36px',
  'line-height: 1.5',
  'display: none',
].join('; ');

const pushupCountEl = document.createElement('div');
const squatCountEl = document.createElement('div');
exerciseCounterPanel.appendChild(pushupCountEl);
exerciseCounterPanel.appendChild(squatCountEl);
document.body.appendChild(exerciseCounterPanel);

function renderExerciseCounts(): void {
  pushupCountEl.textContent = `푸쉬업: ${prevCounts.pushup}`;
  squatCountEl.textContent = `스쿼트: ${prevCounts.squat}`;
}
renderExerciseCounts();

const rewardTracker = new RewardTracker();
let exerciseEnabled = false;

function processLandmarks(result: LandmarkResult): void {
  if (!exerciseEnabled) return;

  const lm = (result.landmarks?.[0] ?? []) as (Point3D | null)[];
  for (const { type, clf } of classifiers) {
    const state = clf.update(lm);
    if (state.count > prevCounts[type]) {
      prevCounts[type] = state.count;
      const { gold, comboCount } = rewardTracker.recordRep(type, state.angle);
      goldStore.getState().addGold(gold, comboCount, rewardTracker.getVarietyCount());
      renderExerciseCounts();
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
const canBuild = (p: string) => p === 'Exercise' || p === 'Build' || p === 'Defense';
exerciseEnabled = phaseStore.getState().phase === 'Exercise' || phaseStore.getState().phase === 'Build';
grid.setInputEnabled(canBuild(phaseStore.getState().phase));
grid.setVisible(phaseStore.getState().phase !== 'Menu' && phaseStore.getState().phase !== 'GameOver');
poseStream.setInferenceEnabled(exerciseEnabled);

const PHASE_BANNERS: Record<string, string> = {
  Exercise: '운동',
  Build: '건설',
  Defense: '방어',
  WaveClear: '클리어!',
};

let lastPhase = phaseStore.getState().phase;
let pendingNextRound = false; // after a cleared wave, auto-advance once the camera has returned
phaseStore.subscribe((state) => {
  if (state.phase !== lastPhase) {
    const banner = PHASE_BANNERS[state.phase];
    if (banner) spawnPhaseBanner(banner);
  }
  exerciseEnabled = state.phase === 'Exercise' || state.phase === 'Build';
  grid.setInputEnabled(canBuild(state.phase));
  if (state.phase === 'Defense' && lastPhase !== 'Defense') {
    grid.startWave();
  }
  if (state.phase === 'Menu' && lastPhase === 'GameOver') {
    grid.reset();
    rewardTracker.reset();
    Object.keys(prevCounts).forEach(k => { prevCounts[k as CountedExerciseType] = 0; });
    renderExerciseCounts();
  }

  cameraTween.begin(camera, controls.target.clone(), fixedCameraPreset);

  const showGrid = state.phase !== 'Menu' && state.phase !== 'GameOver';
  poseStream.setInferenceEnabled(state.phase === 'Exercise' || state.phase === 'Build');
  grid.setVisible(showGrid);
  exerciseCounterPanel.style.display = state.phase === 'Exercise' || state.phase === 'Build' ? 'block' : 'none';

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

  if (!cameraTween.active) {
    if (pendingNextRound) {
      pendingNextRound = false;
      phaseStore.getState().nextRound();
    }
  }

  requestAnimationFrame(timerLoop);
}
timerLoop();
