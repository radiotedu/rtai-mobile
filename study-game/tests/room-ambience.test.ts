import { describe, expect, it } from 'vitest'
import { IMAGE_ROOMS } from '../src/rooms/ImageRoomDefinition'
import { MAX_ROOM_AMBIENT_OBJECTS, ROOM_AMBIENCE, roomAmbientObjectCount } from '../src/game/RoomAmbience'

describe('room ambience', () => {
  it('gives every playable room a named, bounded ambience plan', () => {
    expect(Object.keys(ROOM_AMBIENCE)).toEqual(Object.keys(IMAGE_ROOMS))
    for (const roomId of Object.keys(IMAGE_ROOMS) as (keyof typeof IMAGE_ROOMS)[]) {
      expect(ROOM_AMBIENCE[roomId].label.length).toBeGreaterThan(0)
      expect(roomAmbientObjectCount(roomId)).toBeGreaterThan(0)
      expect(roomAmbientObjectCount(roomId)).toBeLessThanOrEqual(MAX_ROOM_AMBIENT_OBJECTS)
    }
  })

  it('keeps every normalized effect inside its room canvas', () => {
    for (const plan of Object.values(ROOM_AMBIENCE)) {
      for (const glow of plan.glows) {
        expect(glow.x).toBeGreaterThanOrEqual(0)
        expect(glow.x).toBeLessThanOrEqual(100)
        expect(glow.y).toBeGreaterThanOrEqual(0)
        expect(glow.y).toBeLessThanOrEqual(100)
        expect(glow.alpha).toBeGreaterThan(0)
        expect(glow.alpha).toBeLessThanOrEqual(0.3)
      }
      for (const drift of plan.drifts) {
        expect(drift.x + drift.width).toBeLessThanOrEqual(100)
        expect(drift.y + drift.height).toBeLessThanOrEqual(100)
        expect(drift.count).toBeGreaterThan(0)
      }
    }
  })
})
