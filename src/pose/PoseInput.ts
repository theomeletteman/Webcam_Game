import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { DodgeInputSource, LeanDirection } from '../input/InputSource';
import { computeBodyCenter } from './bodyMetrics';

// Fractions of normalized frame height/width. Image-space Y increases
// downward, so "moved up" means bodyY decreased relative to baseline.
const DEFAULT_JUMP_DELTA = 0.07;
const DEFAULT_DUCK_DELTA = 0.06;

// Exponential moving average weight on the previous smoothed value — higher
// means smoother but slightly more lag. Raw per-frame landmark positions are
// noisy enough that comparing them directly to a threshold causes false
// triggers; smoothing first fixes most of that at the source.
const SMOOTHING_ALPHA = 0.5;

// A raw threshold-crossing must persist for this long before it's treated
// as real, not a single noisy frame. Duck's window is deliberately longer
// than jump's: a genuine duck is a held position (passing under an
// obstacle), while the natural knee-bend countermovement people do right
// before jumping is brief — this window is tuned to let the former
// through and filter the latter.
const DUCK_CONFIRM_MS = 220;
const JUMP_CONFIRM_MS = 60;

// After a jump is confirmed, further jumps are ignored for this long —
// backstop against a jump's peak wobbling across the threshold twice.
const JUMP_COOLDOWN_MS = 600;

// Standing up quickly from a duck often overshoots slightly above the
// normal standing baseline (a small rebound). Rather than blocking jump
// detection outright for a window after duck release (which would also
// block a genuine, deliberate duck-then-jump combo), we raise the bar:
// a jump during this window must clear a noticeably bigger threshold,
// which a passive rebound won't reach but a real jump attempt will.
const DUCK_RELEASE_COOLDOWN_MS = 400;
const DUCK_RELEASE_JUMP_MULTIPLIER = 1.6;

// Lean (Weekly Dodge mode) — same smoothing/debounce approach as duck.
const DEFAULT_LEAN_DELTA = 0.06; // fraction of normalized frame width
const LEAN_CONFIRM_MS = 150;

export class PoseInput implements DodgeInputSource {
  private baselineY: number | null = null;
  private baselineX: number | null = null;
  private smoothedY: number | null = null;
  private smoothedX: number | null = null;
  private latestBodyY: number | null = null;

  private readonly jumpDelta: number;
  private readonly duckDelta: number;
  private readonly leanDelta: number;

  // Duck: debounced level-trigger
  private duckHeld = false;
  private duckCandidate = false;
  private duckCandidateSinceMs: number | null = null;
  private duckReleasedAtMs: number | null = null;

  // Jump: debounced edge-trigger + cooldown
  private confirmedAboveJump = false;
  private aboveJumpCandidate = false;
  private aboveJumpCandidateSinceMs: number | null = null;
  private jumpQueued = false;
  private lastJumpQueuedAtMs: number | null = null;

  // Lean: debounced level-trigger, mirrors duck's pattern
  private lean: LeanDirection = 'center';
  private leanCandidate: LeanDirection = 'center';
  private leanCandidateSinceMs: number | null = null;

  constructor(jumpDelta: number = DEFAULT_JUMP_DELTA, duckDelta: number = DEFAULT_DUCK_DELTA, leanDelta: number = DEFAULT_LEAN_DELTA) {
    this.jumpDelta = jumpDelta;
    this.duckDelta = duckDelta;
    this.leanDelta = leanDelta;
  }

  setBaseline(y: number): void {
    this.baselineY = y;
  }

  setBaselineX(x: number): void {
    this.baselineX = x;
  }

  get hasBaseline(): boolean {
    return this.baselineY !== null;
  }

  get currentBodyY(): number | null {
    return this.latestBodyY;
  }

  /** Feed the latest detected landmarks for the tracked person (call once per pose frame). */
  updateFromLandmarks(landmarks: NormalizedLandmark[], timestampMs: number): void {
    const center = computeBodyCenter(landmarks);
    if (center === null) return; // low-confidence frame — skip rather than act on noise
    this.latestBodyY = center.y;
    this.smoothedY = this.smoothedY === null ? center.y : this.smoothedY * SMOOTHING_ALPHA + center.y * (1 - SMOOTHING_ALPHA);
    this.smoothedX = this.smoothedX === null ? center.x : this.smoothedX * SMOOTHING_ALPHA + center.x * (1 - SMOOTHING_ALPHA);

    if (this.baselineY !== null) {
      this.updateJumpDuckState(this.smoothedY, timestampMs);
    }
    if (this.baselineX !== null) {
      this.updateLeanState(this.smoothedX, timestampMs);
    }
  }

