import type { PlayerState, PlayerAvatar } from '../entities/Player';
import type { ObstacleType } from '../entities/Obstacle';

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

/** Two parallax skyline layers — far layer faded for depth, near layer crisp with lit windows. */
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

function fillWithOutline(ctx: CanvasRenderingContext2D, fillStyle: string | CanvasGradient, lineWidth: number): void {
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function verticalGradient(ctx: CanvasRenderingContext2D, x: number, yTop: number, yBottom: number, light: string, dark: string): CanvasGradient {
  const g = ctx.createLinearGradient(x, yTop, x, yBottom);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  return g;
}

interface AvatarPalette {
  blazer: string;
  blazerDark: string;
  accent: string;
  fur: string;
  furDark: string;
  accessory: string;
}

const SUIT_COLORS: Record<PlayerAvatar, AvatarPalette> = {
  male: { blazer: '#3a5a9b', blazerDark: '#20304f', accent: '#c0392b', fur: '#d4ac82', furDark: '#b3875a', accessory: '#3a3a3a' },
  female: { blazer: '#a84f8c', blazerDark: '#5f2850', accent: '#f7c6de', fur: '#eccb99', furDark: '#d4a86a', accessory: '#e94f8a' },
};

const STATE_TILT: Record<PlayerState, number> = { running: 0, jumping: -0.06, ducking: 0 };

/** A cute cartoon dog in corporate attire — outlined flat-vector style with gradients, ground shadow, and squash/stretch. */
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
  const palette = SUIT_COLORS[avatar];
  const centerX = x + width / 2;

  const stridePhase = worldDistance * 0.02;
  const bounce = state === 'running' ? Math.abs(Math.sin(stridePhase)) * height * 0.07 : 0;
  const y = yIn - bounce;
  const feetY = y + height;

  // Ground-contact shadow — grounds the character and reinforces squash/stretch.
  const squashAmount = state === 'ducking' ? 1.25 : state === 'jumping' ? 0.6 : 1;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(centerX, feetY + 4, width * 0.42 * squashAmount, width * 0.14 * squashAmount, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(centerX, y);
  ctx.rotate(STATE_TILT[state]);
  ctx.translate(-centerX, -y);

  // Squash & stretch, anchored at the feet so the character stays grounded.
  const scaleX = state === 'jumping' ? 0.92 : state === 'ducking' ? 1.1 : 1;
  const scaleY = state === 'jumping' ? 1.1 : state === 'ducking' ? 0.9 : 1;
  ctx.translate(centerX, feetY);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-centerX, -feetY);

  const outlineW = Math.max(1.5, width * 0.045);

  // Tail
  const tailWag = state === 'running' ? Math.sin(stridePhase * 1.3) * 0.35 : state === 'jumping' ? 0.5 : -0.1;
  ctx.strokeStyle = palette.fur;
  ctx.lineWidth = Math.max(3, width * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + width * 0.05, y + height * 0.5);
  ctx.quadraticCurveTo(
    x - width * (0.25 + tailWag * 0.15),
    y + height * (0.3 - tailWag * 0.1),
    x - width * 0.1,
    y + height * 0.05,
  );
  ctx.stroke();
  ctx.lineWidth = outlineW * 0.7;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // Torso — gradient shaded, flared hem for female
  const torsoGradient = verticalGradient(ctx, centerX, y + height * 0.32, y + height * 0.87, palette.blazer, palette.blazerDark);
  if (avatar === 'female') {
    const top = y + height * 0.32;
    const bottom = y + height * 0.87;
    const flare = width * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, top + 6);
    ctx.quadraticCurveTo(x, top, x + 6, top);
    ctx.lineTo(x + width - 6, top);
    ctx.quadraticCurveTo(x + width, top, x + width, top + 6);
    ctx.lineTo(x + width + flare, bottom);
    ctx.lineTo(x - flare, bottom);
    ctx.closePath();
  } else {
    roundRectPath(ctx, x, y + height * 0.32, width, height * 0.55, 5);
  }
  fillWithOutline(ctx, torsoGradient, outlineW);

  // Shirt collar
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath();
  ctx.moveTo(centerX - width * 0.14, y + height * 0.34);
  ctx.lineTo(centerX, y + height * 0.44);
  ctx.lineTo(centerX + width * 0.14, y + height * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = outlineW * 0.6;
  ctx.stroke();

  // Tie (male) / bow-front (female)
  if (avatar === 'male') {
    ctx.beginPath();
    ctx.moveTo(centerX - width * 0.05, y + height * 0.4);
    ctx.lineTo(centerX + width * 0.05, y + height * 0.4);
    ctx.lineTo(centerX + width * 0.08, y + height * 0.78);
    ctx.lineTo(centerX, y + height * 0.85);
    ctx.lineTo(centerX - width * 0.08, y + height * 0.78);
    ctx.closePath();
    fillWithOutline(ctx, palette.accent, outlineW * 0.6);
  } else {
    ctx.beginPath();
    ctx.arc(centerX - width * 0.06, y + height * 0.42, width * 0.06, 0, Math.PI * 2);
    ctx.arc(centerX + width * 0.06, y + height * 0.42, width * 0.06, 0, Math.PI * 2);
    fillWithOutline(ctx, palette.accent, outlineW * 0.5);
  }

  // Legs
  ctx.strokeStyle = palette.blazerDark;
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
    const swing = Math.sin(stridePhase) * width * 0.22;
    ctx.moveTo(centerX - width * 0.08, legTop);
    ctx.lineTo(centerX - width * 0.08 + swing, legTop + legLength);
    ctx.moveTo(centerX + width * 0.08, legTop);
    ctx.lineTo(centerX + width * 0.08 - swing, legTop + legLength);
  }
  ctx.stroke();

  // Head — gradient shaded, smooth muzzle blended via overlapping soft shapes
  const headBob = state === 'running' ? Math.sin(stridePhase * 2) * height * 0.015 : 0;
  const headY = y + height * 0.17;
  const hY = headY + headBob;
  const headRadius = width * 0.36;
  const headGradient = verticalGradient(ctx, centerX, hY - headRadius, hY + headRadius, palette.fur, palette.furDark);

  // Ears — smooth curved (bezier) floppy shape instead of sharp triangles
  const earSwing = state === 'running' ? Math.sin(stridePhase * 1.5) * 0.12 : 0;
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    const baseX = centerX + side * headRadius * 0.7;
    const baseY = hY - headRadius * (0.3 - earSwing * side);
    const tipX = centerX + side * headRadius * 1.3;
    const tipY = hY + headRadius * (0.65 + earSwing * side);
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(centerX + side * headRadius * 1.5, hY + headRadius * 0.2, tipX, tipY);
    ctx.quadraticCurveTo(centerX + side * headRadius * 0.5, hY + headRadius * 0.5, centerX + side * headRadius * 0.3, hY + headRadius * 0.15);
    ctx.closePath();
    fillWithOutline(ctx, palette.furDark, outlineW * 0.6);
  }

  // Head silhouette (circle) + snout blended as one visual mass
  ctx.beginPath();
  ctx.arc(centerX, hY, headRadius, 0, Math.PI * 2);
  fillWithOutline(ctx, headGradient, outlineW);

  // Gender accessory
  if (avatar === 'male') {
    ctx.beginPath();
    ctx.moveTo(centerX - headRadius * 0.2, hY - headRadius * 0.95);
    ctx.lineTo(centerX, hY - headRadius * 1.35);
    ctx.lineTo(centerX + headRadius * 0.2, hY - headRadius * 0.95);
    ctx.closePath();
    fillWithOutline(ctx, palette.accessory, outlineW * 0.5);
  } else {
    const bowY = hY - headRadius * 1.05;
    ctx.beginPath();
    ctx.moveTo(centerX, bowY);
    ctx.lineTo(centerX - headRadius * 0.4, bowY - headRadius * 0.25);
    ctx.lineTo(centerX - headRadius * 0.4, bowY + headRadius * 0.25);
    ctx.closePath();
    fillWithOutline(ctx, palette.accessory, outlineW * 0.4);
    ctx.beginPath();
    ctx.moveTo(centerX, bowY);
    ctx.lineTo(centerX + headRadius * 0.4, bowY - headRadius * 0.25);
    ctx.lineTo(centerX + headRadius * 0.4, bowY + headRadius * 0.25);
    ctx.closePath();
    fillWithOutline(ctx, palette.accessory, outlineW * 0.4);
    ctx.beginPath();
    ctx.arc(centerX, bowY, headRadius * 0.14, 0, Math.PI * 2);
    fillWithOutline(ctx, palette.accessory, outlineW * 0.4);
  }

  // Blush
  ctx.fillStyle = 'rgba(240, 130, 150, 0.5)';
  ctx.beginPath();
  ctx.ellipse(centerX - headRadius * 0.55, hY + headRadius * 0.25, headRadius * 0.18, headRadius * 0.1, 0, 0, Math.PI * 2);
  ctx.ellipse(centerX + headRadius * 0.55, hY + headRadius * 0.25, headRadius * 0.18, headRadius * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.beginPath();
  ctx.ellipse(centerX, hY + headRadius * 0.45, headRadius * 0.45, headRadius * 0.32, 0, 0, Math.PI * 2);
  fillWithOutline(ctx, palette.fur, outlineW * 0.6);

  if (state === 'running') {
    ctx.fillStyle = '#e88ba0';
    ctx.beginPath();
    ctx.ellipse(centerX + headRadius * 0.05, hY + headRadius * 0.75, headRadius * 0.12, headRadius * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(centerX, hY + headRadius * 0.4, headRadius * 0.12, 0, Math.PI * 2);
  ctx.fill();

  const eyeY = hY - headRadius * 0.1;
  ctx.fillStyle = '#241f1f';
  ctx.beginPath();
  ctx.arc(centerX - headRadius * 0.35, eyeY, headRadius * 0.15, 0, Math.PI * 2);
  ctx.arc(centerX + headRadius * 0.35, eyeY, headRadius * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(centerX - headRadius * 0.3, eyeY - headRadius * 0.05, headRadius * 0.05, 0, Math.PI * 2);
  ctx.arc(centerX + headRadius * 0.4, eyeY - headRadius * 0.05, headRadius * 0.05, 0, Math.PI * 2);
  ctx.fill();

  if (avatar === 'female') {
    ctx.strokeStyle = '#241f1f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX - headRadius * 0.48, eyeY - headRadius * 0.18);
    ctx.lineTo(centerX - headRadius * 0.62, eyeY - headRadius * 0.32);
    ctx.moveTo(centerX + headRadius * 0.48, eyeY - headRadius * 0.18);
    ctx.lineTo(centerX + headRadius * 0.62, eyeY - headRadius * 0.32);
    ctx.stroke();
  }

  ctx.restore();

  // Hit flash — a translucent tint drawn OVER the finished character, so
  // the avatar's real colors never change; this is purely an overlay.
  if (flashColor) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = flashColor;
    roundRectPath(ctx, x - width * 0.15, y, width * 1.3, height, 8);
    ctx.fill();
    ctx.restore();
  }
}

/** Jump obstacles are briefcases; duck obstacles are hanging pendant lamps — both fit the office theme. */
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  type: ObstacleType,
): void {
  const outlineW = Math.max(1.5, width * 0.04);

  if (type === 'jump') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height + 4, width * 0.55, height * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyGradient = verticalGradient(ctx, x, y + height * 0.25, y + height, '#a3703f', '#6e4726');
    roundRectPath(ctx, x, y + height * 0.25, width, height * 0.75, 4);
    fillWithOutline(ctx, bodyGradient, outlineW);

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + width * 0.12, y + height * 0.3, width * 0.12, height * 0.55);

    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.3, y + height * 0.25);
    ctx.lineTo(x + width * 0.3, y);
    ctx.lineTo(x + width * 0.7, y);
    ctx.lineTo(x + width * 0.7, y + height * 0.25);
    ctx.stroke();

    ctx.fillStyle = '#e6c455';
    ctx.beginPath();
    ctx.rect(x + width * 0.2, y + height * 0.45, width * 0.1, height * 0.12);
    ctx.rect(x + width * 0.7, y + height * 0.45, width * 0.1, height * 0.12);
    fillWithOutline(ctx, '#e6c455', outlineW * 0.5);
  } else {
    ctx.strokeStyle = '#53536a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + width / 2, 0);
    ctx.lineTo(x + width / 2, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + width * 0.3, y);
    ctx.lineTo(x + width * 0.7, y);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    fillWithOutline(ctx, '#cba6f7', outlineW);

    ctx.fillStyle = 'rgba(249, 226, 175, 0.35)';
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height + 6, width * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = WINDOW_LIT;
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height + 4, width * 0.14, 0, Math.PI * 2);
    fillWithOutline(ctx, WINDOW_LIT, outlineW * 0.5);
  }
}

