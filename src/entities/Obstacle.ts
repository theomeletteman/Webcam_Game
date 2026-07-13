import { PLAYER_DUCKING_HEIGHT } from '../core/constants';

export type ObstacleType = 'jump' | 'duck';

/** Cosmetic-only variant index for jump obstacles — picks between briefcase/folders/mug art. */
export type JumpVariant = 0 | 1 | 2;

export class Obstacle {
  x: number;
  private prevX: number;
  /** Resolved once the obstacle has scrolled past the player (cleared) or overlapped it (collided). */
  outcome: 'pending' | 'cleared' | 'collided' = 'pending';

  readonly type: ObstacleType;
  readonly width: number;
  readonly height: number;
  readonly y: number;
  /** Cosmetic only — which office-item art to draw for a jump obstacle. Unused for duck obstacles. */
  readonly jumpVariant: JumpVariant;

  constructor(type: ObstacleType, spawnX: number, groundY: number) {
    this.type = type;
    this.x = spawnX;
    this.prevX = spawnX;
    this.jumpVariant = Math.floor(Math.random() * 3) as JumpVariant;

    if (type === 'jump') {
      // Ground-level obstacle — must be jumped over.
      this.width = 34 + Math.random() * 18;
      this.height = 30 + Math.random() * 18;
      this.y = groundY - this.height;
    } else {
      // Hanging pendant lamp — its bottom edge sits just above
      // ducking-player height, so only a ducking player clears it; a
      // standing player collides with it. Tall and narrow to match the
      // lamp artwork rather than the old wide-bar shape.
      this.width = 42;
      this.height = 78;
      const clearance = 6;
      this.y = groundY - PLAYER_DUCKING_HEIGHT - clearance - this.height;
    }
  }

  update(dt: number, scrollSpeed: number): void {
    this.prevX = this.x;
    this.x -= scrollSpeed * dt;
  }

  interpolatedX(alpha: number): number {
    return this.prevX + (this.x - this.prevX) * alpha;
  }

  isOffscreen(): boolean {
    return this.x + this.width < 0;
  }
}
