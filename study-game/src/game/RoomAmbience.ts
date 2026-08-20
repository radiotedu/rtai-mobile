import type { ImageRoomId } from '../rooms/ImageRoomDefinition'

export type AmbientGlow = Readonly<{
  x: number
  y: number
  width: number
  height: number
  color: number
  alpha: number
  durationMs: number
  delayMs?: number
}>

export type AmbientDrift = Readonly<{
  kind: 'dust' | 'leaf' | 'sheen'
  count: number
  x: number
  y: number
  width: number
  height: number
  color: number
  alpha: number
  size: number
  travelX: number
  travelY: number
  durationMs: number
}>

export type RoomAmbiencePlan = Readonly<{
  label: string
  glows: readonly AmbientGlow[]
  drifts: readonly AmbientDrift[]
}>

const glow = (
  x: number, y: number, width: number, height: number, color: number, alpha: number,
  durationMs: number, delayMs = 0,
): AmbientGlow => Object.freeze({ x, y, width, height, color, alpha, durationMs, delayMs })

const drift = (
  kind: AmbientDrift['kind'], count: number, x: number, y: number, width: number, height: number,
  color: number, alpha: number, size: number, travelX: number, travelY: number, durationMs: number,
): AmbientDrift => Object.freeze({ kind, count, x, y, width, height, color, alpha, size, travelX, travelY, durationMs })

export const MAX_ROOM_AMBIENT_OBJECTS = 12

export const ROOM_AMBIENCE: Readonly<Record<ImageRoomId, RoomAmbiencePlan>> = Object.freeze({
  library: Object.freeze({
    label: 'Warm lamps · window dust',
    glows: Object.freeze([
      glow(23.8, 54.1, 3.2, 2.4, 0xffcf72, 0.12, 2_800),
      glow(37.4, 45.0, 3.2, 2.4, 0xffcf72, 0.11, 3_100, 340),
      glow(47.9, 36.6, 3.1, 2.3, 0xffcf72, 0.11, 2_600, 760),
      glow(58.6, 25.8, 3.0, 2.2, 0xffcf72, 0.12, 3_300, 180),
      glow(66.0, 62.1, 3.3, 2.4, 0xffcf72, 0.11, 2_900, 920),
      glow(53.0, 75.3, 3.3, 2.4, 0xffcf72, 0.10, 3_200, 540),
    ]),
    drifts: Object.freeze([
      drift('dust', 4, 66, 12, 28, 42, 0xfff5d7, 0.22, 3, -2, -8, 6_800),
    ]),
  }),
  'chim-alan': Object.freeze({
    label: 'Garden breeze · path lights',
    glows: Object.freeze([
      glow(35.5, 70.5, 2.2, 3.2, 0xfff0b0, 0.11, 2_900),
      glow(44.0, 84.2, 2.0, 3.0, 0xfff0b0, 0.10, 3_200, 500),
      glow(34.0, 58.5, 2.0, 3.0, 0xfff0b0, 0.10, 2_700, 850),
      glow(70.0, 67.0, 2.0, 3.0, 0xfff0b0, 0.10, 3_400, 200),
    ]),
    drifts: Object.freeze([
      drift('leaf', 6, 7, 16, 84, 63, 0xb9d765, 0.58, 8, 5, 7, 7_600),
    ]),
  }),
  'sports-center': Object.freeze({
    label: 'Equipment displays · mirror sheen',
    glows: Object.freeze([
      glow(15.7, 27.8, 2.1, 1.2, 0x9be66f, 0.24, 2_000),
      glow(19.0, 25.8, 2.1, 1.2, 0x9be66f, 0.22, 2_300, 420),
      glow(22.2, 24.0, 2.1, 1.2, 0x9be66f, 0.22, 2_100, 780),
      glow(25.4, 22.3, 2.1, 1.2, 0x9be66f, 0.20, 2_500, 180),
    ]),
    drifts: Object.freeze([
      drift('sheen', 3, 7, 13, 84, 16, 0xc8efff, 0.13, 22, 6, -1, 5_400),
    ]),
  }),
  auditorium: Object.freeze({
    label: 'Stage wash · ceiling pulse',
    glows: Object.freeze([
      glow(50, 30, 30, 9, 0x80a9ff, 0.07, 3_200),
      glow(18, 12.5, 24, 1.7, 0x4f9dff, 0.14, 2_500, 200),
      glow(39, 8.8, 25, 1.7, 0x4f9dff, 0.13, 2_900, 680),
      glow(62, 8.8, 25, 1.7, 0x4f9dff, 0.13, 2_700, 380),
      glow(83, 12.5, 24, 1.7, 0x4f9dff, 0.14, 3_100, 900),
    ]),
    drifts: Object.freeze([
      drift('dust', 3, 37, 18, 27, 18, 0xd8ecff, 0.15, 2, 1, -5, 7_800),
    ]),
  }),
  'learning-lab': Object.freeze({
    label: 'Pendant lights · reading-window dust',
    glows: Object.freeze([
      glow(4.2, 38.0, 4.0, 3.4, 0xffd889, 0.13, 2_700),
      glow(17.4, 10.2, 4.6, 3.8, 0xffd889, 0.13, 3_000, 480),
      glow(35.5, 7.0, 5.0, 4.0, 0xffd889, 0.12, 2_800, 860),
      glow(55.4, 5.5, 4.4, 3.5, 0xffd889, 0.11, 3_300, 260),
    ]),
    drifts: Object.freeze([
      drift('dust', 5, 5, 18, 24, 45, 0xfff7df, 0.24, 3, 2, -7, 6_600),
    ]),
  }),
})

export function roomAmbientObjectCount(roomId: ImageRoomId): number {
  const plan = ROOM_AMBIENCE[roomId]
  return plan.glows.length + plan.drifts.reduce((sum, item) => sum + item.count, 0)
}
