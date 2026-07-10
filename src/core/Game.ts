import { GameCanvas } from './Canvas';
import { GameLoop } from './GameLoop';
import { Player } from '../entities/Player';
import { KeyboardInput } from '../input/KeyboardInput';
import type { InputSource } from '../input/InputSource';
import { ObstacleSpawner } from './ObstacleSpawner';
import { LevelManager } from './LevelManager';
import { GROUND_MARGIN, PLAYER_X } from './constants';

const STATE_COLORS: Record<Player['state'], string> = {
  running: '#89b4fa',
  jumping: '#a6e3a1',
  ducking: '#f9e2af',
};

const OBSTACLE_COLORS = {
  jump: '#f38ba8',
  duck: '#cba6f7',
};

const MESSAGE_DURATION_SECONDS = 2;

export class Game {
  private readonly canvas: GameCanvas;
  private readonly loop: GameLoop;
  private readonly player: Player;
  private readonly input: InputSource;
  private readonly spawner: ObstacleSpawner;
  private readonly levelManager: LevelManager;

  private message = '';
  private messageTimer = 0;

  constructor(container: HTMLElement) {
    this.canvas = new GameCanvas(container);
    this.input = new KeyboardInput();
    this.player = new Player(PLAYER_X, this.groundY());
    this.levelManager = new LevelManager();
    this.spawner = new ObstacleSpawner(this.levelManager.config.minGapPx);

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

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }

    if (this.levelManager.isSetComplete) return;

    const config = this.levelManager.config;
    const clearedThisFrame = this.spawner.update(
      dt,
      config,
      this.groundY(),
      this.canvas.width,
      this.player.x,
    );

    const event = this.levelManager.registerCleared(clearedThisFrame);
    if (event?.type === 'levelComplete') {
      this.spawner.setNextGap(this.levelManager.config.minGapPx);
      this.message = `Level ${event.completedLevel} complete!`;
      this.messageTimer = MESSAGE_DURATION_SECONDS;
    } else if (event?.type === 'setComplete') {
      this.message = 'Set complete! 🎉';
      this.messageTimer = MESSAGE_DURATION_SECONDS;
    }
  }

  private render(alpha: number): void {
    this.canvas.clear();
    const ctx = this.canvas.ctx;
    const groundY = this.groundY();

    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, groundY, this.canvas.width, 2);

    for (const obstacle of this.spawner.all) {
      ctx.fillStyle = OBSTACLE_COLORS[obstacle.type];
      ctx.fillRect(obstacle.interpolatedX(alpha), obstacle.y, obstacle.width, obstacle.height);
    }

    const playerY = this.player.interpolatedY(alpha);
    ctx.fillStyle = STATE_COLORS[this.player.state];
    ctx.fillRect(this.player.x, playerY, this.player.width, this.player.height);

    this.renderHud(ctx);
  }

  private renderHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#f5f5f5';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';

    if (this.levelManager.isSetComplete) {
      ctx.fillText('Set complete!', 16, 28);
    } else {
      const { cleared, needed } = this.levelManager.progress;
      ctx.fillText(`Level ${this.levelManager.levelNumber} — ${cleared}/${needed}`, 16, 28);
    }

    if (this.message) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#a6e3a1';
      ctx.fillText(this.message, this.canvas.width / 2, 60);
    }
  }
}
