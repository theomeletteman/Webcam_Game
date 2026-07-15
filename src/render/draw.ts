import type { PlayerState, PlayerAvatar } from '../entities/Player';
import type { ObstacleType, JumpVariant } from '../entities/Obstacle';
import { getPlayerSprite, getSprite, getDodgeSprite, type DodgePose } from './sprites';

const SKY_TOP = '#1a1a2e';
const SKY_BOTTOM = '#2d2d4a';
const SKYLINE_FAR = '#232349';
const SKYLINE_NEAR = '#2f2f5a';
const GROUND_COLOR = '#3a3a4a';
const GROUND_DASH = '#53536a';
const WINDOW_LIT = '#f9e2af';
const OUTLINE = '#15152a';

export function drawSky(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, SKY_TOP);
  gradient.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

const HEIGHT_PATTERN = [0.35, 0.6, 0.42, 0.75, 0.5, 0.9, 0.38, 0.65, 0.48, 0.7];

function drawSkylineLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  groundY: number,
  color: string,
  buildingWidth: number,
  maxHeight: number,
  speedFactor: number,
  worldDistance: number,
  windowed: boolean,
  alpha: number,
): void {
  const scrollX = worldDistance * speedFactor;
  const startIndex = Math.floor(scrollX / buildingWidth) - 1;
  const endIndex = Math.floor((scrollX + width) / buildingWidth) + 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  for (let index = startIndex; index <= endIndex; index++) {
    const buildingX = index * buildingWidth - scrollX;
    const heightRatio = HEIGHT_PATTERN[((index % HEIGHT_PATTERN.length) + HEIGHT_PATTERN.length) % HEIGHT_PATTERN.length];
    const buildingHeight = heightRatio * maxHeight;
    const buildingTop = groundY - buildingHeight;
    const w = buildingWidth - 6;

    ctx.fillStyle = color;
    ctx.fillRect(buildingX, buildingTop, w, buildingHeight);

    if (windowed) {
      ctx.fillStyle = WINDOW_LIT;
      const rows = Math.floor(buildingHeight / 18);
      const cols = Math.max(1, Math.floor(w / 14));
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if ((row * cols + col + index) % 3 === 0) {
            ctx.fillRect(buildingX + 4 + col * 14, buildingTop + 6 + row * 18, 5, 7);
          }
        }
      }
    }
  }
  ctx.restore();
}

export function drawSkyline(ctx: CanvasRenderingContext2D, width: number, groundY: number, worldDistance: number): void {
  drawSkylineLayer(ctx, width, groundY, SKYLINE_FAR, 70, 130, 0.12, worldDistance, false, 0.55);
  drawSkylineLayer(ctx, width, groundY, SKYLINE_NEAR, 54, 90, 0.28, worldDistance, true, 1);
}

