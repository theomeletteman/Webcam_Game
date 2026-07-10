import type { InputSource } from '../input/InputSource';
import {
  PLAYER_WIDTH,
  PLAYER_STANDING_HEIGHT,
  PLAYER_DUCKING_HEIGHT,
} from '../core/constants';

export type PlayerState = 'running' | 'jumping' | 'ducking';

const GRAVITY = 1800; // px/s^2
const JUMP_VELOCITY = -700; // px/s (negative = upward)

export class Player {
  x: number;
  y: number;
  private prevY: number;
  private velocityY = 0;
  private grounded = true;

  state: PlayerState = 'running';

  readonly width = PLAYER_WIDTH;
  readonly standingHeight = PLAYER_STANDING_HEIGHT;
  readonly duckingHeight = PLAYER_DUCKING_HEIGHT;

  constructor(x: number, initialGroundY: number) {
    this.x = x;
    this.y = initialGroundY - this.standingHeight;
    this.prevY = this.y;
  }

  /** Current bounding-box height — shorter while ducking. */
  get height(): number {
    return this.state === 'ducking' ? this.duckingHeight : this.standingHeight;
  }

  /**
   * groundY is passed in per-call (rather than cached at construction) so
   * the player stays correctly grounded across canvas resizes.
   */
  update(dt: number, input: InputSource, groundY: number): void {
    this.prevY = this.y;

    if (this.grounded) {
      // Deliberate rule: duck is a grounded-only action, not available
      // mid-air — keeps the state machine unambiguous.
      if (input.isJumpPressed()) {
        this.velocityY = JUMP_VELOCITY;
        this.grounded = false;
        this.state = 'jumping';
      } else {
        this.state = input.isDuckHeld() ? 'ducking' : 'running';
      }
    }

    if (!this.grounded) {
      this.velocityY += GRAVITY * dt;
      this.y += this.velocityY * dt;

      const groundLevelY = groundY - this.height;
      if (this.y >= groundLevelY) {
        this.y = groundLevelY;
        this.velocityY = 0;
        this.grounded = true;
        this.state = input.isDuckHeld() ? 'ducking' : 'running';
      }
    } else {
      this.y = groundY - this.height;
    }
  }

  /** Position blended between the previous and current fixed update. */
  interpolatedY(alpha: number): number {
    return this.prevY + (this.y - this.prevY) * alpha;
  }
}
