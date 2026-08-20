import { pointInPolygon } from '../pathfinding/RoomNavigationField'

export type TouchWorldPoint = Readonly<{ x: number; y: number }>

export type TouchSeatTarget = Readonly<{
  id: string
  target: TouchWorldPoint
  hitArea: readonly TouchWorldPoint[]
  reachable: boolean
  occupied: boolean
}>

export type TouchPlayerTarget = Readonly<{
  userId: string
  x: number
  y: number
}>

export type TouchIntentResolverInput = Readonly<{
  world: TouchWorldPoint
  uiConsumed: boolean
  currentSeatId: string | null
  activeSeatIntentId: string | null
  seats: readonly TouchSeatTarget[]
  players: readonly TouchPlayerTarget[]
  walkable: boolean
  playerRadius?: number
}>

export type TouchIntent =
  | Readonly<{ kind: 'ignored'; reason: 'ui-consumed' | 'duplicate-seat' }>
  | Readonly<{ kind: 'stand' }>
  | Readonly<{ kind: 'sit'; seatId: string; target: TouchWorldPoint }>
  | Readonly<{ kind: 'walk'; target: TouchWorldPoint }>
  | Readonly<{ kind: 'interact-player'; userId: string }>
  | Readonly<{ kind: 'blocked'; reason: 'occupied-seat' | 'unreachable' | 'solid-object'; target: TouchWorldPoint }>

function distance(left: TouchWorldPoint, right: TouchWorldPoint): number {
  return Math.hypot(right.x - left.x, right.y - left.y)
}

function nearest<T extends TouchWorldPoint>(world: TouchWorldPoint, targets: readonly T[]): T | null {
  let result: T | null = null
  let resultDistance = Number.POSITIVE_INFINITY
  for (const target of targets) {
    const candidateDistance = distance(world, target)
    if (candidateDistance < resultDistance) {
      result = target
      resultDistance = candidateDistance
    }
  }
  return result
}

const pointOf = (target: TouchWorldPoint): TouchWorldPoint => ({ x: target.x, y: target.y })

export function resolveTouchIntent(input: TouchIntentResolverInput): TouchIntent {
  if (input.uiConsumed) return { kind: 'ignored', reason: 'ui-consumed' }

  const player = nearest(input.world, input.players)
  if (player && distance(input.world, player) <= (input.playerRadius ?? 44)) {
    return { kind: 'interact-player', userId: player.userId }
  }

  const seat = input.seats.find((candidate) => pointInPolygon(input.world, candidate.hitArea))
  if (seat) {
    if (seat.id === input.currentSeatId) return { kind: 'stand' }
    if (seat.id === input.activeSeatIntentId) return { kind: 'ignored', reason: 'duplicate-seat' }
    if (seat.occupied) return { kind: 'blocked', reason: 'occupied-seat', target: pointOf(seat.target) }
    if (!seat.reachable) return { kind: 'blocked', reason: 'unreachable', target: pointOf(seat.target) }
    return { kind: 'sit', seatId: seat.id, target: pointOf(seat.target) }
  }

  if (input.walkable) return { kind: 'walk', target: pointOf(input.world) }
  return { kind: 'blocked', reason: 'solid-object', target: pointOf(input.world) }
}
