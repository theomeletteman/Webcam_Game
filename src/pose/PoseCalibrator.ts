const DEFAULT_WARMUP_MS = 2000; // time to get into position, discarded (not sampled)
const DEFAULT_SAMPLE_DURATION_MS = 1500; // actual baseline sampling window, after warm-up

export type CalibrationPhase = 'warmup' | 'sampling' | 'complete';

/**
 * Two-stage calibration: a warm-up window (gives the player time to walk
 * into frame and settle into position — discarded, not sampled) followed
 * by the real baseline sampling window. Skipping the warm-up risks baking
 * a bad baseline from a mid-adjustment posture.
 */
export class PoseCalibrator {
  private readonly warmupMs: number;
  private readonly sampleDurationMs: number;
  private samples: number[] = [];
  private startTimestampMs: number | null = null;
  private baselineY: number | null = null;

  constructor(sampleDurationMs: number = DEFAULT_SAMPLE_DURATION_MS, warmupMs: number = DEFAULT_WARMUP_MS) {
    this.sampleDurationMs = sampleDurationMs;
    this.warmupMs = warmupMs;
  }

  addSample(bodyY: number, timestampMs: number): void {
    if (this.isComplete) return;

    if (this.startTimestampMs === null) {
      this.startTimestampMs = timestampMs;
    }

    const elapsed = timestampMs - this.startTimestampMs;
    if (elapsed < this.warmupMs) return; // still warming up — discard

    this.samples.push(bodyY);
    if (elapsed - this.warmupMs >= this.sampleDurationMs) {
      this.baselineY = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    }
  }

  get isComplete(): boolean {
    return this.baselineY !== null;
  }

  get baseline(): number | null {
    return this.baselineY;
  }

  phase(nowMs: number): CalibrationPhase {
    if (this.isComplete) return 'complete';
    if (this.startTimestampMs === null) return 'warmup';
    return nowMs - this.startTimestampMs < this.warmupMs ? 'warmup' : 'sampling';
  }

  /** 0..1 progress through the warm-up ("get into position") window. */
  warmupProgress(nowMs: number): number {
    if (this.startTimestampMs === null) return 0;
    return Math.min(1, (nowMs - this.startTimestampMs) / this.warmupMs);
  }

  /** 0..1 progress through the actual sampling window (0 while still warming up). */
  samplingProgress(nowMs: number): number {
    if (this.startTimestampMs === null) return 0;
    const elapsed = nowMs - this.startTimestampMs - this.warmupMs;
    return Math.min(1, Math.max(0, elapsed / this.sampleDurationMs));
  }
}
