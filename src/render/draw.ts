import type { PlayerState, PlayerAvatar } from '../entities/Player';
import type { ObstacleType } from '../entities/Obstacle';

const SKY_TOP = '#1a1a2e';
const SKY_BOTTOM = '#2d2d4a';
const SKYLINE_FAR = '#232349';
const SKYLINE_NEAR = '#2f2f5a';
const GROUND_COLOR = '#3a3a4a';
const GROUND_DASH = '#53536a';
const WINDOW_LIT = '#f9e2af';

export function drawSky(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, SKY_TOP);
  gradient.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

// Deterministic building-height pattern (not random per frame) so the
// skyline tiles seamlessly as it scrolls, rather than flickering.
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
): void {
  const scrollX = worldDistance * speedFactor;
  const startIndex = Math.floor(scrollX / buildingWidth) - 1;
  const endIndex = Math.floor((scrollX + width) / buildingWidth) + 1;

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
}

/** Two parallax skyline layers — far (darker, slower) and near (lighter, faster, with windows). */
export function drawSkyline(ctx: CanvasRenderingContext2D, width: number, groundY: number, worldDistance: number): void {
  drawSkylineLayer(ctx, width, groundY, SKYLINE_FAR, 70, 130, 0.12, worldDistance, false);
  drawSkylineLayer(ctx, width, groundY, SKYLINE_NEAR, 54, 90, 0.28, worldDistance, true);
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

const STATE_TILT: Record<PlayerState, number> = { running: 0, jumping: -0.08, ducking: 0 };

interface AvatarPalette {
  blazer: string;
  accent: string; // tie / blouse trim
  fur: string;
  accessory: string; // bow / tuft color
}

const SUIT_COLORS: Record<PlayerAvatar, AvatarPalette> = {
  male: { blazer: '#2c3e6b', accent: '#c0392b', fur: '#c9a06b', accessory: '#3a3a3a' },
  female: { blazer: '#8e3b73', accent: '#f7c6de', fur: '#e0c090', accessory: '#e94f8a' },
};

/** A cute cartoon dog in corporate attire, with a walking bounce and gender-distinct details. */
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
  const blazer = flashColor ?? palette.blazer;
  const centerX = x + width / 2;

  const stridePhase = worldDistance * 0.02;
  const bounce = state === 'running' ? Math.abs(Math.sin(stridePhase)) * height * 0.07 : 0;
  const y = yIn - bounce;

  const headY = y + height * 0.17;
  const headRadius = width * 0.36;

  ctx.save();
  ctx.translate(centerX, y);
  ctx.rotate(STATE_TILT[state]);
  ctx.translate(-centerX, -y);

  // Tail — wags side to side while running, tucked while ducking, up while jumping.
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

  // Torso (suit) — female gets a flared peplum hem, male a straight blazer.
  ctx.fillStyle = blazer;
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
    ctx.fill();
  } else {
    roundRectPath(ctx, x, y + height * 0.32, width, height * 0.55, 5);
    ctx.fill();
  }

  // Shirt collar peeking above the blazer
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath();
  ctx.moveTo(centerX - width * 0.14, y + height * 0.34);
  ctx.lineTo(centerX, y + height * 0.44);
  ctx.lineTo(centerX + width * 0.14, y + height * 0.34);
  ctx.closePath();
  ctx.fill();

  // Tie (male) / bow-front blouse accent (female)
  ctx.fillStyle = palette.accent;
  if (avatar === 'male') {
    ctx.beginPath();
    ctx.moveTo(centerX - width * 0.05, y + height * 0.4);
    ctx.lineTo(centerX + width * 0.05, y + height * 0.4);
    ctx.lineTo(centerX + width * 0.08, y + height * 0.78);
    ctx.lineTo(centerX, y + height * 0.85);
    ctx.lineTo(centerX - width * 0.08, y + height * 0.78);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(centerX - width * 0.06, y + height * 0.42, width * 0.06, 0, Math.PI * 2);
    ctx.arc(centerX + width * 0.06, y + height * 0.42, width * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  // Legs
  ctx.strokeStyle = blazer;
  ctx.lineWidth = Math.max(3, width * 0.12);
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

  // Head (fur) — slight bob, offset from the body bounce for a livelier feel
  const headBob = state === 'running' ? Math.sin(stridePhase * 2) * height * 0.015 : 0;
  const hY = headY + headBob;

  ctx.fillStyle = palette.fur;
  ctx.beginPath();
  ctx.arc(centerX, hY, headRadius, 0, Math.PI * 2);
  ctx.fill();

  // Ears — floppy, with a small animated swing while running
  const earSwing = state === 'running' ? Math.sin(stridePhase * 1.5) * 0.12 : 0;
  ctx.fillStyle = palette.fur;
  ctx.beginPath();
  ctx.moveTo(centerX - headRadius * 0.7, hY - headRadius * (0.3 - earSwing));
  ctx.lineTo(centerX - headRadius * 1.3, hY + headRadius * (0.6 + earSwing));
  ctx.lineTo(centerX - headRadius * 0.3, hY + headRadius * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(centerX + headRadius * 0.7, hY - headRadius * (0.3 + earSwing));
  ctx.lineTo(centerX + headRadius * 1.3, hY + headRadius * (0.6 - earSwing));
  ctx.lineTo(centerX + headRadius * 0.3, hY + headRadius * 0.2);
  ctx.closePath();
  ctx.fill();

  // Gender accessory: spiky tuft (male) or head bow (female)
  ctx.fillStyle = palette.accessory;
  if (avatar === 'male') {
    ctx.beginPath();
    ctx.moveTo(centerX - headRadius * 0.2, hY - headRadius * 0.95);
    ctx.lineTo(centerX, hY - headRadius * 1.35);
    ctx.lineTo(centerX + headRadius * 0.2, hY - headRadius * 0.95);
    ctx.closePath();
    ctx.fill();
  } else {
    const bowY = hY - headRadius * 1.05;
    ctx.beginPath();
    ctx.moveTo(centerX, bowY);
    ctx.lineTo(centerX - headRadius * 0.4, bowY - headRadius * 0.25);
    ctx.lineTo(centerX - headRadius * 0.4, bowY + headRadius * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(centerX, bowY);
    ctx.lineTo(centerX + headRadius * 0.4, bowY - headRadius * 0.25);
    ctx.lineTo(centerX + headRadius * 0.4, bowY + headRadius * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX, bowY, headRadius * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }

  // Blush cheeks
  ctx.fillStyle = 'rgba(240, 130, 150, 0.55)';
  ctx.beginPath();
  ctx.ellipse(centerX - headRadius * 0.55, hY + headRadius * 0.25, headRadius * 0.18, headRadius * 0.1, 0, 0, Math.PI * 2);
  ctx.ellipse(centerX + headRadius * 0.55, hY + headRadius * 0.25, headRadius * 0.18, headRadius * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = palette.fur;
  ctx.beginPath();
  ctx.ellipse(centerX, hY + headRadius * 0.45, headRadius * 0.45, headRadius * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tongue (only while running — a happy little pant)
  if (state === 'running') {
    ctx.fillStyle = '#e88ba0';
    ctx.beginPath();
    ctx.ellipse(centerX + headRadius * 0.05, hY + headRadius * 0.75, headRadius * 0.12, headRadius * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nose
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(centerX, hY + headRadius * 0.4, headRadius * 0.12, 0, Math.PI * 2);
  ctx.fill();

  // Eyes — bigger, with a sparkle highlight, and eyelashes on the female
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
  if (type === 'jump') {
    // Briefcase body
    ctx.fillStyle = '#8b5e34';
    roundRectPath(ctx, x, y + height * 0.25, width, height * 0.75, 4);
    ctx.fill();

    // Darker base strip
    ctx.fillStyle = '#6e4726';
    ctx.fillRect(x, y + height * 0.85, width, height * 0.15);

    // Handle
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.3, y + height * 0.25);
    ctx.lineTo(x + width * 0.3, y);
    ctx.lineTo(x + width * 0.7, y);
    ctx.lineTo(x + width * 0.7, y + height * 0.25);
    ctx.stroke();

    // Latches
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x + width * 0.2, y + height * 0.45, width * 0.1, height * 0.12);
    ctx.fillRect(x + width * 0.7, y + height * 0.45, width * 0.1, height * 0.12);
  } else {
    // Hanging pendant lamp — cord from the ceiling down to a lit shade
    ctx.strokeStyle = '#53536a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + width / 2, 0);
    ctx.lineTo(x + width / 2, y);
    ctx.stroke();

    // Lampshade (trapezoid)
    ctx.fillStyle = '#cba6f7';
    ctx.beginPath();
    ctx.moveTo(x + width * 0.3, y);
    ctx.lineTo(x + width * 0.7, y);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();

    // Glowing bulb peeking below the shade
    ctx.fillStyle = WINDOW_LIT;
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height + 4, width * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Simple warning-triangle icon, used on the Game Over mode-select card. */
export function drawWarningIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillStyle = '#f38ba8';
  ctx.beginPath();
  ctx.moveTo(x, y - size / 2);
  ctx.lineTo(x + size / 2, y + size / 2);
  ctx.lineTo(x - size / 2, y + size / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(x - size * 0.06, y - size * 0.15, size * 0.12, size * 0.3);
  ctx.beginPath();
  ctx.arc(x, y + size * 0.28, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

/** Simple trophy icon, used on the Score mode-select card. */
export function drawTrophyIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillStyle = '#f9e2af';
  roundRectPath(ctx, x - size * 0.3, y - size * 0.4, size * 0.6, size * 0.5, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - size * 0.3, y - size * 0.25, size * 0.15, Math.PI * 0.3, Math.PI * 1.2);
  ctx.arc(x + size * 0.3, y - size * 0.25, size * 0.15, Math.PI * 1.8, Math.PI * 0.7);
  ctx.stroke();
  ctx.fillRect(x - size * 0.08, y + size * 0.1, size * 0.16, size * 0.18);
  ctx.fillRect(x - size * 0.2, y + size * 0.28, size * 0.4, size * 0.08);
}

const OFFICE_WIDTH = 100;
const OFFICE_HEIGHT = 260;

export { OFFICE_WIDTH, OFFICE_HEIGHT };

/** The distinctive "finish line" office tower each level ends at — brighter and taller than the background skyline. */
export function drawOfficeBuilding(ctx: CanvasRenderingContext2D, x: number, groundY: number): void {
  const top = groundY - OFFICE_HEIGHT;

  ctx.fillStyle = '#3d3d6b';
  ctx.fillRect(x, top, OFFICE_WIDTH, OFFICE_HEIGHT);

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
