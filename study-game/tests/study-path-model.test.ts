import { describe, expect, it } from 'vitest'

import { buildStudyPath } from '../src/progression/StudyPathModel'

describe('study path model', () => {
  it('derives milestones without client-side currency rewards', () => {
    const goals = buildStudyPath({
      todaySeconds: 1_620,
      totalSeconds: 1_620,
      visitedRooms: new Set(['library', 'chim-alan', 'sports-center', 'auditorium', 'learning-lab']),
      socialActions: 1,
      seatedNow: false,
    })
    expect(goals.every((goal) => goal.complete)).toBe(true)
    expect(goals.some((goal) => 'rewardGold' in goal)).toBe(false)
  })

  it('clamps untrusted progress values', () => {
    const goals = buildStudyPath({ todaySeconds: Number.POSITIVE_INFINITY, totalSeconds: -4, visitedRooms: new Set(), socialActions: -10, seatedNow: false })
    expect(goals.map((goal) => goal.progress)).toEqual([0, 0, 0, 0])
  })
})
