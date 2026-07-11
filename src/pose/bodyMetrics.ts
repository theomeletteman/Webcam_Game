import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

// MediaPipe Pose landmark indices — see
// https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

const MIN_VISIBILITY = 0.5;

/**
 * Averages shoulder + hip Y (normalized 0-1, image space, larger = lower)
 * into a single torso-center signal. Averaging four points rather than
 * relying on hips alone makes this more robust to momentary occlusion
 * (e.g. hips partially out of frame while ducking).
 *
 * Returns null if any of the four landmarks isn't confidently visible —
 * callers should simply skip the frame rather than act on noisy data.
 */
export function computeBodyCenterY(landmarks: NormalizedLandmark[]): number | null {
  const points = [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP].map((i) => landmarks[i]);

  for (const point of points) {
    if (!point || point.visibility < MIN_VISIBILITY) {
      return null;
    }
  }

  const sum = points.reduce((acc, point) => acc + point.y, 0);
  return sum / points.length;
}
