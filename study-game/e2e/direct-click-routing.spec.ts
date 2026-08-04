import { expect, test, type Page, type TestInfo } from '@playwright/test'

type TapTarget = ReturnType<Window['__STUDY_GAME_APP__']['tapTargets']>['nodes'][number]

async function tapCanvas(page: Page, testInfo: TestInfo, target: TapTarget): Promise<void> {
  if (testInfo.project.name.startsWith('mobile')) {
    await page.touchscreen.tap(target.screen.x, target.screen.y)
    return
  }
  await page.mouse.click(target.screen.x, target.screen.y)
}

async function waitForReady(page: Page, targetId: string): Promise<void> {
  await expect.poll(async () => {
    const snapshot = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())
    return `${snapshot.state}:${snapshot.nodeId}`
  }, { timeout: 30_000 }).toBe(`ready:${targetId}`)
}

test('real canvas clicks reach their intended node in every room', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  for (const roomId of ['library', 'chim-alan', 'sports-center', 'auditorium'] as const) {
    await page.evaluate((nextRoomId) => window.__STUDY_GAME_APP__.switchRoom(nextRoomId), roomId)

    for (let trip = 0; trip < 2; trip += 1) {
      const viewport = page.viewportSize()!
      const selection = await page.evaluate(({ width, height }) => {
        const snapshot = window.__STUDY_GAME_APP__.snapshot()
        const targets = window.__STUDY_GAME_APP__.tapTargets()
        const current = targets.nodes.find((node) => node.id === snapshot.nodeId)
        if (!current) throw new Error(`Current node ${snapshot.nodeId} is missing`)

        const candidates = targets.nodes
          .filter((node) => node.reachable && node.id !== snapshot.nodeId)
          .filter((node) => node.screen.x > 24 && node.screen.x < width - 24)
          .filter((node) => node.screen.y > 90 && node.screen.y < height - 100)
          .filter((node) => document.elementFromPoint(node.screen.x, node.screen.y)?.tagName === 'CANVAS')
          .filter((node) => targets.seats.every((seat) => Math.hypot(node.world.x - seat.world.x, node.world.y - seat.world.y) > 72))
          .filter((node) => targets.blockers.every((blocker) => Math.hypot(node.world.x - blocker.world.x, node.world.y - blocker.world.y) > blocker.radius + 24))
          .map((node) => ({ node, distance: Math.hypot(node.world.x - current.world.x, node.world.y - current.world.y) }))
          .sort((left, right) => right.distance - left.distance)

        return candidates[0]?.node ?? null
      }, viewport)

      expect(selection, `${roomId} needs a visible, unambiguous floor target`).not.toBeNull()
      await tapCanvas(page, testInfo, selection!)
      await waitForReady(page, selection!.id)
    }
  }
})

test('redirecting mid-walk does not backtrack to an unrelated waypoint', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  await page.evaluate(async () => {
    await window.__STUDY_GAME_APP__.switchRoom('sports-center')
    void window.__STUDY_GAME_APP__.walkToNode('treadmill-aisle')
  })
  await expect.poll(async () => page.evaluate(() => {
    const snapshot = window.__STUDY_GAME_APP__.snapshot()
    const segment = snapshot.activeSegment
    if (!segment) return false
    const targets = window.__STUDY_GAME_APP__.tapTargets()
    const nodes = targets.nodes
    const from = nodes.find((node) => node.id === segment.fromId)
    const to = nodes.find((node) => node.id === segment.toId)
    if (!from || !to) return false
    if (targets.seats.some((seat) => Math.hypot(to.world.x - seat.world.x, to.world.y - seat.world.y) <= 72)) return false
    if (targets.blockers.some((blocker) => Math.hypot(to.world.x - blocker.world.x, to.world.y - blocker.world.y) <= blocker.radius + 24)) return false
    const fromDistance = Math.hypot(snapshot.position.x - from.world.x, snapshot.position.y - from.world.y)
    const toDistance = Math.hypot(snapshot.position.x - to.world.x, snapshot.position.y - to.world.y)
    return fromDistance >= 12 && fromDistance + 12 < toDistance
  }), { timeout: 10_000 }).toBe(true)

  const redirectTarget = await page.evaluate(() => {
    const segment = window.__STUDY_GAME_APP__.snapshot().activeSegment
    if (!segment) throw new Error('Expected an active route segment')
    const target = window.__STUDY_GAME_APP__.tapTargets().nodes.find((node) => node.id === segment.toId)
    if (!target) throw new Error(`Expected route target ${segment.toId}`)
    return target
  })
  const startingPosition = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().position)
  const startingDistance = Math.hypot(
    startingPosition.x - redirectTarget.world.x,
    startingPosition.y - redirectTarget.world.y,
  )

  await tapCanvas(page, testInfo, redirectTarget)

  let greatestDistance = startingDistance
  for (let sample = 0; sample < 14; sample += 1) {
    await page.waitForTimeout(40)
    const position = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().position)
    greatestDistance = Math.max(greatestDistance, Math.hypot(
      position.x - redirectTarget.world.x,
      position.y - redirectTarget.world.y,
    ))
  }

  await waitForReady(page, redirectTarget.id)
  expect(greatestDistance).toBeLessThanOrEqual(startingDistance + 3)
})
