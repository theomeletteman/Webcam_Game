import type { DodgeInputSource, LeanDirection } from './InputSource';

const JUMP_KEYS = new Set(['Space', 'ArrowUp']);
const DUCK_KEYS = new Set(['ArrowDown', 'ControlLeft', 'ControlRight']);
const LEAN_LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const LEAN_RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);

export class KeyboardInput implements DodgeInputSource {
  private jumpQueued = false;
  private jumpKeyHeld = false; // prevents OS key-repeat from queuing repeat jumps
  private duckHeld = false;
  private leanLeftHeld = false;
  private leanRightHeld = false;

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
    } else if (LEAN_LEFT_KEYS.has(event.code)) {
      this.leanLeftHeld = true;
      event.preventDefault();
    } else if (LEAN_RIGHT_KEYS.has(event.code)) {
      this.leanRightHeld = true;
      event.preventDefault();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (JUMP_KEYS.has(event.code)) {
      this.jumpKeyHeld = false;
    } else if (DUCK_KEYS.has(event.code)) {
      this.duckHeld = false;
    } else if (LEAN_LEFT_KEYS.has(event.code)) {
      this.leanLeftHeld = false;
    } else if (LEAN_RIGHT_KEYS.has(event.code)) {
      this.leanRightHeld = false;
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

  /** Left/right arrow keys (or A/D) — used by the Weekly Dodge mode. */
  getLean(): LeanDirection {
    if (this.leanLeftHeld && !this.leanRightHeld) return 'left';
    if (this.leanRightHeld && !this.leanLeftHeld) return 'right';
    return 'center';
  }

  /** Removes listeners — call if this input source is ever torn down. */
  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
