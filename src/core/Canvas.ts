/**
 * Wraps the raw <canvas> element and keeps its backing resolution in sync
 * with devicePixelRatio, so drawings stay crisp on high-DPI screens.
 *
 * CSS size and backing-buffer size are handled separately on purpose:
 * CSS controls layout, the buffer controls resolution. Conflating them
 * is the most common cause of blurry canvas rendering.
 */
export class GameCanvas {
  readonly element: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  /** Logical (CSS) size — use this for all game-coordinate math. */
  width = 0;
  height = 0;

  constructor(container: HTMLElement) {
    this.element = document.createElement('canvas');
    container.appendChild(this.element);

    const ctx = this.element.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context is not available in this browser.');
    }
    this.ctx = ctx;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.element.parentElement!.getBoundingClientRect();

    this.width = rect.width;
    this.height = rect.height;

    // Backing buffer scales with DPR; CSS size stays at logical pixels.
    this.element.width = Math.round(this.width * dpr);
    this.element.height = Math.round(this.height * dpr);
    this.element.style.width = `${this.width}px`;
    this.element.style.height = `${this.height}px`;

    // Reset transform before scaling to avoid compounding on repeated resizes.
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}
