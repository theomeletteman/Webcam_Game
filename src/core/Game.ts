import { GameCanvas } from './Canvas';
import { GameLoop } from './GameLoop';

/**
 * Temporary demo entity used only to visually confirm the loop is working
 * correctly (constant velocity regardless of frame rate, smooth via
 * interpolation). Replaced by the real Player entity in Milestone 3.
 */
class DemoSquare {
  x = 0;
  prevX = 0;
  readonly size = 40;
  readonly speed = 200; // px/sec
  private direction = 1;

  update(dt: number, boundsWidth: number): void {
    this.prevX = this.x;
    this.x += this.speed * this.direction * dt;

    if (this.x + this.size > boundsWidth) {
      this.x = boundsWidth - this.size;
      this.direction = -1;
    } else if (this.x < 0) {
      this.x = 0;
      this.direction = 1;
    }
  }

  /** Position blended between the previous and current fixed update. */
  interpolatedX(alpha: number): number {
    return this.prevX + (this.x - this.prevX) * alpha;
  }
}

export class Game {
  private readonly canvas: GameCanvas;
  private readonly loop: GameLoop;
  private readonly demoSquare = new DemoSquare();

  constructor(container: HTMLElement) {
    this.canvas = new GameCanvas(container);
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      (alpha) => this.render(alpha),
    );

    // Pause simulation while the tab is hidden — avoids burning CPU/battery
    // and prevents a huge accumulated delta when the tab regains focus.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.loop.stop();
      } else {
        this.loop.start();
      }
    });
  }

  start(): void {
    this.loop.start();
  }

  private update(dt: number): void {
    this.demoSquare.update(dt, this.canvas.width);
  }

  private render(alpha: number): void {
    this.canvas.clear();
    const ctx = this.canvas.ctx;

    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const groundY = this.canvas.height - 60;
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, groundY, this.canvas.width, 2);

    const x = this.demoSquare.interpolatedX(alpha);
    ctx.fillStyle = '#89b4fa';
    ctx.fillRect(x, groundY - this.demoSquare.size, this.demoSquare.size, this.demoSquare.size);
  }
}
