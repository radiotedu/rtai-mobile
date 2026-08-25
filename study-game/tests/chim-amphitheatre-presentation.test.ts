import { readFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { NavigationGraph } from '../src/pathfinding/NavigationGraph'
import { RoomNavigationField, pointInPolygon } from '../src/pathfinding/RoomNavigationField'
import { IMAGE_ROOMS, roomPointToPixel } from '../src/rooms/ImageRoomDefinition'
import { roomInteractionObstacles, roomNavigationGeometry } from '../src/rooms/RoomNavigationProfiles'
import { resolveSeatGeometry } from '../src/rooms/RoomSeatGeometry'
import layout from '../src/rooms/data/chim-alan-amphitheatre-layout.json'

const room = IMAGE_ROOMS['chim-alan']
const field = new RoomNavigationField({
  width: room.image.width,
  height: room.image.height,
  geometry: roomNavigationGeometry(room),
  clearance: 18,
})

describe('Çim Alan amphitheatre calibration', () => {
  it('binds the calibration to the current TEDU-grounded source artwork', () => {
    expect(layout.image).toEqual({
      width: room.image.width,
      height: room.image.height,
      sha256: room.image.sha256,
    })
  })

  it('keeps the nine stable seat IDs on three diagonal cream bench rows', () => {
    expect(room.seats.map((seat) => seat.id)).toEqual([
      'amfi-a1', 'amfi-a2', 'amfi-a3',
      'amfi-b1', 'amfi-b2', 'amfi-b3',
      'amfi-c1', 'amfi-c2', 'amfi-c3',
    ])
    for (const rowKey of ['a', 'b', 'c']) {
      const anchors = room.seats
        .filter((seat) => seat.id.startsWith(`amfi-${rowKey}`))
        .map((seat) => roomPointToPixel(room, resolveSeatGeometry(room, seat).actorAnchor))
      expect(anchors[0]!.x).toBeLessThan(anchors[1]!.x)
      expect(anchors[1]!.x).toBeLessThan(anchors[2]!.x)
      expect(anchors[0]!.y).toBeLessThan(anchors[1]!.y)
      expect(anchors[1]!.y).toBeLessThan(anchors[2]!.y)
    }
    expect(roomPointToPixel(room, resolveSeatGeometry(room, room.seats.at(-1)!).actorAnchor).x).toBeLessThan(1_100)
  })

  it('routes the left seats by the left stairs and right seats by the right stairs', () => {
    const graph = new NavigationGraph(room.nodes, room.edges)
    const left = graph.findPath(room.spawnNodeId, 'row-2-left')
    const right = graph.findPath(room.spawnNodeId, 'row-2-right')
    expect(left).toContain('stair-2')
    expect(left.some((id) => id.startsWith('right-stair'))).toBe(false)
    expect(right).toContain('right-stair-2')
  })

  it('keeps every grass-tread approach reachable while cream fronts reject floor walking', () => {
    const interactionObstacles = roomInteractionObstacles(room)
    for (const seat of room.seats) {
      const geometry = resolveSeatGeometry(room, seat)
      const approach = roomPointToPixel(room, geometry.approach)
      expect(field.isWalkable(approach, geometry.approach.z), `${seat.id} approach`).toBe(true)
      expect(geometry.hitArea.some((point) => pointInPolygon(roomPointToPixel(room, point), interactionObstacles[0]!)) || interactionObstacles.some((polygon) => (
        geometry.hitArea.some((point) => pointInPolygon(roomPointToPixel(room, point), polygon))
      )), `${seat.id} front`).toBe(true)
    }
    expect(field.isWalkable({ x: 790, y: 560 }, 0), 'freestanding bench').toBe(false)
  })

  it('does not expose a walkable route through the removed upper-right path', () => {
    const removedPath = [
      { x: 1_450, y: 300 },
      { x: 1_525, y: 405 },
      { x: 1_600, y: 520 },
    ]
    for (const point of removedPath) {
      expect(field.layerAt(point), `${point.x},${point.y}`).toBeNull()
    }
    expect(field.layerAt({ x: 900, y: 285 }), 'restaurant courtyard').not.toBeNull()
  })

  it('ships transparent source-pixel foreground assets for every calibrated seat', async () => {
    for (const seat of room.seats) {
      const asset = seat.foregroundAsset!
      const file = path.join(process.cwd(), 'public', asset.url)
      const metadata = await sharp(await readFile(file)).metadata()
      expect(metadata.channels, seat.id).toBe(4)
      expect(metadata.hasAlpha, seat.id).toBe(true)
      expect(asset.width, seat.id).toBeGreaterThan(80)
      expect(asset.height, seat.id).toBeGreaterThan(20)
    }
  })
})
