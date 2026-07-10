import { Obstacle } from '../entities/Obstacle';
import type { LevelConfig } from './LevelConfig';

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
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
   * Advances obstacles, spawns new ones, and prunes offscreen ones.
   * Returns the number of obstacles newly marked "cleared" this frame
   * (scrolled past playerX) so the caller can feed level progression.
   */
  update(dt: number, config: LevelConfig, groundY: number, spawnX: number, playerX: number): number {
    let clearedThisFrame = 0;

    for (const obstacle of this.obstacles) {
      obstacle.update(dt, config.scrollSpeed);
      if (!obstacle.cleared && obstacle.x + obstacle.width < playerX) {
        obstacle.cleared = true;
        clearedThisFrame++;
      }
    }

    this.obstacles = this.obstacles.filter((o) => !o.isOffscreen());

    // Spawn timing is distance-based (scrollSpeed * dt), not time-based,
    // so gap spacing stays visually consistent as speed changes per level.
    this.distanceUntilNextSpawn -= config.scrollSpeed * dt;
    if (this.distanceUntilNextSpawn <= 0) {
      const type = config.obstacleTypes[Math.floor(Math.random() * config.obstacleTypes.length)];
      this.obstacles.push(new Obstacle(type, spawnX, groundY));
      this.distanceUntilNextSpawn = randomBetween(config.minGapPx, config.maxGapPx);
    }

    return clearedThisFrame;
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
