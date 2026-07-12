import { GameCanvas } from './Canvas';
import { GameLoop } from './GameLoop';
import { Player } from '../entities/Player';
import { KeyboardInput } from '../input/KeyboardInput';
import type { InputSource } from '../input/InputSource';
import { ObstacleSpawner } from './ObstacleSpawner';
import { LevelManager } from './LevelManager';
import { GROUND_MARGIN, PLAYER_X } from './constants';
import { WebcamStream } from '../pose/WebcamStream';
import { PoseDetector } from '../pose/PoseDetector';
import { PoseCalibrator } from '../pose/PoseCalibrator';
import { PoseInput } from '../pose/PoseInput';
import { computeBodyCenterY } from '../pose/bodyMetrics';
import { countRaisedHands } from '../pose/handGesture';
import { drawSky, drawHills, drawGround, drawPlayer, drawObstacle } from '../render/draw';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

const COUNTDOWN_STAGES = ['Ready', 'Set', 'Go!'];
const COUNTDOWN_STAGE_DURATION = 0.7;
const CELEBRATION_DURATION = 1.5;
const RETRY_MESSAGE_DURATION = 1.2;
const HIT_FLASH_DURATION = 0.2;

const SCORE_PER_CLEAR = 1;
const SCORE_PENALTY_PER_COLLISION = 2;
const LEVEL_SCORE_TARGET = 10;
const HAND_GESTURE_CONFIRM_MS = 350; // Score mode: net points needed to clear each level

type GameMode = 'score' | 'retry';
type Phase = 'loadingPose' | 'calibrating' | 'modeSelect' | 'countdown' | 'running' | 'celebrating' | 'levelRetry' | 'setComplete';

type PendingTransition =
  | { kind: 'celebration'; message: string; leadsToSetComplete: boolean }
  | { kind: 'retry' };

export class Game {
  private readonly canvas: GameCanvas;
  private readonly loop: GameLoop;
  private readonly player: Player;
  private readonly keyboardInput: KeyboardInput;
  private readonly spawner: ObstacleSpawner;
  private readonly levelManager: LevelManager; // shared level structure for BOTH modes

  private inputMode: 'pose' | 'keyboard' = 'keyboard';
  private poseInput: PoseInput | null = null;
  private poseDetector: PoseDetector | null = null;
  private webcamStream: WebcamStream | null = null;
  private calibrator: PoseCalibrator | null = null;
  private setupMessage = '';

  // Debounce for mode-select hand-raise gesture (mirrors the duck debounce pattern).
  private handRaiseCandidateCount: number | null = null;
  private handRaiseCandidateSinceMs: number | null = null;

  private phase: Phase = 'loadingPose';
  private mode: GameMode | null = null;

  // Score mode: levelScore resets each level (target LEVEL_SCORE_TARGET);
  // totalScore accumulates across the whole run for the final screen.
  private levelScore = 0;
  private totalScore = 0;

  private countdownStageIndex = 0;
  private countdownTimer = COUNTDOWN_STAGE_DURATION;

  private celebrationTimer = 0;
  private celebrationMessage = '';
  private celebrationLeadsToSetComplete = false;
  private finalMessage = '';

  // Held until the player is grounded, so neither a level-clear nor a
  // collision ever freezes the player suspended mid-jump.
  private pendingTransition: PendingTransition | null = null;

  private retryTimer = 0;
  private hitFlashTimer = 0;
  private worldDistance = 0; // accumulated scroll distance, drives parallax + running-leg animation

