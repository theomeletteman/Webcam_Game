import { PLAYER_DUCKING_HEIGHT } from '../core/constants';

export type ObstacleType = 'jump' | 'duck';

export class Obstacle {
  x: number;
  private prevX: number;
  /** Resolved once the obstacle has scrolled past the player (cleared) or overlapped it (collided). */
  outcome: 'pending' | 'cleared' | 'collided' = 'pending';

  readonly type: ObstacleType;
  readonly width: number;
  readonly height: number;
  readonly y: number;

  constructor(type: ObstacleType, spawnX: number, groundY: number) {
    this.type = type;
    this.x = spawnX;
    this.prevX = spawnX;

    if (type === 'jump') {
      // Ground-level obstacle — must be jumped over.
      this.width = 30 + Math.random() * 20;
      this.height = 30 + Math.random() * 20;
      this.y = groundY - this.height;
    } else {
      // Overhead bar — its bottom edge sits just above ducking-player
      // height, so only a ducking player clears it; a standing player
      // collides with it. Duck-obstacle dimensions are fixed (not
      // randomized) since the clearance margin is already tight.
      this.width = 60;
      this.height = 34;
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