export function drawGround(ctx: CanvasRenderingContext2D, width: number, groundY: number, worldDistance: number): void {
  ctx.fillStyle = GROUND_COLOR;
  ctx.fillRect(0, groundY, width, 4);

  const dashWidth = 28;
  const dashGap = 20;
  const period = dashWidth + dashGap;
  const offset = worldDistance % period;
  ctx.fillStyle = GROUND_DASH;
  for (let x = -offset; x < width; x += period) {
    ctx.fillRect(x, groundY + 8, dashWidth, 3);
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Scale factors to fit an image to a target height while preserving its natural aspect ratio. */
function fitToHeight(img: HTMLImageElement, targetHeight: number): { width: number; height: number } {
  const scale = targetHeight / img.naturalHeight;
  return { width: img.naturalWidth * scale, height: targetHeight };
}

/** Draws an image bottom-center-anchored at (anchorX, anchorBottomY), scaled to targetHeight. */
function drawSpriteBottomAnchored(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  anchorX: number,
  anchorBottomY: number,
  targetHeight: number,
): { x: number; y: number; width: number; height: number } {
  const { width, height } = fitToHeight(img, targetHeight);
  const drawX = anchorX - width / 2;
  const drawY = anchorBottomY - height;
  ctx.drawImage(img, drawX, drawY, width, height);
  return { x: drawX, y: drawY, width, height };
}

const STATE_TILT: Record<PlayerState, number> = { running: 0, jumping: -0.06, ducking: 0 };

/**
 * Real character artwork (see /public/sprites) — running has a real 2-frame
 * leg cycle (3 frames), plus dedicated jumping and ducking poses.
 */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  yIn: number,
  width: number,
  height: number,
  state: PlayerState,
  avatar: PlayerAvatar,
  worldDistance: number,
  flashColor: string | null,
): void {
  const centerX = x + width / 2;

  const stridePhase = worldDistance * 0.02;
  const bounce = state === 'running' ? Math.abs(Math.sin(stridePhase)) * height * 0.07 : 0;
  const y = yIn - bounce;
  const feetY = y + height;

  // Ground-contact shadow
  const squashAmount = state === 'ducking' ? 1.25 : state === 'jumping' ? 0.6 : 1;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(centerX, feetY + 4, width * 0.5 * squashAmount, width * 0.16 * squashAmount, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stepped (not continuous) frame alternation — matches real footfall timing better than a sine blend.
  const frame: 0 | 1 | 2 = (Math.floor(worldDistance / 32) % 3) as 0 | 1 | 2;
  const sprite = getPlayerSprite(avatar, state, frame);

  if (!sprite || !sprite.complete || sprite.naturalWidth === 0) {
    // Fallback while sprites are loading / if one failed — small placeholder so nothing crashes.
    ctx.fillStyle = avatar === 'male' ? '#3a5a9b' : '#a84f8c';
    roundRectPath(ctx, x, y, width, height, 6);
    ctx.fill();
    return;
  }

  ctx.save();
  ctx.translate(centerX, feetY);
  ctx.rotate(STATE_TILT[state]);
  const scaleX = state === 'jumping' ? 0.94 : state === 'ducking' ? 1.06 : 1;
  const scaleY = state === 'jumping' ? 1.08 : state === 'ducking' ? 0.94 : 1;
  ctx.scale(scaleX, scaleY);
  ctx.translate(-centerX, -feetY);

  const bounds = drawSpriteBottomAnchored(ctx, sprite, centerX, feetY, height);

  if (flashColor) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = flashColor;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

const JUMP_VARIANT_KEYS = ['briefcase', 'folders', 'mug'] as const;

/** Jump obstacles are real office-item photos (briefcase/folders/mug); duck obstacles are a hanging pendant lamp. */
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  type: ObstacleType,
  jumpVariant: JumpVariant,
): void {
  const centerX = x + width / 2;
  const bottomY = y + height;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(centerX, bottomY + 4, width * 0.55, height * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  const key = type === 'jump' ? JUMP_VARIANT_KEYS[jumpVariant] : 'lamp';
  const sprite = getSprite(key);

  if (!sprite || !sprite.complete || sprite.naturalWidth === 0) {
    ctx.fillStyle = type === 'jump' ? '#8b5e34' : '#cba6f7';
    roundRectPath(ctx, x, y, width, height, 4);
    ctx.fill();
    return;
  }

  drawSpriteBottomAnchored(ctx, sprite, centerX, bottomY, height);
}

export function drawWarningIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - size / 2);
  ctx.lineTo(x + size / 2, y + size / 2);
  ctx.lineTo(x - size / 2, y + size / 2);
  ctx.closePath();
  ctx.fillStyle = '#f38ba8';
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(x - size * 0.06, y - size * 0.15, size * 0.12, size * 0.3);
  ctx.beginPath();
  ctx.arc(x, y + size * 0.28, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

export function drawTrophyIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  roundRectPath(ctx, x - size * 0.3, y - size * 0.4, size * 0.6, size * 0.5, 3);
  ctx.fillStyle = '#f9e2af';
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - size * 0.3, y - size * 0.25, size * 0.15, Math.PI * 0.3, Math.PI * 1.2);
  ctx.arc(x + size * 0.3, y - size * 0.25, size * 0.15, Math.PI * 1.8, Math.PI * 0.7);
  ctx.stroke();
  ctx.fillStyle = '#f9e2af';
  ctx.fillRect(x - size * 0.08, y + size * 0.1, size * 0.16, size * 0.18);
  ctx.fillRect(x - size * 0.2, y + size * 0.28, size * 0.4, size * 0.08);
}

// Logical placement/collision box — the actual rendered image is scaled to
// fit this height preserving its own aspect ratio, so real pixel size may
// differ slightly; same looseness already accepted for obstacle sprites.
export function drawDodgeIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.strokeStyle = '#a6e3a1';
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size * 0.1, y - size * 0.35);
  ctx.lineTo(x - size * 0.4, y);
  ctx.lineTo(x - size * 0.1, y + size * 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + size * 0.1, y - size * 0.35);
  ctx.lineTo(x + size * 0.4, y);
  ctx.lineTo(x + size * 0.1, y + size * 0.35);
  ctx.stroke();
}

