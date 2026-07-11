import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision';

// Loaded from CDN rather than bundled — this is the standard MediaPipe
// Tasks Vision usage pattern and keeps our own bundle small. The WASM
// runtime and model are fetched once and cached by the browser.
const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export type PoseFrameCallback = (result: PoseLandmarkerResult, timestampMs: number) => void;

export class PoseDetector {
  private landmarker: PoseLandmarker | null = null;
  private rafHandle: number | null = null;
  private running = false;

  static async create(): Promise<PoseDetector> {
    const detector = new PoseDetector();
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    detector.landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    return detector;
  }

  /** Starts a continuous detection loop tied to rAF, calling onFrame with each result. */
  start(video: HTMLVideoElement, onFrame: PoseFrameCallback): void {
    if (!this.landmarker) {
      throw new Error('PoseDetector.create() must resolve before start()');
    }
    this.running = true;

    const loop = (): void => {
      if (!this.running || !this.landmarker) return;
      const timestampMs = performance.now();
      const result = this.landmarker.detectForVideo(video, timestampMs);
      onFrame(result, timestampMs);
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  dispose(): void {
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
  }
}
