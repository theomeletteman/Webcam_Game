import type { PlayerAvatar } from '../entities/Player';

export type SpriteKey =
  | 'male_run1'
  | 'male_run2'
  | 'male_duck'
  | 'male_front'
  | 'female_run1'
  | 'female_run2'
  | 'female_duck'
  | 'female_front'
  | 'briefcase'
  | 'folders'
  | 'mug'
  | 'lamp';

const SPRITE_KEYS: SpriteKey[] = [
  'male_run1',
  'male_run2',
  'male_duck',
  'male_front',
  'female_run1',
  'female_run2',
  'female_duck',
  'female_front',
  'briefcase',
  'folders',
  'mug',
  'lamp',
];

const images = new Map<SpriteKey, HTMLImageElement>();

/** Preloads every sprite. Resolves once all images have finished loading (or failed). */
export function loadSprites(): Promise<void> {
  const loaders = SPRITE_KEYS.map(
    (key) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // don't block startup on one bad asset
        img.src = `/sprites/${key}.png`;
        images.set(key, img);
      }),
  );
  return Promise.all(loaders).then(() => undefined);
}

export function getSprite(key: SpriteKey): HTMLImageElement | undefined {
  return images.get(key);
}

// NOTE: no dedicated mid-air "jumping" pose exists yet — this temporarily
// reuses a running frame for the jumping state. Once dedicated jump-pose
// images (e.g. male_jump.png / female_jump.png) are added, add their keys
// above and swap this mapping to point at them instead.
export function getPlayerSprite(avatar: PlayerAvatar, state: 'running' | 'jumping' | 'ducking', frame: 0 | 1): HTMLImageElement | undefined {
  if (state === 'ducking') return getSprite(`${avatar}_duck`);
  if (state === 'jumping') return getSprite(`${avatar}_run2`); // TEMP placeholder
  return getSprite(frame === 0 ? `${avatar}_run1` : `${avatar}_run2`);
}