  private updateJumpDuckState(y: number, timestampMs: number): void {
    const baseline = this.baselineY!;
    const rawDuckCandidate = y - baseline > this.duckDelta;

    const inDuckReleaseCooldown =
      this.duckReleasedAtMs !== null && timestampMs - this.duckReleasedAtMs < DUCK_RELEASE_COOLDOWN_MS;
    const effectiveJumpDelta = inDuckReleaseCooldown ? this.jumpDelta * DUCK_RELEASE_JUMP_MULTIPLIER : this.jumpDelta;
    const rawJumpCandidate = baseline - y > effectiveJumpDelta;

    // If the body is currently moving upward past the jump threshold,
    // don't let a not-yet-confirmed duck reading lock in — that's the
    // natural pre-jump crouch resolving into a jump, not a duck. A duck
    // that's already confirmed (genuinely held) is untouched by this.
    const effectiveDuckCandidate = rawJumpCandidate && !this.duckHeld ? false : rawDuckCandidate;

    // --- Duck (debounced level-trigger) ---
    if (effectiveDuckCandidate !== this.duckCandidate) {
      this.duckCandidate = effectiveDuckCandidate;
      this.duckCandidateSinceMs = timestampMs;
    }
    const duckElapsed = this.duckCandidateSinceMs === null ? 0 : timestampMs - this.duckCandidateSinceMs;
    if (duckElapsed >= DUCK_CONFIRM_MS && this.duckHeld !== this.duckCandidate) {
      if (this.duckHeld && !this.duckCandidate) {
        this.duckReleasedAtMs = timestampMs; // just released — arms the raised-threshold window
      }
      this.duckHeld = this.duckCandidate;
    }

    // --- Jump (debounced edge-trigger + cooldown) ---
    if (rawJumpCandidate !== this.aboveJumpCandidate) {
      this.aboveJumpCandidate = rawJumpCandidate;
      this.aboveJumpCandidateSinceMs = timestampMs;
    }
    const jumpElapsed = this.aboveJumpCandidateSinceMs === null ? 0 : timestampMs - this.aboveJumpCandidateSinceMs;
    if (jumpElapsed < JUMP_CONFIRM_MS || this.confirmedAboveJump === this.aboveJumpCandidate) return;

    const wasConfirmedAbove = this.confirmedAboveJump;
    this.confirmedAboveJump = this.aboveJumpCandidate;
    if (wasConfirmedAbove || !this.confirmedAboveJump) return; // only act on a rising edge

    const inJumpCooldown =
      this.lastJumpQueuedAtMs !== null && timestampMs - this.lastJumpQueuedAtMs < JUMP_COOLDOWN_MS;

    if (!inJumpCooldown && !this.duckHeld) {
      this.jumpQueued = true;
      this.lastJumpQueuedAtMs = timestampMs;
    }
  }

  private updateLeanState(x: number, timestampMs: number): void {
    const baseline = this.baselineX!;
    const delta = x - baseline;
    // Note: image-space X is mirrored for a selfie view, so a positive
    // delta (body appears to move right on screen) corresponds to the
    // player physically leaning to their own right — matches the mirrored
    // video preview shown during calibration, so it feels intuitive.
    const rawCandidate: LeanDirection = delta > this.leanDelta ? 'right' : delta < -this.leanDelta ? 'left' : 'center';

    if (rawCandidate !== this.leanCandidate) {
      this.leanCandidate = rawCandidate;
      this.leanCandidateSinceMs = timestampMs;
    }
    const elapsed = this.leanCandidateSinceMs === null ? 0 : timestampMs - this.leanCandidateSinceMs;
    if (elapsed >= LEAN_CONFIRM_MS) {
      this.lean = this.leanCandidate;
    }
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

  /** Current lean direction (level-triggered, debounced) — used by the Weekly Dodge mode. */
  getLean(): LeanDirection {
    return this.lean;
  }
}
