import './style.css';
import { Game } from './core/Game';

const container = document.querySelector<HTMLDivElement>('#game-container');
if (!container) {
  throw new Error('#game-container element not found in index.html');
}

const game = new Game(container);
game.start();

// Runs in the background: requests webcam + loads the pose model, falling
// back to keyboard controls automatically on any failure.
void game.initPoseInput();
