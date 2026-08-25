import type { AvatarAction, AvatarAppearance } from './AvatarAppearance'

export function shouldUseCanonicalAvatar(_appearance: AvatarAppearance): boolean {
  // The legacy composed sprite uses a different direction order, silhouette and
  // seated scale from the wearable sheets. Rendering every outfit through the
  // same layer pipeline keeps clothing aligned when an item is equipped and
  // prevents the avatar from flipping direction at the canonical combination.
  return false
}

export function canonicalAvatarTextureKey(action: AvatarAction): string {
  return `avatar:canonical-${action}`
}

const SEATED_UPPER_BODY_CROP = Object.freeze({ x: 0, y: 0, width: 64, height: 58 })

export function avatarUpperBodyCrop(action: AvatarAction): Readonly<typeof SEATED_UPPER_BODY_CROP> | null {
  return action === 'sit' ? SEATED_UPPER_BODY_CROP : null
}
