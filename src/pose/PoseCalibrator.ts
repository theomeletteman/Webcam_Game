const DEFAULT_WARMUP_MS = 2000; // time to get into position, discarded (not sampled)
const DEFAULT_SAMPLE_DURATION_MS = 1500; // actual baseline sampling window, after warm-up

export type CalibrationPhase = 'warmup' | 'sampling' | 'complete';

/**
 * Two-stage calibration: a warm-up window (gives the player time to walk
 * into frame and settle into position — discarded, not sampled) followed
 * by the real baseline sampling window. Samples both X and Y so the same
 * single calibration pass covers both the runner game (Y baseline, for
 * jump/duck) and the Weekly Dodge mode (X baseline, for lean left/right).
 */
export class PoseCalibrator {
  private readonly warmupMs: number;
  private readonly sampleDurationMs: number;
  private samplesX: number[] = [];
  private samplesY: number[] = [];
  private startTimestampMs: number | null = null;
  private baselineXValue: number | null = null;
  private baselineYValue: number | null = null;

  constructor(sampleDurationMs: number = DEFAULT_SAMPLE_DURATION_MS, warmupMs: number = DEFAULT_WARMUP_MS) {
    this.sampleDurationMs = sampleDurationMs;
    this.warmupMs = warmupMs;
  }

  addSample(bodyX: number, bodyY: number, timestampMs: number): void {
    if (this.isComplete) return;

    if (this.startTimestampMs === null) {
      this.startTimestampMs = timestampMs;
    }

    const elapsed = timestampMs - this.startTimestampMs;
    if (elapsed < this.warmupMs) return; // still warming up — discard

    this.samplesX.push(bodyX);
    this.samplesY.push(bodyY);
    if (elapsed - this.warmupMs >= this.sampleDurationMs) {
      this.baselineXValue = this.samplesX.reduce((a, b) => a + b, 0) / this.samplesX.length;
      this.baselineYValue = this.samplesY.reduce((a, b) => a + b, 0) / this.samplesY.length;
    }
  }

  get isComplete(): boolean {
    return this.baselineYValue !== null;
  }

  get baseline(): number | null {
    return this.baselineYValue;
  }

  get baselineX(): number | null {
    return this.baselineXValue;
  }

  phase(nowMs: number): CalibrationPhase {
    if (this.isComplete) return 'complete';
    if (this.startTimestampMs === null) return 'warmup';
    return nowMs - this.startTimestampMs < this.warmupMs ? 'warmup' : 'sampling';
  }

  warmupProgress(nowMs: number): number {
    if (this.startTimestampMs === null) return 0;
    return Math.min(1, (nowMs - this.startTimestampMs) / this.warmupMs);
  }

  samplingProgress(nowMs: number): number {
    if (this.startTimestampMs === null) return 0;
    const elapsed = nowMs - this.startTimestampMs - this.warmupMs;
    return Math.min(1, Math.max(0, elapsed / this.sampleDurationMs));
  }
}
