import { LEVEL_SET, type LevelConfig } from './LevelConfig';

export type LevelManagerEvent =
  | { type: 'levelComplete'; completedLevel: number }
  | { type: 'setComplete' };

export class LevelManager {
  private levelIndex = 0;
  private clearedInLevel = 0;

  get config(): LevelConfig {
    return LEVEL_SET[Math.min(this.levelIndex, LEVEL_SET.length - 1)];
  }

  get levelNumber(): number {
    return this.config.level;
  }

  get progress(): { cleared: number; needed: number } {
    return { cleared: this.clearedInLevel, needed: this.config.obstaclesToClear };
  }

  get isSetComplete(): boolean {
    return this.levelIndex >= LEVEL_SET.length;
  }

  /** Feed the number of obstacles cleared this frame; returns an event if a threshold was crossed. */
  registerCleared(count: number): LevelManagerEvent | null {
    if (count <= 0 || this.isSetComplete) return null;

    this.clearedInLevel += count;
    if (this.clearedInLevel < this.config.obstaclesToClear) {
      return null;
    }

    return this.completeCurrentLevel();
  }

  /**
   * Manually advances past the current level regardless of obstacle count —
   * used by Score mode, where a level completes on reaching a score target
   * rather than a clean-clear count.
   */
  advanceLevel(): LevelManagerEvent {
    return this.completeCurrentLevel();
  }

  private completeCurrentLevel(): LevelManagerEvent {
    const completedLevel = this.levelNumber;
    this.clearedInLevel = 0;
    this.levelIndex++;

    if (this.levelIndex >= LEVEL_SET.length) {
      return { type: 'setComplete' };
    }
    return { type: 'levelComplete', completedLevel };
  }

  reset(): void {
    this.levelIndex = 0;
    this.clearedInLevel = 0;
  }

  /** Resets progress within the current level only — used by retry mode on collision. */
  resetCurrentLevelProgress(): void {
    this.clearedInLevel = 0;
  }
}
