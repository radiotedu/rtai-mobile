import path from 'node:path'

import { expect, test } from '@playwright/test'

const OUTPUT = 'C:/Users/tuna.ozsari/Desktop/artifacts/study-game/issue-fixes-20260811'

test('captures both Library seat directions and the Çim Alan cafe perspective', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop visual acceptance')
  test.setTimeout(120_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  const nearSeatId = await page.evaluate(() => {
    const candidates = ['upper-near-left', 'far-left-partial-front', 'left-edge-front', 'upper-near-mid', 'middle-front-far-right']
    const seats = window.__STUDY_GAME_APP__.tapTargets().seats
    return candidates.find((id) => seats.some((seat) => seat.id === id && seat.reachable && !seat.occupied)) ?? null
  })
  expect(nearSeatId, 'Library needs an available near-side chair').not.toBeNull()

  for (const [seatId, label] of [['front-left', 'toward-table'], [nearSeatId!, 'away-from-camera']] as const) {
    if (await page.locator('html[data-game-state="seated"]').count()) {
      await page.evaluate(() => window.__STUDY_GAME_APP__.stand())
    }
    await page.evaluate((id) => window.__STUDY_GAME_APP__.walkToSeat(id), seatId)
    await expect(page.locator('html')).toHaveAttribute('data-game-state', 'seated', { timeout: 30_000 })
    await expect(page.locator('html')).toHaveAttribute('data-seated-seat-id', seatId)
    await page.screenshot({ path: path.join(OUTPUT, `${testInfo.project.name}-library-${label}.png`) })
  }

  await page.evaluate(() => window.__STUDY_GAME_APP__.switchRoom('chim-alan'))
  await expect(page.locator('html')).toHaveAttribute('data-room-id', 'chim-alan')
  await expect(page.locator('html')).toHaveAttribute('data-structural-foregrounds', '1')
  const terraceTarget = await page.evaluate(() => {
    const targets = window.__STUDY_GAME_APP__.tapTargets().floor
      .filter((target) => document.elementFromPoint(target.screen.x, target.screen.y)?.tagName === 'CANVAS')
      .sort((left, right) => (
        Math.hypot(left.world.x - 1_050, left.world.y - 345)
        - Math.hypot(right.world.x - 1_050, right.world.y - 345)
      ))
    return targets[0] ?? null
  })
  expect(terraceTarget, 'the cafe terrace needs a visible mouse target').not.toBeNull()
  await page.mouse.click(terraceTarget!.screen.x, terraceTarget!.screen.y)
  await expect(page.locator('html')).toHaveAttribute('data-game-state', 'ready', { timeout: 30_000 })
  await page.screenshot({ path: path.join(OUTPUT, `${testInfo.project.name}-chim-alan-cafe.png`) })
})

test('captures the Çim Alan cafe after a real mobile terrace tap', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile visual acceptance')
  test.setTimeout(90_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })
  await page.evaluate(() => window.__STUDY_GAME_APP__.switchRoom('chim-alan'))
  await page.evaluate(() => window.__STUDY_GAME_APP__.walkToPoint(900, 345))
  await expect(page.locator('html')).toHaveAttribute('data-game-state', 'ready', { timeout: 30_000 })

  const terraceTarget = await page.evaluate(() => {
    const targets = window.__STUDY_GAME_APP__.tapTargets().floor
      .filter((target) => document.elementFromPoint(target.screen.x, target.screen.y)?.tagName === 'CANVAS')
      .sort((left, right) => (
        Math.hypot(left.world.x - 1_050, left.world.y - 345)
        - Math.hypot(right.world.x - 1_050, right.world.y - 345)
      ))
    return targets[0] ?? null
  })
  expect(terraceTarget, 'the cafe terrace needs a visible touch target').not.toBeNull()
  await page.touchscreen.tap(terraceTarget!.screen.x, terraceTarget!.screen.y)
  await expect(page.locator('html')).toHaveAttribute('data-game-state', 'ready', { timeout: 30_000 })
  await page.screenshot({ path: path.join(OUTPUT, `${testInfo.project.name}-chim-alan-cafe.png`) })
})

test('captures the corrected full-viewport HUD and room perspective', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop visual acceptance')
  test.setTimeout(120_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  const viewport = page.viewportSize()!
  const gameBounds = await page.locator('#study-game').boundingBox()
  expect(gameBounds).not.toBeNull()
  expect(gameBounds!.width).toBeCloseTo(viewport.width, 0)
  expect(gameBounds!.height).toBeCloseTo(viewport.height, 0)

  for (const roomId of ['chim-alan', 'auditorium', 'learning-lab'] as const) {
    await page.evaluate((nextRoomId) => window.__STUDY_GAME_APP__.switchRoom(nextRoomId), roomId)
    if (roomId === 'auditorium') {
      const aisle = await page.evaluate(() => window.__STUDY_GAME_APP__.tapTargets().nodes.find((node) => node.id === 'middle-aisle')!.world)
      await page.evaluate((point) => window.__STUDY_GAME_APP__.walkToPoint(point.x, point.y), aisle)
    } else {
      const seatId = await page.evaluate(() => window.__STUDY_GAME_APP__.tapTargets().seats.find((seat) => seat.reachable && !seat.occupied)?.id ?? null)
      expect(seatId, `${roomId} needs a presentable study seat`).not.toBeNull()
      await page.evaluate((id) => window.__STUDY_GAME_APP__.walkToSeat(id!), seatId)
    }
    await page.waitForTimeout(250)
    await page.screenshot({ path: path.join(OUTPUT, `${testInfo.project.name}-${roomId}.png`) })
  }
})
