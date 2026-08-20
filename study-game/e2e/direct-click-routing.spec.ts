import { expect, test, type Page, type TestInfo } from '@playwright/test'

type FloorTarget = ReturnType<Window['__STUDY_GAME_APP__']['tapTargets']>['floor'][number]

async function tapCanvas(page: Page, testInfo: TestInfo, target: FloorTarget): Promise<void> {
  if (testInfo.project.name.startsWith('mobile')) {
    await page.touchscreen.tap(target.screen.x, target.screen.y)
    return
  }
  await page.mouse.click(target.screen.x, target.screen.y)
}

async function farVisibleFloorTarget(page: Page, excluded: readonly FloorTarget[] = []): Promise<FloorTarget> {
  // Mobile rooms use a smoothly-following camera. Wait for the post-arrival
  // camera glide to settle so the sampled canvas pixel still represents the
  // same world point when the real touchscreen event is delivered.
  await expect.poll(async () => {
    const before = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().camera)
    await page.waitForTimeout(100)
    const after = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().camera)
    return Math.hypot(after.worldViewX - before.worldViewX, after.worldViewY - before.worldViewY)
  }, { timeout: 10_000 }).toBeLessThan(0.5)
  const viewport = page.viewportSize()!
  const target = await page.evaluate(({ width, height, excludedIds }) => {
    const snapshot = window.__STUDY_GAME_APP__.snapshot()
    const targets = window.__STUDY_GAME_APP__.tapTargets()
    const candidates = targets.floor
      .filter((candidate) => !excludedIds.includes(candidate.id))
      .filter((candidate) => candidate.screen.x > 24 && candidate.screen.x < width - 24)
      .filter((candidate) => candidate.screen.y > 90 && candidate.screen.y < height - 100)
      .filter((candidate) => document.elementFromPoint(candidate.screen.x, candidate.screen.y)?.tagName === 'CANVAS')
      .filter((candidate) => targets.blockers.every((blocker) => (
        Math.hypot(candidate.world.x - blocker.world.x, candidate.world.y - blocker.world.y) > blocker.radius + 36
      )))
      .filter((candidate) => targets.seats.every((seat) => (
        Math.hypot(candidate.world.x - seat.world.x, candidate.world.y - seat.world.y) > 48
      )))
      .map((candidate) => ({
        candidate,
        distance: Math.hypot(candidate.world.x - snapshot.position.x, candidate.world.y - snapshot.position.y),
      }))
      .sort((left, right) => right.distance - left.distance)[0]?.candidate ?? null
    if (!candidates) return null
    const distance = Math.hypot(candidates.world.x - snapshot.position.x, candidates.world.y - snapshot.position.y)
    return distance > (excludedIds.length ? 96 : 180) ? candidates : null
  }, { width: viewport.width, height: viewport.height, excludedIds: excluded.map((target) => target.id) })
  expect(target, 'room needs a visible collision-safe floor sample').not.toBeNull()
  return target!
}

async function waitForReadyAt(page: Page, target: FloorTarget, label = ''): Promise<void> {
  try {
    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())
      return snapshot.state === 'ready'
        // A touchscreen tap is integer CSS pixels; at the mobile camera zoom a
        // half-pixel rounding difference can represent just under 8 world px.
        && Math.hypot(snapshot.position.x - target.world.x, snapshot.position.y - target.world.y) <= 8
    }, { timeout: 30_000 }).toBe(true)
  } catch (error) {
    const snapshot = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())
    throw new Error(`${label} missed ${JSON.stringify(target.world)}; final=${JSON.stringify(snapshot.position)} state=${snapshot.state}`, { cause: error })
  }
}

test('real canvas clicks reach exact collision-safe floor points in every room', async ({ page }, testInfo) => {
  test.setTimeout(360_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  for (const roomId of ['library', 'chim-alan', 'sports-center', 'auditorium', 'learning-lab'] as const) {
    await page.evaluate((nextRoomId) => window.__STUDY_GAME_APP__.switchRoom(nextRoomId), roomId)
    const first = await farVisibleFloorTarget(page)
    await tapCanvas(page, testInfo, first)
    await waitForReadyAt(page, first, `${roomId}:first`)
    const second = await farVisibleFloorTarget(page, [first])
    await tapCanvas(page, testInfo, second)
    await waitForReadyAt(page, second, `${roomId}:second`)
  }
})

test('redirecting mid-walk replans from the live position without backtracking', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })
  await page.evaluate(() => window.__STUDY_GAME_APP__.switchRoom('sports-center'))

  const first = await farVisibleFloorTarget(page)
  await tapCanvas(page, testInfo, first)
  await expect.poll(() => page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().state)).toBe('walking')

  const redirect = await farVisibleFloorTarget(page, [first])
  const previousIntent = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().lastWalkTarget)
  await tapCanvas(page, testInfo, redirect)
  const acceptedRedirect = await expect.poll(async () => {
    const target = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().lastWalkTarget)
    if (!target || (previousIntent && target.x === previousIntent.x && target.y === previousIntent.y)) return null
    return target
  }).not.toBeNull().then(() => page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().lastWalkTarget))
  expect(acceptedRedirect).not.toBeNull()
  const actualTarget = { ...redirect, world: acceptedRedirect! }
  const startingPosition = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().position)
  const startingDistance = Math.hypot(startingPosition.x - actualTarget.world.x, startingPosition.y - actualTarget.world.y)

  let greatestDistance = startingDistance
  for (let sample = 0; sample < 16; sample += 1) {
    await page.waitForTimeout(40)
    const position = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().position)
    greatestDistance = Math.max(greatestDistance, Math.hypot(position.x - actualTarget.world.x, position.y - actualTarget.world.y))
  }
  await waitForReadyAt(page, actualTarget)
  expect(greatestDistance).toBeLessThanOrEqual(startingDistance + 8)
})
