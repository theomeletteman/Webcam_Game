export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Shrinks a box inward by the given ratios — used to add forgiveness to the player's hitbox. */
export function insetBox(box: Box, insetXRatio: number, insetYRatio: number): Box {
  const insetX = box.width * insetXRatio;
  const insetY = box.height * insetYRatio;
  return {
    x: box.x + insetX,
    y: box.y + insetY,
    width: box.width - insetX * 2,
    height: box.height - insetY * 2,
  };
}
