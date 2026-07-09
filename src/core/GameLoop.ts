/**
 * Fixed-timestep game loop.
 *
 * `update` runs at a constant rate (default 60Hz) regardless of display
 * refresh rate, so physics/collision behavior is deterministic.
 * `render` runs once per animation frame and receives an interpolation
 * factor (0..1) representing how far we are between the last two fixed
 * updates, so motion stays smooth even if the display refresh rate
 * doesn't match the fixed update rate.
 *
 * Reference: https://gafferongames.com/post/fix_your_timestep/
 */

export type UpdateFn = (fixedDeltaSeconds: number) => void;
export type RenderFn = (interpolation: number) => void;

const FIXED_TIMESTEP_SECONDS = 1 / 60;
// Caps how much sim time a single real frame can produce, to avoid a
// death-spiral of catch-up updates after a long pause (e.g. backgrounded tab).
const MAX_FRAME_TIME_SECONDS = 0.25;

export class GameLoop {
  private accumulator = 0;
  private lastTimestamp: number | null = null;
  private rafHandle: number | null = null;
  private running = false;

  private readonly update: UpdateFn;
  private readonly render: RenderFn;

  constructor(update: UpdateFn, render: RenderFn) {
    this.update = update;
    this.render = render;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = null;
    this.rafHandle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private tick = (timestamp: number): void => {
    if (!this.running) return;

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
    }

    let frameTime = (timestamp - this.lastTimestamp) / 1000;
    frameTime = Math.min(frameTime, MAX_FRAME_TIME_SECONDS);
    this.lastTimestamp = timestamp;

    this.accumulator += frameTime;

    while (this.accumulator >= FIXED_TIMESTEP_SECONDS) {
      this.update(FIXED_TIMESTEP_SECONDS);
      this.accumulator -= FIXED_TIMESTEP_SECONDS;
    }

    const interpolation = this.accumulator / FIXED_TIMESTEP_SECONDS;
    this.render(interpolation);

    this.rafHandle = requestAnimationFrame(this.tick);
  };
}
