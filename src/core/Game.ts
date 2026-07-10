import { GameCanvas } from './Canvas';
import { GameLoop } from './GameLoop';
import { Player } from '../entities/Player';
import { KeyboardInput } from '../input/KeyboardInput';
import type { InputSource } from '../input/InputSource';
import { ObstacleSpawner } from './ObstacleSpawner';
import { LevelManager } from './LevelManager';
import type { LevelConfig } from './LevelConfig';
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

const COUNTDOWN_STAGES = ['Ready', 'Set', 'Go!'];
const COUNTDOWN_STAGE_DURATION = 0.7; // seconds per stage
const CELEBRATION_DURATION = 1.5; // seconds
const RETRY_MESSAGE_DURATION = 1.2; // seconds
const HIT_FLASH_DURATION = 0.2; // seconds

// Score mode — its own continuous difficulty ramp, entirely independent of
// the 5-level structure used by Game Over mode.
const SCORE_PER_CLEAR = 1;
const SCORE_PENALTY_PER_COLLISION = 2;
const WINNING_SCORE = 10;
const SCORE_MODE_BASE_SPEED = 260;
const SCORE_MODE_SPEED_RAMP_PER_SEC = 4;
const SCORE_MODE_MAX_SPEED = 460;
const SCORE_MODE_MIN_GAP = 300;
const SCORE_MODE_MAX_GAP = 500;

type GameMode = 'score' | 'retry';
type Phase = 'modeSelect' | 'countdown' | 'running' | 'celebrating' | 'levelRetry' | 'setComplete';

interface PendingCelebration {
  message: string;
  leadsToSetComplete: boolean;
}

export class Game {
  private readonly canvas: GameCanvas;
  private readonly loop: GameLoop;
  private readonly player: Player;
  private readonly input: InputSource;
  private readonly spawner: ObstacleSpawner;
  private readonly levelManager: LevelManager; // used only in retry mode

  private phase: Phase = 'modeSelect';
  private mode: GameMode | null = null;

  // Score mode state
  private score = 0;
  private scoreModeElapsed = 0;

  private countdownStageIndex = 0;
  private countdownTimer = COUNTDOWN_STAGE_DURATION;

  private celebrationTimer = 0;
  private celebrationMessage = '';
  private celebrationLeadsToSetComplete = false;
  private finalMessage = '';

  // Set once a level/win threshold is reached, but held until the player
  // is grounded — avoids freezing mid-jump when the triggering obstacle
  // is cleared in the air.
  private pendingCelebration: PendingCelebration | null = null;

  private retryTimer = 0;
  private hitFlashTimer = 0;

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

    window.addEventListener('keydown', this.handleModeSelectKey);

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

  private readonly handleModeSelectKey = (event: KeyboardEvent): void => {
    if (this.phase !== 'modeSelect') return;

    if (event.code === 'Digit1' || event.code === 'Numpad1') {
      this.mode = 'score';
      this.spawner.reset(SCORE_MODE_MIN_GAP);
      this.beginCountdown();
    } else if (event.code === 'Digit2' || event.code === 'Numpad2') {
      this.mode = 'retry';
      this.spawner.reset(this.levelManager.config.minGapPx);
      this.beginCountdown();
    }
  };

  private beginCountdown(): void {
    this.countdownStageIndex = 0;
    this.countdownTimer = COUNTDOWN_STAGE_DURATION;
    this.phase = 'countdown';
  }

  private update(dt: number): void {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }

