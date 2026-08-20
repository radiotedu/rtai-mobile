import { expect, test, type Page, type TestInfo } from '@playwright/test'

type FloorTarget = ReturnType<Window['__STUDY_GAME_APP__']['tapTargets']>['floor'][number]

async function tap(page: Page, testInfo: TestInfo, target: FloorTarget): Promise<void> {
  if (testInfo.project.name.startsWith('mobile')) await page.touchscreen.tap(target.screen.x, target.screen.y)
  else await page.mouse.click(target.screen.x, target.screen.y)
}

test('a floor click while seated stands and continues to the retained destination', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })
  const seatId = 'bottom-back-mid-left'
  await page.evaluate((id) => window.__STUDY_GAME_APP__.walkToSeat(id), seatId)
  await expect.poll(() => page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().state)).toBe('seated')

  const seated = await page.evaluate((id) => {
    const snapshot = window.__STUDY_GAME_APP__.snapshot()
    const seat = window.__STUDY_GAME_APP__.tapTargets().seats.find((candidate) => candidate.id === id)
    return { snapshot, seat }
  }, seatId)
  expect(seated.seat).toBeTruthy()
  expect(Math.hypot(
    seated.snapshot.position.x - seated.seat!.world.x,
    seated.snapshot.position.y - seated.seat!.world.y,
  )).toBeLessThanOrEqual(2)

  const viewport = page.viewportSize()!
  const target = await page.evaluate(({ width, height }) => {
    const snapshot = window.__STUDY_GAME_APP__.snapshot()
    return window.__STUDY_GAME_APP__.tapTargets().floor
      .filter((candidate) => candidate.screen.x > 24 && candidate.screen.x < width - 24)
      .filter((candidate) => candidate.screen.y > 90 && candidate.screen.y < height - 100)
      .filter((candidate) => document.elementFromPoint(candidate.screen.x, candidate.screen.y)?.tagName === 'CANVAS')
      .map((candidate) => ({ candidate, distance: Math.hypot(
        candidate.world.x - snapshot.position.x,
        candidate.world.y - snapshot.position.y,
      ) }))
      .filter((candidate) => candidate.distance > 250)
      .sort((left, right) => right.distance - left.distance)[0]?.candidate ?? null
  }, viewport)
  expect(target).toBeTruthy()
  await tap(page, testInfo, target!)
  await expect.poll(async () => {
    const snapshot = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())
    return snapshot.state === 'ready'
      && snapshot.seatId === null
      // Navigation resolves safe floor taps to the nearest grid-cell center.
      // Ten world units is below one cell and still proves the retained target.
      && Math.hypot(snapshot.position.x - target!.world.x, snapshot.position.y - target!.world.y) <= 10
  }, { timeout: 30_000 }).toBe(true)
})

test('campus cats animate their paws while sprite and shadow stay grounded', async ({ page }) => {
  test.setTimeout(40_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })
  await expect.poll(async () => {
    const cats = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().cats)
    return cats.some((cat) => cat.walking)
  }, { timeout: 12_000 }).toBe(true)

  const frames = new Set<number>()
  for (let index = 0; index < 16; index += 1) {
    const cat = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().cats.find((candidate) => candidate.walking))
    if (cat) {
      frames.add(cat.frame)
      expect(Math.abs(cat.position.y - cat.shadowPosition.y)).toBeLessThanOrEqual(0.01)
    }
    await page.waitForTimeout(80)
  }
  expect(frames.size).toBeGreaterThanOrEqual(2)
})

test('furniture-adjacent desk seats use collision-safe approaches and exact anchors', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  for (const target of [
    { roomId: 'library', seatId: 'lamp-desk' },
    { roomId: 'learning-lab', seatId: 'activity-table-seat' },
  ] as const) {
    await page.evaluate((roomId) => window.__STUDY_GAME_APP__.switchRoom(roomId), target.roomId)
    const seat = await page.evaluate((seatId) => (
      window.__STUDY_GAME_APP__.tapTargets().seats.find((candidate) => candidate.id === seatId) ?? null
    ), target.seatId)
    expect(seat, `${target.roomId}:${target.seatId} metadata`).not.toBeNull()
    await page.evaluate((seatId) => window.__STUDY_GAME_APP__.walkToSeat(seatId), target.seatId)
    const snapshot = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())
    expect(snapshot.state).toBe('seated')
    expect(snapshot.seatId).toBe(target.seatId)
    expect(Math.hypot(snapshot.position.x - seat!.world.x, snapshot.position.y - seat!.world.y)).toBeLessThanOrEqual(0.01)
    await page.evaluate(() => window.__STUDY_GAME_APP__.stand())
  }
})
