export type DodgeLane = 'left' | 'center' | 'right';

export const DODGE_ITEM_LABELS = ['Deadline', 'Timesheet', 'Release', 'Dependency', 'Meeting', 'Training', 'Error'];

export class DodgeItem {
  readonly lane: DodgeLane;
  readonly label: string;
  /** 0 = just spawned (far away), 1 = reached the player. */
  progress = 0;
  resolved: 'pending' | 'dodged' | 'hit' = 'pending';

  constructor(lane: DodgeLane, label: string) {
    this.lane = lane;
    this.label = label;
  }

  update(dt: number, durationSeconds: number): void {
    this.progress += dt / durationSeconds;
  }

  get hasArrived(): boolean {
    return this.progress >= 1;
  }

  get isExpired(): boolean {
    return this.progress >= 1.3; // past resolution — safe to remove
  }
}
