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
          // Sparse, deterministic "lit window" pattern.
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

const SUIT_COLORS: Record<PlayerAvatar, { blazer: string; accent: string; fur: string }> = {
  male: { blazer: '#2c3e6b', accent: '#c0392b', fur: '#c9a06b' }, // navy blazer, red tie
  female: { blazer: '#6b2c5e', accent: '#f5d0e0', fur: '#e0c090' }, // plum blazer, blouse
};

/** A cartoon dog in corporate attire — head, ears, snout, suit torso, tail, animated legs. */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
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
  const headY = y + height * 0.17;
  const headRadius = width * 0.36;

  ctx.save();
  ctx.translate(centerX, y);
  ctx.rotate(STATE_TILT[state]);
  ctx.translate(-centerX, -y);

  // Tail
  ctx.strokeStyle = palette.fur;
  ctx.lineWidth = Math.max(3, width * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + width * 0.05, y + height * 0.5);
  ctx.quadraticCurveTo(x - width * 0.25, y + height * 0.3, x - width * 0.1, y + height * 0.05);
  ctx.stroke();

  // Torso (suit)
  roundRectPath(ctx, x, y + height * 0.32, width, height * 0.55, 5);
  ctx.fillStyle = blazer;
  ctx.fill();

  // Tie / blouse accent stripe
  ctx.fillStyle = palette.accent;
  ctx.fillRect(centerX - width * 0.06, y + height * 0.34, width * 0.12, height * 0.4);

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
    const swing = Math.sin(worldDistance * 0.02) * width * 0.22;
    ctx.moveTo(centerX - width * 0.08, legTop);
    ctx.lineTo(centerX - width * 0.08 + swing, legTop + legLength);
    ctx.moveTo(centerX + width * 0.08, legTop);
    ctx.lineTo(centerX + width * 0.08 - swing, legTop + legLength);
  }
  ctx.stroke();

  // Head (fur)
  ctx.fillStyle = palette.fur;
  ctx.beginPath();
  ctx.arc(centerX, headY, headRadius, 0, Math.PI * 2);
  ctx.fill();

  // Ears (floppy triangles)
  ctx.beginPath();
  ctx.moveTo(centerX - headRadius * 0.7, headY - headRadius * 0.3);
  ctx.lineTo(centerX - headRadius * 1.3, headY + headRadius * 0.6);
  ctx.lineTo(centerX - headRadius * 0.3, headY + headRadius * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(centerX + headRadius * 0.7, headY - headRadius * 0.3);
  ctx.lineTo(centerX + headRadius * 1.3, headY + headRadius * 0.6);
  ctx.lineTo(centerX + headRadius * 0.3, headY + headRadius * 0.2);
  ctx.closePath();
  ctx.fill();

  // Snout
  ctx.beginPath();
  ctx.ellipse(centerX, headY + headRadius * 0.45, headRadius * 0.45, headRadius * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(centerX, headY + headRadius * 0.4, headRadius * 0.12, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.beginPath();
  ctx.arc(centerX - headRadius * 0.35, headY - headRadius * 0.1, headRadius * 0.1, 0, Math.PI * 2);
  ctx.arc(centerX + headRadius * 0.35, headY - headRadius * 0.1, headRadius * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
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

  // Entrance door
  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(x + OFFICE_WIDTH / 2 - 14, groundY - 34, 28, 34);

  // Rooftop sign
  ctx.fillStyle = '#a6e3a1';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OFFICE', x + OFFICE_WIDTH / 2, top - 10);
}
