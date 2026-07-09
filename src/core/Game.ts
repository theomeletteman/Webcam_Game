import { GameCanvas } from './Canvas';
import { GameLoop } from './GameLoop';
import { Player } from '../entities/Player';
import { KeyboardInput } from '../input/KeyboardInput';
import type { InputSource } from '../input/InputSource';

const GROUND_MARGIN = 60; // distance from bottom of canvas to the ground line

const STATE_COLORS: Record<Player['state'], string> = {
  running: '#89b4fa',
  jumping: '#a6e3a1',
  ducking: '#f9e2af',
};

export class Game {
  private readonly canvas: GameCanvas;
  private readonly loop: GameLoop;
  private readonly player: Player;
  private readonly input: InputSource;

  constructor(container: HTMLElement) {
    this.canvas = new GameCanvas(container);
    this.input = new KeyboardInput();
    this.player = new Player(80, this.groundY());

    this.loop = new GameLoop(
      (dt) => this.update(dt),
      (alpha) => this.render(alpha),
    );

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

  private groundY(): number {
    return this.canvas.height - GROUND_MARGIN;
  }

  private update(dt: number): void {
    this.player.update(dt, this.input, this.groundY());
  }

  private render(alpha: number): void {
    this.canvas.clear();
    const ctx = this.canvas.ctx;
    const groundY = this.groundY();

    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, groundY, this.canvas.width, 2);

    const y = this.player.interpolatedY(alpha);
    ctx.fillStyle = STATE_COLORS[this.player.state];
    ctx.fillRect(this.player.x, y, this.player.width, this.player.height);
  }
}
