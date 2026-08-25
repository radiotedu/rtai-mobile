import { describe, expect, it } from 'vitest'

import { resolveTouchIntent, type TouchIntentResolverInput } from '../src/game/TouchIntentResolver'

const seatArea = [
  { x: 104, y: 94 }, { x: 116, y: 94 }, { x: 116, y: 106 }, { x: 104, y: 106 },
] as const

const baseInput = (overrides: Partial<TouchIntentResolverInput> = {}): TouchIntentResolverInput => ({
  world: { x: 110, y: 100 },
  uiConsumed: false,
  currentSeatId: null,
  activeSeatIntentId: null,
  walkable: true,
  seats: [{
    id: 'seat-a', target: { x: 110, y: 102 }, hitArea: seatArea, reachable: true, occupied: false,
  }],
  players: [],
  ...overrides,
})

describe('resolveTouchIntent', () => {
  it('uses the explicit seat polygon rather than a broad nearest-seat radius', () => {
    expect(resolveTouchIntent(baseInput())).toEqual({
      kind: 'sit', seatId: 'seat-a', target: { x: 110, y: 102 },
    })
    expect(resolveTouchIntent(baseInput({ world: { x: 130, y: 100 } }))).toEqual({
      kind: 'walk', target: { x: 130, y: 100 },
    })
  })

  it('accepts a small explicit seat slop and still rejects distant furniture clicks', () => {
    expect(resolveTouchIntent(baseInput({
      world: { x: 124, y: 100 },
      seatHitSlop: 9,
    }))).toEqual({
      kind: 'sit', seatId: 'seat-a', target: { x: 110, y: 102 },
    })
    expect(resolveTouchIntent(baseInput({
      world: { x: 130, y: 100 },
      seatHitSlop: 9,
    }))).toEqual({
      kind: 'walk', target: { x: 130, y: 100 },
    })
  })

  it('chooses the closest seat when forgiving hit areas overlap', () => {
    expect(resolveTouchIntent(baseInput({
      world: { x: 122, y: 100 },
      seatHitSlop: 12,
      seats: [
        { id: 'seat-a', target: { x: 110, y: 102 }, hitArea: seatArea, reachable: true, occupied: false },
        {
          id: 'seat-b',
          target: { x: 130, y: 102 },
          hitArea: [{ x: 126, y: 94 }, { x: 138, y: 94 }, { x: 138, y: 106 }, { x: 126, y: 106 }],
          reachable: true,
          occupied: false,
        },
      ],
    }))).toEqual({
      kind: 'sit', seatId: 'seat-b', target: { x: 130, y: 102 },
    })
  })

  it('only toggles stand when the current seat itself is clicked', () => {
    expect(resolveTouchIntent(baseInput({ currentSeatId: 'seat-a' }))).toEqual({ kind: 'stand' })
    expect(resolveTouchIntent(baseInput({
      currentSeatId: 'other-seat', world: { x: 130, y: 100 },
    }))).toEqual({ kind: 'walk', target: { x: 130, y: 100 } })
  })

  it('does nothing when UI consumed the pointer', () => {
    expect(resolveTouchIntent(baseInput({ uiConsumed: true }))).toEqual({
      kind: 'ignored', reason: 'ui-consumed',
    })
  })

  it('rejects occupied and unreachable seats', () => {
    expect(resolveTouchIntent(baseInput({ seats: [{
      id: 'seat-a', target: { x: 110, y: 102 }, hitArea: seatArea, reachable: true, occupied: true,
    }] }))).toMatchObject({ kind: 'blocked', reason: 'occupied-seat' })
    expect(resolveTouchIntent(baseInput({ seats: [{
      id: 'seat-a', target: { x: 110, y: 102 }, hitArea: seatArea, reachable: false, occupied: false,
    }] }))).toMatchObject({ kind: 'blocked', reason: 'unreachable' })
  })

  it('returns the exact floor click and blocks solid geometry', () => {
    expect(resolveTouchIntent(baseInput({ seats: [], world: { x: 137, y: 211 } }))).toEqual({
      kind: 'walk', target: { x: 137, y: 211 },
    })
    expect(resolveTouchIntent(baseInput({ seats: [], walkable: false }))).toEqual({
      kind: 'blocked', reason: 'solid-object', target: { x: 110, y: 100 },
    })
  })

  it('prioritizes a nearby player and deduplicates a seat approach', () => {
    expect(resolveTouchIntent(baseInput({ players: [{ userId: 'user-2', x: 108, y: 101 }] }))).toEqual({
      kind: 'interact-player', userId: 'user-2',
    })
    expect(resolveTouchIntent(baseInput({ activeSeatIntentId: 'seat-a' }))).toEqual({
      kind: 'ignored', reason: 'duplicate-seat',
    })
  })
})
