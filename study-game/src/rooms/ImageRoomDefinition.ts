import type { Direction8 } from '../avatar/AvatarAppearance'
import type { NavigationEdge, NavigationNode } from '../pathfinding/NavigationGraph'
import { CURATED_CAMPUS_ROOMS } from './CuratedCampusRooms'
import { resolveRoomNodes } from './RoomNodeGeometry'
import generatedRooms from './data/image-rooms.generated.json'
import librarySeatLayout from './data/library-seat-layout.json'

export type ImageRoomId = 'library' | 'chim-alan' | 'sports-center' | 'auditorium' | 'learning-lab'

export type ImageRoomSeat = Readonly<{
  id: string
  label: string
  approachNodeId: string
  sit: Readonly<{ x: number; y: number; z: number }>
  hitArea?: readonly Readonly<{ x: number; y: number }>[]
  approach?: Readonly<{ x: number; y: number; z: number }>
  actorAnchor?: Readonly<{ x: number; y: number; z: number }>
  facing: Direction8
  foregroundMask: readonly Readonly<{ x: number; y: number }>[] | null
  occlusion: Readonly<{ x1: number; y1: number; x2: number; y2: number }> | null
  foregroundAsset: ImageRoomCutoutAsset | null
}>

export type ImageRoomActor = Readonly<{
  nodeId: string
  name: string
  label: string
}>

export type ImageRoomOccluder = Readonly<{
  id: string
  type: string
  points: readonly Readonly<{ x: number; y: number }>[]
  depthY: number
  asset: ImageRoomCutoutAsset
}>

export type ImageRoomCutoutAsset = Readonly<{
  url: string
  x: number
  y: number
  width: number
  height: number
}>

export type ImageRoomDefinition = Readonly<{
  id: ImageRoomId
  title: string
  spawnNodeId: string
  image: Readonly<{ url: string; width: number; height: number; sha256: string }>
  nodes: readonly NavigationNode[]
  edges: readonly NavigationEdge[]
  seats: readonly ImageRoomSeat[]
  occluders: readonly ImageRoomOccluder[]
  actors: Readonly<Partial<Record<'spark' | 'rock', ImageRoomActor>>>
}>

const rooms = (generatedRooms as unknown as { rooms: Record<ImageRoomId, ImageRoomDefinition> }).rooms

const LIBRARY_ASSET_SEATS: Readonly<Record<string, Readonly<{
  facing: Direction8
  asset: ImageRoomCutoutAsset
}>>> = Object.freeze({
  'upper-back-left': { facing: 'se', asset: { url: 'assets/study-gear/desk-01/far-01-front.png', x: 715, y: 297, width: 88, height: 50 } },
  'front-left': { facing: 'se', asset: { url: 'assets/study-gear/desk-01/far-02-front.png', x: 754.5, y: 310, width: 88, height: 50 } },
  'left-edge-back': { facing: 'se', asset: { url: 'assets/study-gear/desk-01/far-03-front.png', x: 838, y: 369, width: 88, height: 50 } },
  'middle-back-right': { facing: 'se', asset: { url: 'assets/study-gear/desk-01/far-04-front.png', x: 879, y: 392, width: 88, height: 50 } },
  'upper-near-left': { facing: 'n', asset: { url: 'assets/study-gear/desk-01/near-01-front.png', x: 660, y: 300, width: 55, height: 67 } },
  'far-left-partial-front': { facing: 'n', asset: { url: 'assets/study-gear/desk-01/near-02-front.png', x: 704, y: 326, width: 55, height: 68 } },
  'left-edge-front': { facing: 'n', asset: { url: 'assets/study-gear/desk-01/near-03-front.png', x: 749, y: 354, width: 62, height: 69 } },
  'upper-near-mid': { facing: 'n', asset: { url: 'assets/study-gear/desk-01/near-04-front.png', x: 795, y: 382, width: 63, height: 68 } },
  'middle-front-far-right': { facing: 'n', asset: { url: 'assets/study-gear/desk-01/near-05-front.png', x: 841, y: 408, width: 56, height: 68 } },
})

type LibrarySeatLayer = Readonly<{
  id: string
  side: 'far' | 'near'
  hit: readonly [number, number, number, number]
}>

const GENERATED_LIBRARY_ASSET_SEATS: Readonly<Record<string, Readonly<{
  facing: Direction8
  asset: ImageRoomCutoutAsset
}>>> = Object.freeze(Object.fromEntries(
  (librarySeatLayout as unknown as LibrarySeatLayer[]).map((seat) => {
    const [x1, y1, x2, y2] = seat.hit
    const centerX = (x1 + x2) / 2
    const asset = seat.side === 'far'
      ? { x: Math.round(centerX - 44), y: y2 - 4, width: 88, height: 50 }
      : { x: x1 - 8, y: y1 - 6, width: (x2 - x1) + 16, height: (y2 - y1) + 24 }
    return [seat.id, Object.freeze({
      facing: seat.side === 'far' ? 'se' : 'n',
      asset: Object.freeze({
        url: `assets/study-gear/desk-01/generated/${seat.id}-front.png`,
        ...asset,
      }),
    })]
  }),
))

function withResolvedNodes(room: ImageRoomDefinition): ImageRoomDefinition {
  const seats = room.id === 'library'
      ? room.seats.map((seat) => {
        const override = LIBRARY_ASSET_SEATS[seat.id] ?? GENERATED_LIBRARY_ASSET_SEATS[seat.id]
        return override
          ? Object.freeze({ ...seat, facing: override.facing, foregroundAsset: override.asset })
          : seat
      })
    : room.seats
  return Object.freeze({ ...room, nodes: resolveRoomNodes(room.id, room.nodes), seats })
}

export const IMAGE_ROOMS: Readonly<Record<ImageRoomId, ImageRoomDefinition>> = Object.freeze({
  library: withResolvedNodes(rooms.library),
  'chim-alan': withResolvedNodes(Object.freeze({ ...rooms['chim-alan'], title: 'Çim Alan' })),
  'sports-center': withResolvedNodes(CURATED_CAMPUS_ROOMS['sports-center']),
  auditorium: withResolvedNodes(CURATED_CAMPUS_ROOMS.auditorium),
  'learning-lab': withResolvedNodes(CURATED_CAMPUS_ROOMS['learning-lab']),
})

export function roomPointToPixel(
  room: ImageRoomDefinition,
  point: Readonly<{ x: number; y: number }>,
): { x: number; y: number } {
  return {
    x: (point.x / 100) * room.image.width,
    y: (point.y / 100) * room.image.height,
  }
}
