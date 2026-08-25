import type { ResolvedSeatGeometry } from './RoomSeatGeometry'
import librarySeatLayout from './data/library-seat-layout.json'

type PixelSeat = Readonly<{
  approach: readonly [number, number]
  anchor: readonly [number, number]
  hit: readonly [number, number, number, number]
}>

const LIBRARY_WIDTH = 1672
const LIBRARY_HEIGHT = 941

// Pixel-perfect seats accepted in the isolated chair proof. The proof drew
// 64x96 seated frames using a per-seat pivot; actorAnchor below converts that
// exact top-left placement to the bottom-centre anchor used by Phaser.
const ASSET_SEATS: Readonly<Record<string, PixelSeat>> = Object.freeze({
  'upper-back-left': { approach: [759, 240], anchor: [757, 335], hit: [742, 258, 776, 301] },
  'front-left': { approach: [798.5, 263], anchor: [796.5, 348], hit: [781, 281, 816, 314] },
  'left-edge-back': { approach: [882, 311], anchor: [880, 407], hit: [864, 329, 900, 373] },
  'middle-back-right': { approach: [923, 334], anchor: [921, 430], hit: [906, 352, 940, 396] },
  'upper-near-left': { approach: [687.5, 432], anchor: [687.5, 367], hit: [668, 306, 707, 349] },
  'far-left-partial-front': { approach: [731.5, 446], anchor: [731.5, 394], hit: [712, 332, 751, 376] },
  'left-edge-front': { approach: [780, 462], anchor: [780, 423], hit: [757, 360, 803, 405] },
  'upper-near-mid': { approach: [826.5, 477], anchor: [826.5, 450], hit: [803, 388, 850, 432] },
  'middle-front-far-right': { approach: [869, 492], anchor: [869, 476], hit: [849, 414, 889, 458] },
})

type LibrarySeatLayout = Readonly<{
  id: string
  side: 'far' | 'near'
  hit: readonly [number, number, number, number]
}>

const LIBRARY_SEAT_LAYOUT = Object.freeze(
  (librarySeatLayout as unknown as LibrarySeatLayout[]).map((seat) => Object.freeze(seat)),
)

const percent = (value: number, size: number): number => (value / size) * 100

export function libraryDeviceSocket(seatId: string): Readonly<{ side: 'far' | 'near'; x: number; y: number }> | null {
  const seat = LIBRARY_SEAT_LAYOUT.find((candidate) => candidate.id === seatId)
  if (!seat) return null
  const [x1, y1, x2, y2] = seat.hit
  const centerX = (x1 + x2) / 2
  return seat.side === 'far'
    ? Object.freeze({ side: 'far', x: centerX + 19, y: y2 + 34 })
    : Object.freeze({ side: 'near', x: centerX + 26, y: y1 + 18 })
}

export function calibratedLibrarySeat(seatId: string): ResolvedSeatGeometry | null {
  const assetSeat = ASSET_SEATS[seatId]
  if (assetSeat) {
    const [x1, y1, x2, y2] = assetSeat.hit
    return Object.freeze({
      approach: { x: percent(assetSeat.approach[0], LIBRARY_WIDTH), y: percent(assetSeat.approach[1], LIBRARY_HEIGHT), z: 0 },
      actorAnchor: { x: percent(assetSeat.anchor[0], LIBRARY_WIDTH), y: percent(assetSeat.anchor[1], LIBRARY_HEIGHT), z: 0 },
      hitArea: [
        { x: percent(x1, LIBRARY_WIDTH), y: percent(y1, LIBRARY_HEIGHT) },
        { x: percent(x2, LIBRARY_WIDTH), y: percent(y1, LIBRARY_HEIGHT) },
        { x: percent(x2, LIBRARY_WIDTH), y: percent(y2, LIBRARY_HEIGHT) },
        { x: percent(x1, LIBRARY_WIDTH), y: percent(y2, LIBRARY_HEIGHT) },
      ],
    })
  }
  const seat = LIBRARY_SEAT_LAYOUT.find((candidate) => candidate.id === seatId)
  if (!seat) return null
  const [x1, y1, x2, y2] = seat.hit
  const centerX = (x1 + x2) / 2
  // Every desk chair is the same isometric asset. Its visible component gives
  // us a stable socket: far-side bodies sit 34 px below the component and are
  // covered by the tabletop layer; near-side bodies sit 18 px below it and
  // are covered by the chair-front layer. This removes the old ID-to-random-
  // chair remapping and scales to all Library seats.
  const anchorX = seat.side === 'far' ? centerX - 2 : centerX
  const anchorY = y2 + (seat.side === 'far' ? 34 : 18)
  const approachY = seat.side === 'far' ? y1 - 18 : y2 + 24
  return Object.freeze({
    approach: { x: percent(centerX, LIBRARY_WIDTH), y: percent(approachY, LIBRARY_HEIGHT), z: 0 },
    actorAnchor: { x: percent(anchorX, LIBRARY_WIDTH), y: percent(anchorY, LIBRARY_HEIGHT), z: 0 },
    hitArea: [
      { x: percent(x1, LIBRARY_WIDTH), y: percent(y1, LIBRARY_HEIGHT) },
      { x: percent(x2, LIBRARY_WIDTH), y: percent(y1, LIBRARY_HEIGHT) },
      { x: percent(x2, LIBRARY_WIDTH), y: percent(y2, LIBRARY_HEIGHT) },
      { x: percent(x1, LIBRARY_WIDTH), y: percent(y2, LIBRARY_HEIGHT) },
    ],
  })
}
