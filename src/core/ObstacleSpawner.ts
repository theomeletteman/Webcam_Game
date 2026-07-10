import { Obstacle } from '../entities/Obstacle';
import type { LevelConfig } from './LevelConfig';
import { type Box, insetBox, intersects } from './collision';
import { PLAYER_HITBOX_INSET_X, PLAYER_HITBOX_INSET_Y } from './constants';

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export interface SpawnUpdateResult {
  clearedCount: number;
  collidedCount: number;
}

export class ObstacleSpawner {
  private obstacles: Obstacle[] = [];
  private distanceUntilNextSpawn: number;

  constructor(initialGapPx: number) {
    this.distanceUntilNextSpawn = initialGapPx;
  }

  get all(): readonly Obstacle[] {
    return this.obstacles;
  }

  /**
   * Advances obstacles, spawns new ones, prunes offscreen ones, and checks
   * collision against the player's (inset) hitbox. Spawning never halts on
   * collision — the caller (Game) decides what a collision means per mode.
   */
  update(dt: number, config: LevelConfig, groundY: number, spawnX: number, player: Box): SpawnUpdateResult {
    let clearedCount = 0;
    let collidedCount = 0;
    const playerHitbox = insetBox(player, PLAYER_HITBOX_INSET_X, PLAYER_HITBOX_INSET_Y);

    for (const obstacle of this.obstacles) {
      obstacle.update(dt, config.scrollSpeed);
      if (obstacle.outcome !== 'pending') continue;

      if (intersects(playerHitbox, obstacle)) {
        obstacle.outcome = 'collided';
        collidedCount++;
      } else if (obstacle.x + obstacle.width < player.x) {
        obstacle.outcome = 'cleared';
        clearedCount++;
      }
    }

    this.obstacles = this.obstacles.filter((o) => !o.isOffscreen());

    this.distanceUntilNextSpawn -= config.scrollSpeed * dt;
    if (this.distanceUntilNextSpawn <= 0) {
      const type = config.obstacleTypes[Math.floor(Math.random() * config.obstacleTypes.length)];
      this.obstacles.push(new Obstacle(type, spawnX, groundY));
      this.distanceUntilNextSpawn = randomBetween(config.minGapPx, config.maxGapPx);
    }

    return { clearedCount, collidedCount };
  }

  /** Resets spawn timing (not the obstacle array) when advancing to a new level config. */
  setNextGap(gapPx: number): void {
    this.distanceUntilNextSpawn = gapPx;
  }

  reset(initialGapPx: number): void {
    this.obstacles = [];
    this.distanceUntilNextSpawn = initialGapPx;
  }
}
