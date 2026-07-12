import type { PlayerState } from '../entities/Player';
import type { ObstacleType } from '../entities/Obstacle';

const SKY_TOP = '#1a1a2e';
const SKY_BOTTOM = '#16213e';
const HILL_FAR = '#0f3460';
const HILL_NEAR = '#162447';
const GROUND_COLOR = '#3a3a4a';
const GROUND_DASH = '#53536a';

export function drawSky(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, SKY_TOP);
  gradient.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawHillLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  groundY: number,
  color: string,
  amplitude: number,
  wavelength: number,
  speedFactor: number,
  worldDistance: number,
  baseYOffset: number,
): void {
  const offset = worldDistance * speedFactor;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = 0; x <= width; x += 20) {
    const y = groundY - baseYOffset - Math.sin(((x + offset) / wavelength) * Math.PI * 2) * amplitude;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, groundY);
  ctx.closePath();
  ctx.fill();
}

/** Two slow-scrolling hill silhouettes at different speeds/depths for a cheap parallax effect. */
export function drawHills(ctx: CanvasRenderingContext2D, width: number, groundY: number, worldDistance: number): void {
  drawHillLayer(ctx, width, groundY, HILL_FAR, 24, 220, 0.15, worldDistance, 70);
  drawHillLayer(ctx, width, groundY, HILL_NEAR, 16, 160, 0.35, worldDistance, 40);
}

/** Ground line plus a scrolling dash pattern so the world clearly reads as moving. */
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

const STATE_COLORS: Record<PlayerState, string> = {
  running: '#89b4fa',
  jumping: '#a6e3a1',
  ducking: '#f9e2af',
};

/** Simple humanoid: rounded torso + head + animated legs that vary by state. */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  state: PlayerState,
  worldDistance: number,
  flashColor: string | null,
): void {
  const color = flashColor ?? STATE_COLORS[state];
  const centerX = x + width / 2;

  roundRectPath(ctx, x, y + height * 0.15, width, height * 0.7, 5);
  ctx.fillStyle = color;
  ctx.fill();

  const headRadius = width * 0.3;
  ctx.beginPath();
  ctx.arc(centerX, y + height * 0.15, headRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, width * 0.12);
  ctx.lineCap = 'round';
  const legTop = y + height * 0.82;
  const legLength = height * 0.28;

  ctx.beginPath();
  if (state === 'ducking') {
    ctx.moveTo(centerX - width * 0.1, legTop);
    ctx.lineTo(centerX - width * 0.1, legTop + legLength * 0.4);
    ctx.moveTo(centerX + width * 0.1, legTop);
    ctx.lineTo(centerX + width * 0.1, legTop + legLength * 0.4);
  } else if (state === 'jumping') {
    ctx.moveTo(centerX - width * 0.15, legTop);
    ctx.lineTo(centerX - width * 0.05, legTop + legLength * 0.5);
    ctx.moveTo(centerX + width * 0.15, legTop);
    ctx.lineTo(centerX + width * 0.05, legTop + legLength * 0.5);
  } else {
    const swing = Math.sin(worldDistance * 0.02) * width * 0.22;
    ctx.moveTo(centerX - width * 0.08, legTop);
    ctx.lineTo(centerX - width * 0.08 + swing, legTop + legLength);
    ctx.moveTo(centerX + width * 0.08, legTop);
    ctx.lineTo(centerX + width * 0.08 - swing, legTop + legLength);
  }
  ctx.stroke();
}

/** Jump obstacles read as jagged rocks; duck obstacles read as a hanging bar on ropes. */
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  type: ObstacleType,
): void {
  if (type === 'jump') {
    ctx.fillStyle = '#f38ba8';
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x + width * 0.15, y + height * 0.3);
    ctx.lineTo(x + width * 0.4, y);
    ctx.lineTo(x + width * 0.65, y + height * 0.35);
    ctx.lineTo(x + width * 0.85, y + height * 0.1);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = '#cba6f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.15, 0);
    ctx.lineTo(x + width * 0.15, y);
    ctx.moveTo(x + width * 0.85, 0);
    ctx.lineTo(x + width * 0.85, y);
    ctx.stroke();

    roundRectPath(ctx, x, y, width, height, 5);
    ctx.fillStyle = '#cba6f7';
    ctx.fill();
  }
}