  constructor(container: HTMLElement) {
    this.canvas = new GameCanvas(container);
    this.keyboardInput = new KeyboardInput();
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

  /**
   * Kicks off webcam + pose model setup in the background. Call once after
   * construction. Falls back to keyboard input on any failure (denied
   * permission, unsupported browser, model load failure) rather than
   * blocking the game from being playable at all.
   */
  async initPoseInput(): Promise<void> {
    try {
      this.webcamStream = await WebcamStream.start();
      this.poseDetector = await PoseDetector.create();
      this.calibrator = new PoseCalibrator();
      this.poseInput = new PoseInput();

      this.phase = 'calibrating';
      this.poseDetector.start(this.webcamStream.video, (result, timestampMs) => {
        this.handlePoseFrame(result.landmarks[0], timestampMs);
      });
    } catch {
      this.setupMessage = 'Camera unavailable — using keyboard controls (Space/↑ jump, ↓/Ctrl duck).';
      this.phase = 'modeSelect';
    }
  }

  private handlePoseFrame(landmarks: NormalizedLandmark[] | undefined, timestampMs: number): void {
    if (!landmarks) return;

    if (this.phase === 'calibrating' && this.calibrator && !this.calibrator.isComplete) {
      const bodyY = computeBodyCenterY(landmarks);
      if (bodyY === null) return;

      this.calibrator.addSample(bodyY, timestampMs);
      if (this.calibrator.isComplete && this.calibrator.baseline !== null && this.poseInput) {
        this.poseInput.setBaseline(this.calibrator.baseline);
        this.inputMode = 'pose';
        this.setupMessage = 'Raise one hand for Score mode, both hands for Game Over mode';
        this.phase = 'modeSelect';
      }
      return;
    }

    if (this.inputMode === 'pose' && this.poseInput) {
      this.poseInput.updateFromLandmarks(landmarks, timestampMs);

      // Mode selection by hand-raise gesture — deliberately separate from
      // jump/duck (rather than reusing them) so the player doesn't need to
      // walk back to the laptop after calibration, and so gameplay gestures
      // stay reserved for gameplay. One hand raised = Score, both = Game
      // Over. Debounced the same way duck is, so a hand passing briefly
      // through the raised zone doesn't cause an accidental selection.
      if (this.phase === 'modeSelect') {
        this.updateModeSelectGesture(landmarks, timestampMs);
      }
    }
  }

  private updateModeSelectGesture(landmarks: NormalizedLandmark[], timestampMs: number): void {
    const raisedCount = countRaisedHands(landmarks);

    if (raisedCount !== this.handRaiseCandidateCount) {
      this.handRaiseCandidateCount = raisedCount;
      this.handRaiseCandidateSinceMs = timestampMs;
    }

    const elapsed = this.handRaiseCandidateSinceMs === null ? 0 : timestampMs - this.handRaiseCandidateSinceMs;
    if (elapsed < HAND_GESTURE_CONFIRM_MS) return;

    if (raisedCount === 1) {
      this.selectMode('score');
    } else if (raisedCount === 2) {
      this.selectMode('retry');
    }
  }

  private get activeInput(): InputSource {
    return this.inputMode === 'pose' && this.poseInput ? this.poseInput : this.keyboardInput;
  }

  private groundY(): number {
    return this.canvas.height - GROUND_MARGIN;
  }

  private readonly handleModeSelectKey = (event: KeyboardEvent): void => {
    if (this.phase !== 'modeSelect') return;

    if (event.code === 'Digit1' || event.code === 'Numpad1') {
      this.selectMode('score');
    } else if (event.code === 'Digit2' || event.code === 'Numpad2') {
      this.selectMode('retry');
    }
  };

  private selectMode(mode: GameMode): void {
    this.mode = mode;
    this.spawner.reset(this.levelManager.config.minGapPx);
    this.beginCountdown();
  }

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
      case 'loadingPose':
      case 'calibrating':
        break; // driven by handlePoseFrame, not the fixed-timestep loop
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
    this.player.update(dt, this.activeInput, this.groundY());

    // Physics keeps running (so a jump completes naturally) while we wait
    // for a safe, grounded moment to actually apply the transition.
    if (this.pendingTransition) {
      if (this.player.state !== 'jumping') {
        const pending = this.pendingTransition;
        this.pendingTransition = null;
        if (pending.kind === 'celebration') {
          this.startCelebration(pending.message, pending.leadsToSetComplete);
        } else {
          this.startRetryTransition();
        }
      }
      return; // obstacles frozen during the brief hand-off
    }

    if (this.mode === 'score') {
      this.updateScoreMode(dt);
    } else {
      this.updateRetryMode(dt);
    }
  }

  private updateScoreMode(dt: number): void {
    const config = this.levelManager.config;
    this.worldDistance += config.scrollSpeed * dt;
    const result = this.spawner.update(dt, config, this.groundY(), this.canvas.width, this.player);

    if (result.collidedCount > 0) {
      this.hitFlashTimer = HIT_FLASH_DURATION;
      const penalty = result.collidedCount * SCORE_PENALTY_PER_COLLISION;
      this.levelScore = Math.max(0, this.levelScore - penalty);
      this.totalScore = Math.max(0, this.totalScore - penalty);
    }

    const gain = result.clearedCount * SCORE_PER_CLEAR;
    this.levelScore += gain;
    this.totalScore += gain;

    if (this.levelScore >= LEVEL_SCORE_TARGET) {
      this.levelScore = 0;
      const event = this.levelManager.advanceLevel();
      if (event.type === 'levelComplete') {
        this.pendingTransition = {
          kind: 'celebration',
          message: `Level ${event.completedLevel} complete!`,
          leadsToSetComplete: false,
        };
      } else {
        this.pendingTransition = {
          kind: 'celebration',
          message: 'All levels complete!',
          leadsToSetComplete: true,
        };
      }
    }
  }