    switch (this.phase) {
      case 'modeSelect':
        break;
      case 'countdown':
        this.updateCountdown(dt);
        break;
      case 'running':
        this.updateRunning(dt);
        break;
      case 'celebrating':
        this.updateCelebration(dt);
        break;
      case 'levelRetry':
        this.updateLevelRetry(dt);
        break;
      case 'setComplete':
        break;
    }
  }

  private updateCountdown(dt: number): void {
    this.countdownTimer -= dt;
    if (this.countdownTimer <= 0) {
      this.countdownStageIndex++;
      if (this.countdownStageIndex >= COUNTDOWN_STAGES.length) {
        this.phase = 'running';
      } else {
        this.countdownTimer = COUNTDOWN_STAGE_DURATION;
      }
    }
  }

  private updateRunning(dt: number): void {
    this.player.update(dt, this.input, this.groundY());

    // Hold any earned celebration until the player is grounded, so we
    // never freeze them mid-jump.
    if (this.pendingCelebration) {
      if (this.player.state !== 'jumping') {
        const pending = this.pendingCelebration;
        this.pendingCelebration = null;
        this.startCelebration(pending.message, pending.leadsToSetComplete);
      }
      return;
    }

    if (this.mode === 'score') {
      this.updateScoreMode(dt);
    } else {
      this.updateRetryMode(dt);
    }
  }

  private currentScoreModeConfig(): LevelConfig {
    const scrollSpeed = Math.min(
      SCORE_MODE_MAX_SPEED,
      SCORE_MODE_BASE_SPEED + this.scoreModeElapsed * SCORE_MODE_SPEED_RAMP_PER_SEC,
    );
    return {
      level: 0, // unused — score mode has no level HUD
      scrollSpeed,
      minGapPx: SCORE_MODE_MIN_GAP,
      maxGapPx: SCORE_MODE_MAX_GAP,
      obstacleTypes: ['jump', 'duck'],
      obstaclesToClear: 0, // unused — score mode never consults LevelManager
    };
  }

  private updateScoreMode(dt: number): void {
    this.scoreModeElapsed += dt;
    const config = this.currentScoreModeConfig();
    const result = this.spawner.update(dt, config, this.groundY(), this.canvas.width, this.player);

    if (result.collidedCount > 0) {
      this.hitFlashTimer = HIT_FLASH_DURATION;
      this.score = Math.max(0, this.score - result.collidedCount * SCORE_PENALTY_PER_COLLISION);
    }
    this.score += result.clearedCount * SCORE_PER_CLEAR;

    if (this.score >= WINNING_SCORE) {
      this.pendingCelebration = {
        message: `You reached the winning score of ${WINNING_SCORE}!`,
        leadsToSetComplete: true,
      };
    }
  }

  private updateRetryMode(dt: number): void {
    const config = this.levelManager.config;
    const result = this.spawner.update(dt, config, this.groundY(), this.canvas.width, this.player);

    if (result.collidedCount > 0) {
      this.hitFlashTimer = HIT_FLASH_DURATION;
      this.startRetryTransition();
      return;
    }

    const event = this.levelManager.registerCleared(result.clearedCount);
    if (event?.type === 'levelComplete') {
      this.pendingCelebration = { message: `Level ${event.completedLevel} complete!`, leadsToSetComplete: false };
    } else if (event?.type === 'setComplete') {
      this.pendingCelebration = { message: 'All levels complete!', leadsToSetComplete: true };
    }
  }

  private updateCelebration(dt: number): void {
    this.celebrationTimer -= dt;
    if (this.celebrationTimer > 0) return;

    if (this.celebrationLeadsToSetComplete) {
      this.phase = 'setComplete';
      return;
    }

    this.spawner.setNextGap(this.levelManager.config.minGapPx);
    this.beginCountdown();
  }

  private updateLevelRetry(dt: number): void {
    this.retryTimer -= dt;
    if (this.retryTimer > 0) return;

    this.levelManager.resetCurrentLevelProgress();
    this.spawner.reset(this.levelManager.config.minGapPx);
    this.beginCountdown();
  }

  private startCelebration(message: string, leadsToSetComplete: boolean): void {
    this.phase = 'celebrating';
    this.celebrationMessage = message;
    this.celebrationTimer = CELEBRATION_DURATION;
    this.celebrationLeadsToSetComplete = leadsToSetComplete;
    if (leadsToSetComplete) {
      this.finalMessage = message;
    }
  }

  private startRetryTransition(): void {
    this.phase = 'levelRetry';
    this.retryTimer = RETRY_MESSAGE_DURATION;
  }

  private render(alpha: number): void {
    this.canvas.clear();
    const ctx = this.canvas.ctx;

    if (this.phase === 'modeSelect') {
      this.renderModeSelect(ctx);
      return;
    }

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
    ctx.fillStyle = this.hitFlashTimer > 0 ? '#f38ba8' : STATE_COLORS[this.player.state];
    ctx.fillRect(this.player.x, playerY, this.player.width, this.player.height);

    this.renderHud(ctx);
  }

  private renderModeSelect(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5f5f5';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('Choose a game mode', this.canvas.width / 2, this.canvas.height / 2 - 50);

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#89b4fa';
    ctx.fillText(
      `[1]  Score mode — reach ${WINNING_SCORE} points to win (clear +${SCORE_PER_CLEAR}, hit -${SCORE_PENALTY_PER_COLLISION})`,
      this.canvas.width / 2,
      this.canvas.height / 2,
    );
    ctx.fillStyle = '#f38ba8';
    ctx.fillText(
      '[2]  Game Over mode — clear all obstacles per level; a collision means redoing the level',
      this.canvas.width / 2,
      this.canvas.height / 2 + 32,
    );
  }

  private renderHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#f5f5f5';
    ctx.font = '16px sans-serif';

    if (this.mode === 'retry' && !this.levelManager.isSetComplete) {
      ctx.textAlign = 'left';
      const { cleared, needed } = this.levelManager.progress;
      ctx.fillText(`Level ${this.levelManager.levelNumber} — ${cleared}/${needed}`, 16, 28);
    }

    if (this.mode === 'score') {
      ctx.textAlign = 'right';
      ctx.fillText(`Score: ${this.score} / ${WINNING_SCORE}`, this.canvas.width - 16, 28);
    }

    ctx.textAlign = 'center';

    if (this.phase === 'countdown') {
      ctx.font = 'bold 36px sans-serif';
      ctx.fillStyle = '#a6e3a1';
      ctx.fillText(COUNTDOWN_STAGES[this.countdownStageIndex], this.canvas.width / 2, this.canvas.height / 2);
    } else if (this.phase === 'celebrating') {
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#a6e3a1';
      ctx.fillText(this.celebrationMessage, this.canvas.width / 2, 60);
    } else if (this.phase === 'levelRetry') {
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#f38ba8';
      ctx.fillText(`Collision! Retrying Level ${this.levelManager.levelNumber}...`, this.canvas.width / 2, 60);
    } else if (this.phase === 'setComplete') {
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#a6e3a1';
      const text = this.mode === 'score' ? `${this.finalMessage} Final score: ${this.score}` : this.finalMessage;
      ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
    }
  }
}
