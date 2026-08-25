import fs from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

const OUTPUT = 'C:/Users/tuna.ozsari/Desktop/artifacts/study-screenshot-audit-20260821/regression'

test.beforeAll(() => fs.mkdirSync(OUTPUT, { recursive: true }))

test('Screenshot 131909: the complete action dock stays inside a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 604, height: 187 })
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  const viewport = page.viewportSize()!
  const game = await page.locator('#study-game').boundingBox()
  const dock = await page.locator('.action-dock').boundingBox()

  expect(game).not.toBeNull()
  expect(dock).not.toBeNull()
  expect(game!.height).toBeCloseTo(viewport.height, 0)
  expect(dock!.x).toBeGreaterThanOrEqual(6)
  expect(dock!.x + dock!.width).toBeLessThanOrEqual(viewport.width - 6)
  expect(dock!.y).toBeGreaterThanOrEqual(6)
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(viewport.height - 6)

  await page.screenshot({ path: path.join(OUTPUT, 'short-viewport-action-dock.png') })
})

test('the mobile action dock keeps a safe bottom inset on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  const viewport = page.viewportSize()!
  const dock = await page.locator('.action-dock').boundingBox()

  expect(dock).not.toBeNull()
  expect(dock!.x).toBeGreaterThanOrEqual(6)
  expect(dock!.x + dock!.width).toBeLessThanOrEqual(viewport.width - 6)
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(viewport.height - 6)

  await page.screenshot({ path: path.join(OUTPUT, 'phone-action-dock-safe-inset.png') })
})

test('Screenshots 131916 and 131920: real chair clicks finish at the authored sitting anchor', async ({ page }) => {
  await page.setViewportSize({ width: 604, height: 420 })
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  const seatGroups = [
    [['front-left', 'middle-back-right', 'left-edge-back'], 'far-side'],
    [[
      'front-desk', 'front-right', 'lamp-desk', 'lamp-right', 'middle-row', 'middle-right',
      'lower-row', 'lower-right', 'upper-near-left', 'upper-near-mid', 'upper-near-right',
      'middle-front-left-edge', 'middle-front-left', 'middle-front-mid', 'middle-front-right',
      'middle-front-far-right', 'left-lower-front-left', 'left-lower-front-mid',
      'left-lower-front-right', 'left-edge-front', 'right-mid-front-left',
      'right-mid-front-mid', 'right-mid-front-right', 'bottom-front-left',
      'bottom-front-mid-left', 'bottom-front-mid-right', 'bottom-front-right',
      'far-left-partial-front',
    ], 'near-side'],
  ] as const
  for (const [index, [candidates, label]] of seatGroups.entries()) {
    if (index > 0) {
      await page.reload()
      await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })
    }
    const target = await page.evaluate((ids) => {
      const targets = window.__STUDY_GAME_APP__.tapTargets()
      const allowedIds: readonly string[] = ids
      const seat = targets.seats.find((candidate) => {
        if (!allowedIds.includes(candidate.id) || !candidate.reachable || candidate.occupied) return false
        const x = candidate.hitAreaScreen.reduce((sum, point) => sum + point.x, 0) / candidate.hitAreaScreen.length
        const y = candidate.hitAreaScreen.reduce((sum, point) => sum + point.y, 0) / candidate.hitAreaScreen.length
        return targets.blockers.every((blocker) => Math.hypot(blocker.screen.x - x, blocker.screen.y - y) > 48)
      })
      if (!seat) return null
      const x = seat.hitAreaScreen.reduce((sum, point) => sum + point.x, 0) / seat.hitAreaScreen.length
      const y = seat.hitAreaScreen.reduce((sum, point) => sum + point.y, 0) / seat.hitAreaScreen.length
      return { id: seat.id, x, y, world: seat.world, reachable: seat.reachable, occupied: seat.occupied }
    }, candidates)

    expect(target, `${label} needs an authored chair hit target`).not.toBeNull()
    expect(target!.reachable).toBe(true)
    expect(target!.occupied).toBe(false)
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, target!)).toBe('CANVAS')

    await page.mouse.click(target!.x, target!.y)
    await expect.poll(
      () => page.evaluate(() => {
        const snapshot = window.__STUDY_GAME_APP__.snapshot()
        return { state: snapshot.state, seatId: snapshot.seatId }
      }),
      { timeout: 30_000 },
    ).toEqual({ state: 'seated', seatId: target!.id })

    const position = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().position)
    expect(Math.hypot(position.x - target!.world.x, position.y - target!.world.y)).toBeLessThanOrEqual(0.01)
    await expect(page.getByTestId('player-card')).toBeHidden()
    await page.screenshot({ path: path.join(OUTPUT, `library-${label}-seated.png`) })

    await page.evaluate(() => window.__STUDY_GAME_APP__.stand())
    await expect(page.locator('html')).toHaveAttribute('data-game-state', 'ready', { timeout: 15_000 })
  }
})
