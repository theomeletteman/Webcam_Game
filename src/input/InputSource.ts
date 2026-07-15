export type LeanDirection = 'left' | 'center' | 'right';

/**
 * Abstraction over "how the player expresses jump/duck intent."
 *
 * Player reads from this interface only — it has no idea whether input
 * comes from a keyboard, gamepad, or (Phase 2) real-world body pose.
 * This is the seam PoseInput plugs into later without touching Player.
 */
export interface InputSource {
  /**
   * True for exactly one read after jump is triggered (edge-triggered,
   * not held) — prevents continuous jumping while a key/pose is sustained.
   */
  isJumpPressed(): boolean;

  /** True for as long as duck is being held/sustained (level-triggered). */
  isDuckHeld(): boolean;
}

/** Extended input contract for the Weekly Dodge mode — adds lean left/right. */
export interface DodgeInputSource extends InputSource {
  getLean(): LeanDirection;
}
