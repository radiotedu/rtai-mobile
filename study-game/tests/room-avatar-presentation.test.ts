import { describe, expect, it } from 'vitest'

import { roomAvatarScale } from '../src/rooms/RoomAvatarPresentation'

describe('room avatar presentation scale', () => {
  it('keeps Çim Alan avatars below the native indoor scale', () => {
    expect(roomAvatarScale('chim-alan', 30, false)).toBeLessThan(0.76)
    expect(roomAvatarScale('chim-alan', 85, false)).toBeLessThan(0.81)
  })

  it('matches Learning Lab avatars to the oversized furniture with depth perspective', () => {
    const rear = roomAvatarScale('learning-lab', 40, false)
    const front = roomAvatarScale('learning-lab', 80, false)
    const seated = roomAvatarScale('learning-lab', 49, true)
    const activityTable = roomAvatarScale('learning-lab', 38.5, true, 'activity-table-seat')

    expect(rear).toBeGreaterThan(1.45)
    expect(front).toBeGreaterThan(rear)
    expect(front - rear).toBeGreaterThan(0.25)
    expect(seated).toBeGreaterThan(1.5)
    expect(seated).toBeLessThan(roomAvatarScale('learning-lab', 49, false))
    expect(activityTable).toBeGreaterThan(1.3)
    expect(activityTable).toBeLessThan(roomAvatarScale('learning-lab', 38.5, true))
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
