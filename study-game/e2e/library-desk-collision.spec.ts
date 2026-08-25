import path from 'node:path'

import { expect, test } from '@playwright/test'

const OUTPUT = 'C:/RadioTEDU/evidence/study-full-audit-20260824'

test('real mouse clicks cannot route through any Library desk end', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop collision evidence')
  test.setTimeout(90_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  const deskEnds = [
    { x: 1_135, y: 372 },
    { x: 950, y: 470 },
    { x: 770, y: 550 },
    { x: 535, y: 635 },
    { x: 1_250, y: 730 },
    { x: 1_035, y: 810 },
    { x: 505, y: 661 },
  ]

  for (const world of deskEnds) {
    const before = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())
    const screen = await page.evaluate((point) => {
      const snapshot = window.__STUDY_GAME_APP__.snapshot()
      const canvas = document.querySelector('canvas')!.getBoundingClientRect()
      return {
        x: canvas.left + ((point.x - snapshot.camera.worldViewX) * snapshot.camera.zoom),
        y: canvas.top + ((point.y - snapshot.camera.worldViewY) * snapshot.camera.zoom),
      }
    }, world)
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, screen)).toBe('CANVAS')
    await page.mouse.click(screen.x, screen.y)
    await page.waitForTimeout(180)
    const after = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())
    expect(after.state, JSON.stringify(world)).not.toBe('walking')
    expect(after.lastWalkTarget, JSON.stringify(world)).toEqual(before.lastWalkTarget)
    expect(Math.hypot(after.position.x - before.position.x, after.position.y - before.position.y), JSON.stringify(world)).toBeLessThan(1)
  }

  await page.screenshot({ path: path.join(OUTPUT, 'desktop-chromium-library-desk-collision.png') })
})
