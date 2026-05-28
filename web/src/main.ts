import { initScene } from './scene';
import { PoseStream } from './mocap/poseStream';
import { StickFigure } from './character/stickFigure';
import type { LandmarkResult } from './mocap/poseStream';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const { scene } = initScene(canvas);

const stickFigure = new StickFigure(scene);
const poseStream = new PoseStream();

poseStream.subscribe(result => stickFigure.update(result));

(window as unknown as Record<string, unknown>)['__stickFigure'] = stickFigure;
poseStream.start('/models/pose_landmarker_lite.task').catch(() => {
  // Webcam not available (e.g. test env) — rely on __updatePose injection
});

// Test / debug injection hook
const win = window as unknown as Record<string, unknown>;
win['__stickFigureReady'] = true;
win['__updatePose'] = (result: LandmarkResult) => {
  stickFigure.update(result);
  win['__visibleSphereCount'] = stickFigure.visibleCount;
};
