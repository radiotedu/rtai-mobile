import type { ImageRoomDefinition, ImageRoomSeat } from './ImageRoomDefinition'
import { calibratedLibrarySeat } from './LibrarySeatCalibration'

export type SeatPoint = Readonly<{ x: number; y: number; z: number }>

export type ResolvedSeatGeometry = Readonly<{
  hitArea: readonly Readonly<{ x: number; y: number }>[]
  approach: SeatPoint
  actorAnchor: SeatPoint
}>

type SeatOverride = Readonly<{
  approach?: SeatPoint
  actorAnchor?: SeatPoint
  hitArea?: readonly Readonly<{ x: number; y: number }>[]
}>

const CURATED_OVERRIDES: Readonly<Record<string, SeatOverride>> = Object.freeze({
  'library:lamp-desk': { approach: { x: 30.86, y: 43.78, z: 0 }, actorAnchor: { x: 33.5, y: 40.49, z: 0 } },
  'library:upper-back-left': { approach: { x: 50, y: 28.48, z: 0 }, actorAnchor: { x: 47.8, y: 29.65, z: 0 } },
  'library:upper-back-mid': { approach: { x: 54.31, y: 36.13, z: 0 } },
  'library:upper-back-right': { approach: { x: 62.92, y: 36.98, z: 0 } },
  'library:middle-back-mid-right': { approach: { x: 44.74, y: 46.33, z: 0 } },
  'library:middle-back-right': { approach: { x: 49.04, y: 47.18, z: 0 } },
  'library:middle-front-left-edge': { approach: { x: 20.33, y: 47.18, z: 0 } },
  'library:middle-front-right': { approach: { x: 41.39, y: 55.69, z: 0 } },
  'library:left-lower-back-left': { approach: { x: 9.81, y: 44.63, z: 0 } },
  'library:left-edge-back': { approach: { x: 9.33, y: 46.33, z: 0 } },
  'library:right-mid-front-left': { approach: { x: 59.57, y: 68.44, z: 0 } },
  // The visual seat anchors are inside the centre seating block. Approach from
  // the collision-safe right aisle, then use the short seated alignment tween.
  'auditorium:auditorium-lower': {
    approach: { x: 69.5, y: 84.5, z: 0 }, actorAnchor: { x: 73.2, y: 84.5, z: 0 },
    hitArea: rectangle({ x: 73.2, y: 82 }, 6.2, 5.2),
  },
  'auditorium:auditorium-middle': {
    approach: { x: 68.5, y: 67.5, z: 0 }, actorAnchor: { x: 72, y: 67.5, z: 0 },
    hitArea: rectangle({ x: 72, y: 65.5 }, 6.2, 5.2),
  },
  'auditorium:auditorium-upper': {
    approach: { x: 66, y: 50.5, z: 0 }, actorAnchor: { x: 69.5, y: 50.5, z: 0 },
    hitArea: rectangle({ x: 69.5, y: 48.5 }, 6.2, 5.2),
  },
  'learning-lab:window-chair': {
    approach: { x: 21, y: 56, z: 0 }, actorAnchor: { x: 17, y: 51, z: 0 },
    hitArea: rectangle({ x: 17, y: 51 }, 5.2, 7),
  },
  'learning-lab:blue-floor-cushion': {
    approach: { x: 40, y: 59, z: 0 }, actorAnchor: { x: 40, y: 54, z: 0 },
    hitArea: rectangle({ x: 40, y: 53 }, 6.2, 5.6),
  },
  'learning-lab:gray-floor-cushion': {
    approach: { x: 52, y: 60, z: 0 }, actorAnchor: { x: 52, y: 55, z: 0 },
    hitArea: rectangle({ x: 52, y: 54 }, 6.2, 5.6),
  },
  'learning-lab:right-floor-cushion': {
    approach: { x: 82, y: 59, z: 0 }, actorAnchor: { x: 82, y: 54, z: 0 },
    hitArea: rectangle({ x: 82, y: 53 }, 7, 5.6),
  },
  'learning-lab:activity-table-seat': {
    approach: { x: 60, y: 47, z: 0 }, actorAnchor: { x: 53, y: 38.5, z: 0 },
    hitArea: rectangle({ x: 53, y: 37.5 }, 5.2, 6.5),
  },
})

function rectangle(center: Readonly<{ x: number; y: number }>, halfWidth: number, halfHeight: number) {
  return [
    { x: center.x - halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y + halfHeight },
    { x: center.x - halfWidth, y: center.y + halfHeight },
  ] as const
}

export function resolveSeatGeometry(room: ImageRoomDefinition, seat: ImageRoomSeat): ResolvedSeatGeometry {
  const calibrated = room.id === 'library' ? calibratedLibrarySeat(seat.id) : null
  if (calibrated) return calibrated
  const override = CURATED_OVERRIDES[`${room.id}:${seat.id}`]
  const approachNode = room.nodes.find((node) => node.id === seat.approachNodeId)
  const approach = seat.approach ?? override?.approach ?? approachNode ?? seat.sit
  const assetBottom = seat.foregroundAsset
    ? ((seat.foregroundAsset.y + seat.foregroundAsset.height - 2) / room.image.height) * 100
    : seat.sit.y + (seat.facing === 'n' || seat.facing === 's' ? 2.2 : 1.4)
  const actorAnchor = seat.actorAnchor ?? override?.actorAnchor ?? {
    x: seat.sit.x,
    y: Math.max(seat.sit.y, assetBottom),
    z: seat.sit.z,
  }
  const hitArea = override?.hitArea?.length
    ? override.hitArea
    : seat.hitArea?.length
    ? seat.hitArea
    : seat.foregroundMask?.length
    ? seat.foregroundMask
    : seat.foregroundAsset
      ? [
          { x: (seat.foregroundAsset.x / room.image.width) * 100, y: (seat.foregroundAsset.y / room.image.height) * 100 },
          { x: ((seat.foregroundAsset.x + seat.foregroundAsset.width) / room.image.width) * 100, y: (seat.foregroundAsset.y / room.image.height) * 100 },
          { x: ((seat.foregroundAsset.x + seat.foregroundAsset.width) / room.image.width) * 100, y: ((seat.foregroundAsset.y + seat.foregroundAsset.height) / room.image.height) * 100 },
          { x: (seat.foregroundAsset.x / room.image.width) * 100, y: ((seat.foregroundAsset.y + seat.foregroundAsset.height) / room.image.height) * 100 },
        ]
      : rectangle(actorAnchor, 3.8, 4.2)
  return Object.freeze({ approach: { ...approach }, actorAnchor: { ...actorAnchor }, hitArea })
}
