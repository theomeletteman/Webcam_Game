export const GROUND_MARGIN = 60; // distance from bottom of canvas to the ground line
export const PLAYER_X = 80; // fixed horizontal position (world scrolls, player doesn't)

export const PLAYER_WIDTH = 40;
export const PLAYER_STANDING_HEIGHT = 60;
export const PLAYER_DUCKING_HEIGHT = 30;

// Player hitbox is shrunk inward by these ratios before collision checks —
// avoids punishing near-misses that visually look like a clean dodge.
export const PLAYER_HITBOX_INSET_X = 0.18;
export const PLAYER_HITBOX_INSET_Y = 0.12;
