import { describe, expect, it } from 'vitest'

import { buildDailyFocusGoal } from '../src/progression/DailyFocusGoal'

describe('daily focus goal', () => {
  it('counts active verified time in every study room without exceeding the target', () => {
    const active = buildDailyFocusGoal({ todaySeconds: 600, activeSeconds: 120, running: true, counting: true })
    expect(active).toMatchObject({ verifiedMinutes: 12, remainingMinutes: 13, progressPercent: 48, kicker: 'VERIFIED FOCUS ACTIVE' })

    const complete = buildDailyFocusGoal({ todaySeconds: 2_000, activeSeconds: 500, running: true, counting: true })
    expect(complete).toMatchObject({ verifiedMinutes: 25, remainingMinutes: 0, progressPercent: 100, complete: true })
  })

  it('does not add paused time and sanitizes untrusted values', () => {
    const paused = buildDailyFocusGoal({ todaySeconds: 120, activeSeconds: 600, running: false, counting: false })
    expect(paused.verifiedMinutes).toBe(2)
    expect(paused.kicker).toBe('DAILY FOCUS GOAL')

    const unsafe = buildDailyFocusGoal({ todaySeconds: Number.POSITIVE_INFINITY, activeSeconds: -100, running: true, counting: true })
    expect(unsafe.verifiedMinutes).toBe(0)
  })
})
