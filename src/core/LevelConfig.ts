import type { ObstacleType } from '../entities/Obstacle';

export interface LevelConfig {
  /** 1-indexed position within the 5-level set. */
  level: number;
  scrollSpeed: number; // px/s
  minGapPx: number;
  maxGapPx: number;
  obstacleTypes: ObstacleType[];
  /** Obstacles that must be cleared to advance to the next level. */
  obstaclesToClear: number;
}

/**
 * Escalation strategy per level (see project plan):
 * L1 — single type, generous spacing: learn the jump mechanic alone.
 * L2 — introduce duck, still generous spacing.
 * L3 — tighter spacing forces jump-then-duck combos without a new type.
 * L4 — faster scroll, moderate spacing: reaction-time pressure.
 * L5 — fastest + tightest: everything combined.
 */
export const LEVEL_SET: LevelConfig[] = [
  { level: 1, scrollSpeed: 260, minGapPx: 420, maxGapPx: 600, obstacleTypes: ['jump'], obstaclesToClear: 8 },
  { level: 2, scrollSpeed: 300, minGapPx: 380, maxGapPx: 560, obstacleTypes: ['jump', 'duck'], obstaclesToClear: 10 },
  { level: 3, scrollSpeed: 340, minGapPx: 260, maxGapPx: 420, obstacleTypes: ['jump', 'duck'], obstaclesToClear: 10 },
  { level: 4, scrollSpeed: 400, minGapPx: 300, maxGapPx: 460, obstacleTypes: ['jump', 'duck'], obstaclesToClear: 12 },
  { level: 5, scrollSpeed: 460, minGapPx: 240, maxGapPx: 400, obstacleTypes: ['jump', 'duck'], obstaclesToClear: 14 },
];
