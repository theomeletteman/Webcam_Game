import './style.css';
import { Game } from './core/Game';
import { loadSprites } from './render/sprites';

const container = document.querySelector<HTMLDivElement>('#game-container');
if (!container) {
  throw new Error('#game-container element not found in index.html');
}

// Sprites are small local files, so this resolves near-instantly — worth
// waiting on before the first frame renders rather than showing blank
// placeholders for a moment.
async function bootstrap(gameContainer: HTMLDivElement): Promise<void> {
  await loadSprites();

  const game = new Game(gameContainer);
  game.start();

  // Runs in the background: requests webcam + loads the pose model,
  // falling back to keyboard controls automatically on any failure.
  void game.initPoseInput();
}

void bootstrap(container);
