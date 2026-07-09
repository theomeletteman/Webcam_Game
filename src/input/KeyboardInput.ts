import type { InputSource } from './InputSource';

const JUMP_KEYS = new Set(['Space', 'ArrowUp']);
const DUCK_KEYS = new Set(['ArrowDown', 'ControlLeft', 'ControlRight']);

export class KeyboardInput implements InputSource {
  private jumpQueued = false;
  private jumpKeyHeld = false; // prevents OS key-repeat from queuing repeat jumps
  private duckHeld = false;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (JUMP_KEYS.has(event.code)) {
      if (!this.jumpKeyHeld) {
        this.jumpQueued = true;
      }
      this.jumpKeyHeld = true;
      event.preventDefault();
    } else if (DUCK_KEYS.has(event.code)) {
      this.duckHeld = true;
      event.preventDefault();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (JUMP_KEYS.has(event.code)) {
      this.jumpKeyHeld = false;
    } else if (DUCK_KEYS.has(event.code)) {
      this.duckHeld = false;
    }
  };

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  isJumpPressed(): boolean {
    if (this.jumpQueued) {
      this.jumpQueued = false;
      return true;
    }
    return false;
  }

  isDuckHeld(): boolean {
    return this.duckHeld;
  }

  /** Removes listeners — call if this input source is ever torn down. */
  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