export function drawWarningIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - size / 2);
  ctx.lineTo(x + size / 2, y + size / 2);
  ctx.lineTo(x - size / 2, y + size / 2);
  ctx.closePath();
  fillWithOutline(ctx, '#f38ba8', 2);

  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(x - size * 0.06, y - size * 0.15, size * 0.12, size * 0.3);
  ctx.beginPath();
  ctx.arc(x, y + size * 0.28, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

export function drawTrophyIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  roundRectPath(ctx, x - size * 0.3, y - size * 0.4, size * 0.6, size * 0.5, 3);
  fillWithOutline(ctx, '#f9e2af', 2);
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(x - size * 0.3, y - size * 0.25, size * 0.15, Math.PI * 0.3, Math.PI * 1.2);
  ctx.arc(x + size * 0.3, y - size * 0.25, size * 0.15, Math.PI * 1.8, Math.PI * 0.7);
  ctx.stroke();
  ctx.fillStyle = '#f9e2af';
  ctx.fillRect(x - size * 0.08, y + size * 0.1, size * 0.16, size * 0.18);
  ctx.fillRect(x - size * 0.2, y + size * 0.28, size * 0.4, size * 0.08);
}

const OFFICE_WIDTH = 100;
const OFFICE_HEIGHT = 260;

export { OFFICE_WIDTH, OFFICE_HEIGHT };

export function drawOfficeBuilding(ctx: CanvasRenderingContext2D, x: number, groundY: number): void {
  const top = groundY - OFFICE_HEIGHT;
  const bodyGradient = verticalGradient(ctx, x, top, groundY, '#4a4a82', '#2e2e56');

  ctx.fillStyle = bodyGradient;
  ctx.fillRect(x, top, OFFICE_WIDTH, OFFICE_HEIGHT);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, top, OFFICE_WIDTH, OFFICE_HEIGHT);

  ctx.fillStyle = WINDOW_LIT;
  const cols = 4;
  const rows = Math.floor(OFFICE_HEIGHT / 22);
  for (let row = 1; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillRect(x + 10 + col * 20, top + 10 + row * 22, 12, 14);
    }
  }

  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(x + OFFICE_WIDTH / 2 - 14, groundY - 34, 28, 34);

  ctx.fillStyle = '#a6e3a1';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OFFICE', x + OFFICE_WIDTH / 2, top - 10);
}
