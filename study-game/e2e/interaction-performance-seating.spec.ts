import { expect, test, type Page, type TestInfo } from '@playwright/test'

type TapTargets = ReturnType<Window['__STUDY_GAME_APP__']['tapTargets']>
type ScreenTarget = { screen: { x: number; y: number } }

async function tap(page: Page, testInfo: TestInfo, target: ScreenTarget): Promise<void> {
  if (testInfo.project.name.startsWith('mobile')) {
    await page.touchscreen.tap(target.screen.x, target.screen.y)
    return
  }
  await page.mouse.click(target.screen.x, target.screen.y)
}

async function visibleSeat(page: Page): Promise<TapTargets['seats'][number]> {
  const viewport = page.viewportSize()!
  const seat = await page.evaluate(({ width, height }) => {
    const targets = window.__STUDY_GAME_APP__.tapTargets()
    return targets.seats.find((candidate) => {
      const x = candidate.hitAreaScreen.reduce((sum, point) => sum + point.x, 0) / candidate.hitAreaScreen.length
      const y = candidate.hitAreaScreen.reduce((sum, point) => sum + point.y, 0) / candidate.hitAreaScreen.length
      return candidate.reachable
        && !candidate.occupied
        && x > 24 && x < width - 24
        && y > 90 && y < height - 84
        && document.elementFromPoint(x, y)?.tagName === 'CANVAS'
        && targets.blockers.every((blocker) => Math.hypot(blocker.screen.x - x, blocker.screen.y - y) > 38)
    }) ?? null
  }, viewport)
  expect(seat, 'room needs a visible, free authored seat').not.toBeNull()
  const x = seat!.hitAreaScreen.reduce((sum, point) => sum + point.x, 0) / seat!.hitAreaScreen.length
  const y = seat!.hitAreaScreen.reduce((sum, point) => sum + point.y, 0) / seat!.hitAreaScreen.length
  return { ...seat!, screen: { x, y } }
}

test('real chair clicks start a seated study session in every seat-bearing room', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  for (const roomId of ['library', 'chim-alan', 'auditorium', 'learning-lab'] as const) {
    await page.evaluate((nextRoomId) => window.__STUDY_GAME_APP__.switchRoom(nextRoomId), roomId)
    if (testInfo.project.name.startsWith('mobile')) {
      const approach = await page.evaluate(() => {
        const seat = window.__STUDY_GAME_APP__.tapTargets().seats.find((candidate) => candidate.reachable && !candidate.occupied)
        return seat?.approach ?? null
      })
      expect(approach, `${roomId} needs a reachable chair approach`).not.toBeNull()
      await page.evaluate((point) => window.__STUDY_GAME_APP__.walkToPoint(point!.x, point!.y), approach)
      await expect.poll(() => page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().state), { timeout: 30_000 }).toBe('ready')
    }
    const seat = await visibleSeat(page)
    await tap(page, testInfo, seat)
    await expect.poll(
      () => page.evaluate(() => {
        const snapshot = window.__STUDY_GAME_APP__.snapshot()
        return { state: snapshot.state, seatId: snapshot.seatId }
      }),
      { timeout: 30_000, message: `${roomId}:${seat.id} should seat from a real canvas click` },
    ).toEqual({ state: 'seated', seatId: seat.id })
    await expect(page.locator('#study-timer'), `${roomId}:${seat.id} should start verified study time`).toHaveAttribute('data-running', 'true')
    await page.evaluate(() => window.__STUDY_GAME_APP__.stand())
    await expect(page.locator('#study-timer'), `${roomId}:${seat.id} should stop study time after standing`).toHaveAttribute('data-running', 'false')
  }
})