  private updateRetryMode(dt: number): void {
    const config = this.levelManager.config;
    this.worldDistance += config.scrollSpeed * dt;
    const result = this.spawner.update(dt, config, this.groundY(), this.canvas.width, this.player);

    if (result.collidedCount > 0) {
      this.hitFlashTimer = HIT_FLASH_DURATION;
      this.pendingTransition = { kind: 'retry' };
      return;
    }

    const event = this.levelManager.registerCleared(result.clearedCount);
    if (event?.type === 'levelComplete') {
      this.pendingTransition = { kind: 'celebration', message: `Level ${event.completedLevel} complete!`, leadsToSetComplete: false };
    } else if (event?.type === 'setComplete') {
      this.pendingTransition = { kind: 'celebration', message: 'All levels complete!', leadsToSetComplete: true };
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

    if (this.phase === 'loadingPose') {
      this.renderLoadingPose(ctx);
      return;
    }

    if (this.phase === 'calibrating') {
      this.renderCalibrating(ctx);
      return;
    }

    if (this.phase === 'modeSelect') {
      this.renderModeSelect(ctx);
      return;
    }

    const groundY = this.groundY();

    drawSky(ctx, this.canvas.width, this.canvas.height);
    drawHills(ctx, this.canvas.width, groundY, this.worldDistance);
    drawGround(ctx, this.canvas.width, groundY, this.worldDistance);

    for (const obstacle of this.spawner.all) {
      drawObstacle(ctx, obstacle.interpolatedX(alpha), obstacle.y, obstacle.width, obstacle.height, obstacle.type);
    }

    const playerY = this.player.interpolatedY(alpha);
    drawPlayer(
      ctx,
      this.player.x,
      playerY,
      this.player.width,
      this.player.height,
      this.player.state,
      this.worldDistance,
      this.hitFlashTimer > 0 ? '#f38ba8' : null,
    );

    this.renderHud(ctx);
  }

  private renderLoadingPose(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5f5f5';
    ctx.font = '20px sans-serif';
    ctx.fillText('Requesting camera access...', this.canvas.width / 2, this.canvas.height / 2);
  }

  private renderCalibrating(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Mirrored video preview so the player sees themselves like a mirror.
    if (this.webcamStream) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(this.webcamStream.video, -this.canvas.width, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }

    const now = performance.now();
    const calibrationPhase = this.calibrator ? this.calibrator.phase(now) : 'warmup';
    const isWarmup = calibrationPhase === 'warmup';
    const progress = this.calibrator
      ? isWarmup
        ? this.calibrator.warmupProgress(now)
        : this.calibrator.samplingProgress(now)
      : 0;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5f5f5';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(
      isWarmup ? 'Step into frame and stand naturally...' : 'Hold still — calibrating...',
      this.canvas.width / 2,
      40,
    );
    ctx.font = '16px sans-serif';
    ctx.fillText(
      isWarmup ? 'Get ready' : `Calibrating: ${Math.round(progress * 100)}%`,
      this.canvas.width / 2,
      68,
    );

    const barWidth = 240;
    const barX = this.canvas.width / 2 - barWidth / 2;
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(barX, 84, barWidth, 8);
    ctx.fillStyle = isWarmup ? '#89b4fa' : '#a6e3a1';
    ctx.fillRect(barX, 84, barWidth * progress, 8);
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
      this.inputMode === 'pose'
        ? `[Raise 1 hand]  Score mode — reach ${LEVEL_SCORE_TARGET} points to clear each level (+${SCORE_PER_CLEAR} clear, -${SCORE_PENALTY_PER_COLLISION} hit)`
        : `[1]  Score mode — reach ${LEVEL_SCORE_TARGET} points to clear each level (+${SCORE_PER_CLEAR} clear, -${SCORE_PENALTY_PER_COLLISION} hit)`,
      this.canvas.width / 2,
      this.canvas.height / 2,
    );
    ctx.fillStyle = '#f38ba8';
    ctx.fillText(
      this.inputMode === 'pose'
        ? '[Raise 2 hands]  Game Over mode — clear every obstacle; a single hit means redoing the level'
        : '[2]  Game Over mode — clear every obstacle; a single hit means redoing the level',
      this.canvas.width / 2,
      this.canvas.height / 2 + 32,
    );

    if (this.setupMessage) {
      ctx.fillStyle = '#cba6f7';
      ctx.font = '14px sans-serif';
      ctx.fillText(this.setupMessage, this.canvas.width / 2, this.canvas.height / 2 + 68);
    }
  }

  private renderHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#f5f5f5';
    ctx.font = '16px sans-serif';

    if (!this.levelManager.isSetComplete) {
      ctx.textAlign = 'left';
      if (this.mode === 'score') {
        ctx.fillText(`Level ${this.levelManager.levelNumber} — Score: ${this.levelScore}/${LEVEL_SCORE_TARGET}`, 16, 28);
        ctx.textAlign = 'right';
        ctx.fillText(`Total: ${this.totalScore}`, this.canvas.width - 16, 28);
      } else {
        const { cleared, needed } = this.levelManager.progress;
        ctx.fillText(`Level ${this.levelManager.levelNumber} — ${cleared}/${needed}`, 16, 28);
      }
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
      const text = this.mode === 'score' ? `${this.finalMessage} Final score: ${this.totalScore}` : this.finalMessage;
      ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
    }
  }
}
