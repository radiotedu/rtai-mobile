import { describe, expect, it } from 'vitest'

import { NavigationGraph } from '../src/pathfinding/NavigationGraph'
import { IMAGE_ROOMS, roomPointToPixel } from '../src/rooms/ImageRoomDefinition'

describe('IMAGE_ROOMS', () => {
  it('preserves the two original rooms and exposes the source-backed campus additions', () => {
    expect(Object.keys(IMAGE_ROOMS)).toEqual(['library', 'chim-alan', 'sports-center', 'auditorium', 'learning-lab'])
    expect(IMAGE_ROOMS.library.title).toBe('Library')
    expect(IMAGE_ROOMS['chim-alan'].title).toBe('Çim Alan')
    expect(IMAGE_ROOMS['chim-alan'].image).toEqual(expect.objectContaining({
      url: 'assets/rooms/chim-alan-wide-360-restaurant-r3.png',
      sha256: '1875557012c754fd8f8e3a346dc31b5d8d003e530697bec6674ce08becc12310',
    }))
    expect(IMAGE_ROOMS['sports-center'].image.sha256).toBe('4ad9bb8bbeb6a2a5ff55d15ef4a99b25872f4092d2fbf1ddc5e371f0c12e9313')
    expect(IMAGE_ROOMS.auditorium.image.sha256).toBe('75c424a223515a3bd455c6a4c09694db28bd33dcdb472484ecb67da91454ff9c')
    expect(IMAGE_ROOMS['sports-center'].image.width / IMAGE_ROOMS['sports-center'].image.height).toBeCloseTo(16 / 9, 2)
    expect(IMAGE_ROOMS.auditorium.image.width / IMAGE_ROOMS.auditorium.image.height).toBeCloseTo(16 / 9, 2)
    expect(IMAGE_ROOMS['learning-lab'].image.sha256).toBe('572912669e48aaa3e72c1b6f532d28111566b854af7377d96b4516a1d4785e32')
    expect(IMAGE_ROOMS['learning-lab'].image.width / IMAGE_ROOMS['learning-lab'].image.height).toBeCloseTo(16 / 9, 2)
  })

  it('routes from each exact room spawn to every configured seat', () => {
    for (const room of Object.values(IMAGE_ROOMS)) {
      const graph = new NavigationGraph(room.nodes, room.edges)
      for (const seat of room.seats) {
        const path = graph.findPath(room.spawnNodeId, seat.approachNodeId)
        expect(path, `${room.id}:${seat.id}`).not.toEqual([])
        expect(path.at(-1)).toBe(seat.approachNodeId)
      }
    }
  })

  it('keeps every seat transition adjacent instead of sliding across furniture', () => {
    for (const room of Object.values(IMAGE_ROOMS)) {
      const graph = new NavigationGraph(room.nodes, room.edges)
      for (const seat of room.seats) {
        const approach = graph.node(seat.approachNodeId)!
        const approachPixel = roomPointToPixel(room, approach)
        const sitPixel = roomPointToPixel(room, seat.sit)
        expect(
          Math.hypot(approachPixel.x - sitPixel.x, approachPixel.y - sitPixel.y),
          `${room.id}:${seat.id}`,
        ).toBeLessThanOrEqual(64)
      }
    }
  })

  it('keeps Chim Alan stairs elevated and exposes Spark plus Rock as world actors', () => {
    const room = IMAGE_ROOMS['chim-alan']
    const graph = new NavigationGraph(room.nodes, room.edges)
    const path = graph.findPath(room.spawnNodeId, 'row-3-mid')
    const levels = new Set(path.map((id) => graph.node(id)?.z))

    expect(levels).toEqual(new Set([0, 1, 2, 3]))
    expect(room.actors.spark).toEqual(expect.objectContaining({ name: 'Spark', label: 'rtAI - AI Host' }))
    expect(room.actors.rock).toEqual(expect.objectContaining({ name: 'Rock' }))
  })

  it('keeps the Library front-left route on the visible center and left aisles', () => {
    const room = IMAGE_ROOMS.library
    const graph = new NavigationGraph(room.nodes, room.edges)
    const path = graph.findPath(room.spawnNodeId, 'approach:front-left')

    expect(path).toEqual([
      'bottom-center-aisle',
      'lower-center-aisle',
      'lower-left-aisle',
      'middle-left-aisle',
      'upper-left-aisle',
      'seat-front-left-stand',
      'approach:front-left',
    ])
    expect(path).not.toContain('entrance')
    expect(path.some((id) => id.startsWith('right-spine-'))).toBe(false)
  })

  it('keeps Library center and right-side routes out of the entrance detour', () => {
    const room = IMAGE_ROOMS.library
    const graph = new NavigationGraph(room.nodes, room.edges)
    const middleCenter = graph.findPath(room.spawnNodeId, 'middle-center-aisle')
    const middleRight = graph.findPath(room.spawnNodeId, 'middle-right-aisle')

    expect(middleCenter).toContain('upper-center-aisle')
    expect(middleCenter).not.toContain('middle-right-aisle')
    expect(middleRight).toContain('lower-right-aisle')
    expect(middleRight).not.toContain('entrance')

    for (const seat of room.seats) {
      const path = graph.findPath(room.spawnNodeId, seat.approachNodeId)
      expect(path, seat.id).not.toContain('entrance')
    }
  })

  it('maps percentage navigation coordinates to exact source-image pixels', () => {
    const room = IMAGE_ROOMS.library
    expect(roomPointToPixel(room, { x: 50, y: 25 })).toEqual({ x: 836, y: 235.25 })
  })
})
