import './style.css';
import { GameCanvas } from './core/Canvas';

const container = document.querySelector<HTMLDivElement>('#game-container');
if (!container) {
  throw new Error('#game-container element not found in index.html');
}

const canvas = new GameCanvas(container);

// Temporary placeholder render to confirm the pipeline works end to end.
// Replaced by the game loop in Milestone 2.
canvas.clear();
canvas.ctx.fillStyle = '#1e1e2e';
canvas.ctx.fillRect(0, 0, canvas.width, canvas.height);
canvas.ctx.fillStyle = '#f5f5f5';
canvas.ctx.font = '24px sans-serif';
canvas.ctx.textAlign = 'center';
canvas.ctx.fillText(
  'Webcam Runner — canvas mounted',
  canvas.width / 2,
  canvas.height / 2,
);
