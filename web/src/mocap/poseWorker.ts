import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const ctx: Worker = self as unknown as Worker;

type WorkerInMessage =
  | { type: 'init'; modelUrl: string }
  | { type: 'frame'; bitmap: ImageBitmap; timestamp: number };

let poseLandmarker: PoseLandmarker | null = null;

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data as WorkerInMessage;

  if (msg.type === 'init') {
    const vision = await FilesetResolver.forVisionTasks('/wasm');
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: msg.modelUrl, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    ctx.postMessage({ type: 'ready' });
  } else if (msg.type === 'frame') {
    if (!poseLandmarker) return;
    const result = poseLandmarker.detectForVideo(
      msg.bitmap as unknown as HTMLVideoElement,
      msg.timestamp
    );
    ctx.postMessage({
      type: 'landmarks',
      landmarks: result.landmarks,
      worldLandmarks: result.worldLandmarks,
    });
    msg.bitmap.close();
  }
};
