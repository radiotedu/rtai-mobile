import { describe, expect, it } from 'vitest'

import { roomAvatarScale } from '../src/rooms/RoomAvatarPresentation'

describe('room avatar presentation scale', () => {
  it('keeps Çim Alan avatars below the native indoor scale', () => {
    expect(roomAvatarScale('chim-alan', 30, false)).toBeLessThan(0.76)
    expect(roomAvatarScale('chim-alan', 85, false)).toBeLessThan(0.81)
  })

  it('makes Learning Lab avatars match the large furniture artwork', () => {
    expect(roomAvatarScale('learning-lab', 50, false)).toBe(1.32)
    expect(roomAvatarScale('learning-lab', 50, true)).toBe(1.32)
  })

  it('applies depth perspective in the Auditorium', () => {
    const rear = roomAvatarScale('auditorium', 34, false)
    const front = roomAvatarScale('auditorium', 88, false)
    expect(rear).toBeLessThan(front)
    expect(front - rear).toBeGreaterThan(0.2)
  })

  it('preserves the calibrated Library scale', () => {
    expect(roomAvatarScale('library', 50, false)).toBe(1.08)
    expect(roomAvatarScale('library', 50, true)).toBe(1)
  })
})
