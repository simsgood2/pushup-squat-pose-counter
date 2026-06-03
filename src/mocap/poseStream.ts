import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export type Landmark3D = { x: number; y: number; z: number; visibility?: number };

export type LandmarkResult = {
  landmarks: Landmark3D[][];
  worldLandmarks: Landmark3D[][];
};

export type LandmarkCallback = (result: LandmarkResult) => void;

// Note: MediaPipe Tasks Vision은 module worker에서 작동하지 않는다
// (WASM 글루를 <script> 태그 주입 또는 importScripts로 로드하는데
// module worker에선 둘 다 불가). 그래서 main thread에서 직접 실행한다.
export class PoseStream {
  private callbacks = new Set<LandmarkCallback>();
  private mediaStream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private rafId: number | null = null;
  private active = false;
  private poseLandmarker: PoseLandmarker | null = null;
  private inferenceEnabled = true;
  private targetInterval = 1000 / 30; // throttle pose inference to ~30fps
  private lastInferenceAt = 0;

  subscribe(cb: LandmarkCallback): () => void {
    this.callbacks.add(cb);
    return () => {
      this.callbacks.delete(cb);
    };
  }

  /** Pause/resume inference without tearing down the camera or model. */
  setInferenceEnabled(enabled: boolean): void {
    this.inferenceEnabled = enabled;
  }

  async start(modelUrl: string): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    this.video = document.createElement('video');
    this.video.srcObject = this.mediaStream;
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.style.cssText =
      'position:fixed;bottom:8px;right:8px;width:160px;border:1px solid #444;z-index:9999;transform:scaleX(-1);';
    document.body.appendChild(this.video);
    await this.video.play();

    const vision = await FilesetResolver.forVisionTasks(
      `${window.location.origin}/wasm`
    );
    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
    });

    this.active = true;
    this.scheduleFrame();
  }

  stop(): void {
    this.active = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.poseLandmarker?.close();
    this.poseLandmarker = null;
    this.mediaStream?.getTracks().forEach(t => t.stop());
    this.mediaStream = null;
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
  }

  private dispatch(data: {
    landmarks: Landmark3D[][];
    worldLandmarks: Landmark3D[][];
  }): void {
    const result: LandmarkResult = {
      landmarks: data.landmarks,
      worldLandmarks: data.worldLandmarks,
    };
    this.callbacks.forEach(cb => cb(result));
  }

  private scheduleFrame(): void {
    if (!this.active) return;
    this.rafId = requestAnimationFrame(() => {
      if (!this.active || !this.video || !this.poseLandmarker) return;
      const now = performance.now();
      if (
        this.inferenceEnabled &&
        this.video.readyState >= 2 &&
        now - this.lastInferenceAt >= this.targetInterval
      ) {
        this.lastInferenceAt = now;
        const result = this.poseLandmarker.detectForVideo(this.video, now);
        this.dispatch({
          landmarks: result.landmarks as Landmark3D[][],
          worldLandmarks: result.worldLandmarks as Landmark3D[][],
        });
      }
      this.scheduleFrame();
    });
  }
}
