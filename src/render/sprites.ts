import type { PlayerAvatar } from '../entities/Player';

export type SpriteKey =
  | 'male_run1' | 'male_run2' | 'male_run3' | 'male_jump' | 'male_duck'
  | 'female_run1' | 'female_run2' | 'female_run3' | 'female_jump' | 'female_duck'
  | 'male_front_stand' | 'male_front_dodge' | 'male_front_dodge_left' | 'male_front_duck'
  | 'female_front_stand' | 'female_front_dodge' | 'female_front_dodge_left' | 'female_front_duck'
  | 'briefcase' | 'folders' | 'mug' | 'lamp'
  | 'office' | 'home';

const SPRITE_KEYS: SpriteKey[] = [
  'male_run1', 'male_run2', 'male_run3', 'male_jump', 'male_duck',
  'female_run1', 'female_run2', 'female_run3', 'female_jump', 'female_duck',
  'male_front_stand', 'male_front_dodge', 'male_front_dodge_left', 'male_front_duck',
  'female_front_stand', 'female_front_dodge', 'female_front_dodge_left', 'female_front_duck',
  'briefcase', 'folders', 'mug', 'lamp',
  'office', 'home',
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

/** Side-view sprites for the runner game — 3-frame running cycle + dedicated jump/duck poses. */
export function getPlayerSprite(avatar: PlayerAvatar, state: 'running' | 'jumping' | 'ducking', frame: 0 | 1 | 2): HTMLImageElement | undefined {
  if (state === 'ducking') return getSprite(`${avatar}_duck`);
  if (state === 'jumping') return getSprite(`${avatar}_jump`);
  return getSprite(`${avatar}_run${frame + 1}` as SpriteKey);
}

export type DodgePose = 'stand' | 'dodgeLeft' | 'dodgeRight' | 'duck';

/** Front-facing sprites for the "Weekly Dodge" mode — character faces the camera. */
export function getDodgeSprite(avatar: PlayerAvatar, pose: DodgePose): HTMLImageElement | undefined {
  switch (pose) {
    case 'stand':
      return getSprite(`${avatar}_front_stand`);
    case 'dodgeRight':
      return getSprite(`${avatar}_front_dodge`);
    case 'dodgeLeft':
      return getSprite(`${avatar}_front_dodge_left`);
    case 'duck':
      return getSprite(`${avatar}_front_duck`);
  }
}
