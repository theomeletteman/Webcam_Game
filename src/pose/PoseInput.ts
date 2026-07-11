import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { InputSource } from '../input/InputSource';
import { computeBodyCenterY } from './bodyMetrics';

// Fractions of normalized frame height. Image-space Y increases downward,
// so "moved up" means bodyY decreased relative to baseline.
const DEFAULT_JUMP_DELTA = 0.07;
const DEFAULT_DUCK_DELTA = 0.06;

export class PoseInput implements InputSource {
  private baselineY: number | null = null;
  private latestBodyY: number | null = null;

  private jumpQueued = false;
  private aboveJumpThreshold = false; // tracks the rising edge, like a key-down
  private duckHeld = false;

  private readonly jumpDelta: number;
  private readonly duckDelta: number;

  constructor(jumpDelta: number = DEFAULT_JUMP_DELTA, duckDelta: number = DEFAULT_DUCK_DELTA) {
    this.jumpDelta = jumpDelta;
    this.duckDelta = duckDelta;
  }

  setBaseline(y: number): void {
    this.baselineY = y;
  }

  get hasBaseline(): boolean {
    return this.baselineY !== null;
  }

  get currentBodyY(): number | null {
    return this.latestBodyY;
  }

  /** Feed the latest detected landmarks for the tracked person (call once per pose frame). */
  updateFromLandmarks(landmarks: NormalizedLandmark[]): void {
    const bodyY = computeBodyCenterY(landmarks);
    if (bodyY === null) return; // low-confidence frame — skip rather than act on noise
    this.latestBodyY = bodyY;

    if (this.baselineY === null) return;

    const upwardDelta = this.baselineY - bodyY; // positive = moved up
    const isAboveThreshold = upwardDelta > this.jumpDelta;
    if (isAboveThreshold && !this.aboveJumpThreshold) {
      this.jumpQueued = true; // edge-triggered, mirrors KeyboardInput's key-repeat guard
    }
    this.aboveJumpThreshold = isAboveThreshold;

    const downwardDelta = bodyY - this.baselineY; // positive = moved down
    this.duckHeld = downwardDelta > this.duckDelta;
  }

  isJumpPressed(): boolean {
    if (this.jumpQueued) {
      this.jumpQueued = false;
      return true;
    }
    return false;
  }

  isDuckHeld(): boolean {
    return this.duckHeld;
  }
}
