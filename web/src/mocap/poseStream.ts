export type Landmark3D = { x: number; y: number; z: number; visibility?: number };

export type LandmarkResult = {
  landmarks: Landmark3D[][];
  worldLandmarks: Landmark3D[][];
};

export type LandmarkCallback = (result: LandmarkResult) => void;

export class PoseStream {
  private callbacks = new Set<LandmarkCallback>();
  private worker: Worker | null = null;
  private mediaStream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private rafId: number | null = null;
  private active = false;

  subscribe(cb: LandmarkCallback): () => void {
    this.callbacks.add(cb);
    return () => {
      this.callbacks.delete(cb);
    };
  }

  async start(modelUrl: string): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

    this.video = document.createElement('video');
    this.video.srcObject = this.mediaStream;
    this.video.playsInline = true;
    await this.video.play();

    this.worker = new Worker(new URL('./poseWorker.ts', import.meta.url), { type: 'module' });

    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data as { type: string };
      if (data.type === 'ready') {
        this.active = true;
        this.scheduleFrame();
      } else if (data.type === 'landmarks') {
        this.dispatch(e.data as LandmarkResult & { type: string });
      }
    };

    this.worker.postMessage({ type: 'init', modelUrl });
  }

  stop(): void {
    this.active = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.worker?.terminate();
    this.worker = null;
    this.mediaStream?.getTracks().forEach(t => t.stop());
    this.mediaStream = null;
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
  }

  private dispatch(data: { landmarks: Landmark3D[][]; worldLandmarks: Landmark3D[][] }): void {
    const result: LandmarkResult = {
      landmarks: data.landmarks,
      worldLandmarks: data.worldLandmarks,
    };
    this.callbacks.forEach(cb => cb(result));
  }

  private scheduleFrame(): void {
    if (!this.active) return;
    this.rafId = requestAnimationFrame(() => {
      if (!this.active || !this.video || !this.worker) return;
      if (this.video.readyState >= 2) {
        createImageBitmap(this.video)
          .then(bitmap => {
            this.worker!.postMessage(
              { type: 'frame', bitmap, timestamp: performance.now() },
              [bitmap]
            );
            this.scheduleFrame();
          })
          .catch(() => {
            this.scheduleFrame();
          });
      } else {
        this.scheduleFrame();
      }
    });
  }
}
