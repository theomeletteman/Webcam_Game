import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;

const MIN_VISIBILITY = 0.5;
// Normalized (0-1 frame height) — how far above the shoulder the wrist
// must be to count as "raised." Avoids counting a resting/slightly-lifted
// arm as a raise.
const RAISE_MARGIN = 0.05;

function isArmRaised(shoulder: NormalizedLandmark | undefined, wrist: NormalizedLandmark | undefined): boolean {
  if (!shoulder || !wrist) return false;
  if (shoulder.visibility < MIN_VISIBILITY || wrist.visibility < MIN_VISIBILITY) return false;
  return shoulder.y - wrist.y > RAISE_MARGIN; // smaller y = higher on screen
}

/** Returns 0, 1, or 2 — how many hands are currently raised above shoulder height. */
export function countRaisedHands(landmarks: NormalizedLandmark[]): number {
  let count = 0;
  if (isArmRaised(landmarks[LEFT_SHOULDER], landmarks[LEFT_WRIST])) count++;
  if (isArmRaised(landmarks[RIGHT_SHOULDER], landmarks[RIGHT_WRIST])) count++;
  return count;
}
