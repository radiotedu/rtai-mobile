import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { IMAGE_ROOMS, roomPointToPixel } from '../src/rooms/ImageRoomDefinition'
import { libraryDeviceSocket } from '../src/rooms/LibrarySeatCalibration'
import { resolveSeatGeometry } from '../src/rooms/RoomSeatGeometry'
import librarySeatLayout from '../src/rooms/data/library-seat-layout.json'

type LayoutSeat = Readonly<{
  id: string
  side: 'far' | 'near'
  hit: readonly [number, number, number, number]
}>

describe('Library seat presentation', () => {
  it('binds every visible chair to a matching body anchor, foreground, and laptop socket', async () => {
    const room = IMAGE_ROOMS.library
    const layout = librarySeatLayout as unknown as LayoutSeat[]

    expect(room.seats).toHaveLength(51)
    expect(layout).toHaveLength(51)
    expect(new Set(layout.map((seat) => seat.id)).size).toBe(51)

    for (const authored of layout) {
      const seat = room.seats.find((candidate) => candidate.id === authored.id)
      expect(seat, authored.id).toBeDefined()
      const [x1, y1, x2, y2] = authored.hit
      const centerX = (x1 + x2) / 2
      const expectedAnchor = authored.side === 'far'
        ? { x: centerX - 2, y: y2 + 34 }
        : { x: centerX, y: y2 + 18 }
      const geometry = resolveSeatGeometry(room, seat!)
      const actorAnchor = roomPointToPixel(room, geometry.actorAnchor)
      expect(actorAnchor.x, `${authored.id} actor x`).toBeCloseTo(expectedAnchor.x, 5)
      expect(actorAnchor.y, `${authored.id} actor y`).toBeCloseTo(expectedAnchor.y, 5)
      expect(seat!.facing, `${authored.id} facing`).toBe(authored.side === 'far' ? 'se' : 'n')

      const asset = seat!.foregroundAsset
      expect(asset, `${authored.id} foreground`).not.toBeNull()
      const expectedAsset = authored.side === 'far'
        ? { x: centerX - 44, y: y2 - 4, width: 88, height: 50 }
        : { x: x1 - 8, y: y1 - 6, width: (x2 - x1) + 16, height: (y2 - y1) + 24 }
      expect(Math.abs(asset!.x - expectedAsset.x), `${authored.id} foreground x`).toBeLessThanOrEqual(0.5)
      expect(asset, `${authored.id} foreground geometry`).toMatchObject({
        y: expectedAsset.y,
        width: expectedAsset.width,
        height: expectedAsset.height,
      })
      const metadata = await sharp(path.join(process.cwd(), 'public', asset!.url)).metadata()
      expect(metadata, `${authored.id} foreground file`).toMatchObject({
        width: expectedAsset.width,
        height: expectedAsset.height,
        channels: 4,
        hasAlpha: true,
      })

      const socket = libraryDeviceSocket(authored.id)
      expect(socket, `${authored.id} laptop socket`).toEqual(authored.side === 'far'
        ? { side: 'far', x: centerX + 19, y: y2 + 34 }
        : { side: 'near', x: centerX + 26, y: y1 + 18 })
    }
  })
})