const OFFICE_WIDTH = 130;
const OFFICE_HEIGHT = 300;
const HOME_WIDTH = 150;
const HOME_HEIGHT = 260;

export { OFFICE_WIDTH, OFFICE_HEIGHT, HOME_WIDTH, HOME_HEIGHT };

export function drawOfficeBuilding(ctx: CanvasRenderingContext2D, x: number, groundY: number): void {
  const sprite = getSprite('office');
  const centerX = x + OFFICE_WIDTH / 2;
  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    drawSpriteBottomAnchored(ctx, sprite, centerX, groundY, OFFICE_HEIGHT);
  }
  ctx.fillStyle = '#a6e3a1';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OFFICE', centerX, groundY - OFFICE_HEIGHT - 8);
}

/** The finish line for the "Weekly Dodge" mode — the character's home. */
export function drawHomeBuilding(ctx: CanvasRenderingContext2D, x: number, groundY: number): void {
  const sprite = getSprite('home');
  const centerX = x + HOME_WIDTH / 2;
  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    drawSpriteBottomAnchored(ctx, sprite, centerX, groundY, HOME_HEIGHT);
  }
  ctx.fillStyle = '#a6e3a1';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HOME', centerX, groundY - HOME_HEIGHT - 8);
}

/**
 * Front-facing character for the "Weekly Dodge" mode — the character faces
 * the camera (the player "is" the incoming item's perspective), and leans
 * left/right or ducks in place rather than running.
 */
export function drawDodgeCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  pose: DodgePose,
  avatar: PlayerAvatar,
  idlePhase: number,
  flashColor: string | null,
): void {
  const centerX = x + width / 2;
  const bob = pose === 'stand' ? Math.sin(idlePhase * 0.05) * height * 0.02 : 0;
  const feetY = y + height;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(centerX, feetY + 4, width * 0.45, width * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  const sprite = getDodgeSprite(avatar, pose);
  if (!sprite || !sprite.complete || sprite.naturalWidth === 0) {
    ctx.fillStyle = avatar === 'male' ? '#3a5a9b' : '#a84f8c';
    roundRectPath(ctx, x, y, width, height, 6);
    ctx.fill();
    return;
  }

  const bounds = drawSpriteBottomAnchored(ctx, sprite, centerX, feetY - bob, height);

  if (flashColor) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = flashColor;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.restore();
  }
}

/**
 * An incoming work-item "card" for the Weekly Dodge mode — grows in scale
 * as it approaches (0 = just appeared, far away; 1 = reached the player).
 */
export function drawIncomingItem(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, label: string): void {
  const scale = 0.25 + progress * 0.9;
  const w = 88 * scale;
  const h = 56 * scale;

  ctx.save();
  ctx.globalAlpha = Math.min(1, 0.3 + progress * 0.9);
  ctx.translate(x, y);
  ctx.rotate(Math.sin(progress * 6) * 0.08);

  roundRectPath(ctx, -w / 2, -h / 2, w, h, 6 * scale);
  ctx.fillStyle = '#3d3d6b';
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.stroke();

  ctx.fillStyle = '#f38ba8';
  ctx.fillRect(-w / 2, -h / 2, w, h * 0.28);

  ctx.fillStyle = '#f5f5f5';
  ctx.font = `bold ${Math.max(8, 11 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, h * 0.15);
  ctx.textBaseline = 'alphabetic';

  ctx.restore();
}