test('rapid real clicks stay responsive and settle on the latest walk intent', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('crash', () => pageErrors.push('page crashed'))
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  await page.evaluate(() => {
    const target = window as Window & { __studyLongTasks?: number[]; __studyLongTaskObserver?: PerformanceObserver }
    target.__studyLongTasks = []
    target.__studyLongTaskObserver?.disconnect()
    target.__studyLongTaskObserver = new PerformanceObserver((list) => {
      target.__studyLongTasks!.push(...list.getEntries().map((entry) => entry.duration))
    })
    target.__studyLongTaskObserver.observe({ entryTypes: ['longtask'] })
  })

  const viewport = page.viewportSize()!
  const targets = await page.evaluate(({ width, height }) => {
    const all = window.__STUDY_GAME_APP__.tapTargets()
    return all.floor
      .filter((candidate) => candidate.screen.x > 190 && candidate.screen.x < width - 24)
      .filter((candidate) => candidate.screen.y > 90 && candidate.screen.y < height - 84)
      .filter((candidate) => document.elementFromPoint(candidate.screen.x, candidate.screen.y)?.tagName === 'CANVAS')
      .filter((candidate) => all.blockers.every((blocker) => Math.hypot(candidate.world.x - blocker.world.x, candidate.world.y - blocker.world.y) > blocker.radius + 24))
      .filter((candidate) => all.seats.every((seat) => Math.hypot(candidate.world.x - seat.world.x, candidate.world.y - seat.world.y) > 40))
      .slice(0, 18)
  }, viewport)
  expect(targets.length).toBeGreaterThanOrEqual(10)

  const startedAt = Date.now()
  for (const target of targets) await tap(page, testInfo, target)
  const dispatchMs = Date.now() - startedAt
  await page.waitForTimeout(300)
  const maxLongTaskMs = await page.evaluate(() => {
    const durations = (window as Window & { __studyLongTasks?: number[] }).__studyLongTasks ?? []
    return Math.max(0, ...durations)
  })
  const snapshot = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())
  const latestTarget = targets.at(-1)!
  const latestTargetDistance = snapshot.lastWalkTarget
    ? Math.hypot(
        snapshot.lastWalkTarget.x - latestTarget.world.x,
        snapshot.lastWalkTarget.y - latestTarget.world.y,
      )
    : Number.POSITIVE_INFINITY
  const targetDistances = targets.map((target, index) => ({
    index,
    id: target.id,
    distance: snapshot.lastWalkTarget
      ? Math.hypot(
          snapshot.lastWalkTarget.x - target.world.x,
          snapshot.lastWalkTarget.y - target.world.y,
        )
      : Number.POSITIVE_INFINITY,
    world: target.world,
  }))
  const nearestSelectedTarget = [...targetDistances].sort((left, right) => left.distance - right.distance)[0]!
  const nearestEarlierTargetDistance = Math.min(...targetDistances.slice(0, -1).map((target) => target.distance))
  const rapidClickMetrics = {
    targetCount: targets.length,
    dispatchMs,
    maxLongTaskMs,
    latestTargetDistance,
    expectedTarget: latestTarget.world,
    activeTarget: snapshot.lastWalkTarget,
    nearestSelectedTarget,
    nearestEarlierTargetDistance,
    finalSelectedTargets: targetDistances.slice(-4),
  }

  await testInfo.attach('rapid-click-metrics.json', {
    body: Buffer.from(JSON.stringify(rapidClickMetrics, null, 2)),
    contentType: 'application/json',
  })
  console.log(`rapid-click-metrics ${JSON.stringify(rapidClickMetrics)}`)

  expect(dispatchMs, '18 real click events should not synchronously stall the game').toBeLessThan(2_000)
  expect(maxLongTaskMs, 'click burst should not create a visible main-thread freeze').toBeLessThan(200)
  expect(pageErrors).toEqual([])
  expect(['walking', 'ready']).toContain(snapshot.state)
  expect(snapshot.lastWalkTarget, 'the batched pointer handler should retain the newest click').not.toBeNull()
  expect(nearestSelectedTarget.index, 'the newest click should be the active target after camera motion').toBe(targets.length - 1)
  expect(latestTargetDistance, 'the newest click should remain closer than every older pending target').toBeLessThan(nearestEarlierTargetDistance)
})
