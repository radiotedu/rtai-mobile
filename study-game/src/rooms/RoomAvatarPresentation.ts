import type { ImageRoomId } from './ImageRoomDefinition'

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/**
 * Matches the avatar to the perspective and furniture scale authored into each
 * room image. Indoor and outdoor artwork intentionally use different scales.
 */
export function roomAvatarScale(
  roomId: ImageRoomId,
  yPercent: number,
  seated: boolean,
  seatId: string | null = null,
): number {
  const y = clamp(yPercent, 0, 100)
  if (roomId === 'chim-alan') {
    return 0.74 + clamp((y - 25) / 65, 0, 1) * 0.06
  }
  if (roomId === 'auditorium') {
    return 0.74 + clamp((y - 30) / 60, 0, 1) * 0.28
  }
  if (roomId === 'learning-lab') {
    const depthScale = 1.48 + clamp((y - 35) / 50, 0, 1) * 0.4
    if (seated && seatId === 'activity-table-seat') return depthScale * 0.88
    return seated ? depthScale * 0.96 : depthScale
  }
  return seated ? 1 : 1.08
}
