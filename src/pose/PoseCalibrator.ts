const DEFAULT_DURATION_MS = 1500;

/**
 * Averages bodyY samples over a short window while the player stands
 * normally, producing a per-person, per-camera-distance baseline. Fixed
 * pixel thresholds don't work here — body proportions and distance from
 * the camera vary too much across users.
 */
export class PoseCalibrator {
  private readonly durationMs: number;
  private samples: number[] = [];
  private startTimestampMs: number | null = null;
  private baselineY: number | null = null;

  constructor(durationMs: number = DEFAULT_DURATION_MS) {
    this.durationMs = durationMs;
  }

  addSample(bodyY: number, timestampMs: number): void {
    if (this.isComplete) return;

    if (this.startTimestampMs === null) {
      this.startTimestampMs = timestampMs;
    }
    this.samples.push(bodyY);

    if (timestampMs - this.startTimestampMs >= this.durationMs) {
      this.baselineY = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    }
  }

  get isComplete(): boolean {
    return this.baselineY !== null;
  }

  get baseline(): number | null {
    return this.baselineY;
  }

  /** 0..1 progress through the calibration window, for a progress indicator. */
  progress(nowMs: number): number {
    if (this.startTimestampMs === null) return 0;
    return Math.min(1, (nowMs - this.startTimestampMs) / this.durationMs);
  }
}
