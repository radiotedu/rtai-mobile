import type { ImageRoomDefinition, ImageRoomId } from './ImageRoomDefinition'

type PatrolPoint = Readonly<{ id: string; x: number; y: number; z: number }>
type PercentPatrolPoint = readonly [number, number, number?]

// Deliberately open, room-specific floor points. Cats do not reuse scripted
// actor/seat/stair anchors because those often sit against furniture edges.
const PATROLS: Readonly<Record<ImageRoomId, readonly PercentPatrolPoint[]>> = Object.freeze({
  library: [[25, 83], [38.04, 82.04], [48, 86], [72, 84]],
  'chim-alan': [[32, 72], [38, 82], [45, 72], [54, 86], [57, 78], [58, 91]],
  'sports-center': [[27, 88], [35, 82], [64, 84], [70, 72], [72, 90], [76, 82]],
  auditorium: [[33, 90], [50, 90], [67, 90], [82, 90], [67.23, 72.69], [67.23, 55.69]],
  'learning-lab': [[24, 88], [38, 90], [52, 91], [66, 89], [80, 84], [86, 77]],
})

export function roomCatPatrolPoints(room: ImageRoomDefinition): readonly PatrolPoint[] {
  return Object.freeze(PATROLS[room.id].map(([x, y, z = 0], index) => Object.freeze({
    id: `cat-patrol:${room.id}:${index}`,
    x: (x / 100) * room.image.width,
    y: (y / 100) * room.image.height,
    z,
  })))
}
