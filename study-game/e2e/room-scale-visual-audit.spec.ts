import fs from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

const OUTPUT = process.env.STUDY_SCALE_AUDIT_OUTPUT
  ?? 'C:/Users/tuna.ozsari/Desktop/artifacts/study-room-scale-audit-20260821/current'

test.beforeAll(() => fs.mkdirSync(OUTPUT, { recursive: true }))

test('captures room scale and chair proportions after real mouse movement', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop visual audit')
  test.setTimeout(150_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  await page.getByRole('tab', { name: 'Learning Lab' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-room-id', 'learning-lab')

  const floor = await page.evaluate(() => window.__STUDY_GAME_APP__.tapTargets().floor
    .filter((target) => document.elementFromPoint(target.screen.x, target.screen.y)?.tagName === 'CANVAS')
    .sort((left, right) => (
      Math.hypot(left.world.x - 620, left.world.y - 650)
      - Math.hypot(right.world.x - 620, right.world.y - 650)
    ))[0] ?? null)
  expect(floor, 'Learning Lab needs a visible floor point near the dining chairs').not.toBeNull()
  await page.mouse.click(floor!.screen.x, floor!.screen.y)
  await expect.poll(() => page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().state), { timeout: 30_000 }).toBe('ready')
  await page.screenshot({ path: path.join(OUTPUT, 'learning-lab-standing-near-chairs.png') })

  const windowChair = await page.evaluate(() => {
    const seat = window.__STUDY_GAME_APP__.tapTargets().seats.find((candidate) => candidate.id === 'window-chair')
    if (!seat) return null
    return {
      id: seat.id,
      x: seat.hitAreaScreen.reduce((sum, point) => sum + point.x, 0) / seat.hitAreaScreen.length,
      y: seat.hitAreaScreen.reduce((sum, point) => sum + point.y, 0) / seat.hitAreaScreen.length,
    }
  })
  expect(windowChair).not.toBeNull()
  fs.writeFileSync(path.join(OUTPUT, 'tap-coordinates.json'), JSON.stringify({
    floor: { screen: floor!.screen, world: floor!.world },
    windowChair,
  }, null, 2))
  await page.mouse.click(windowChair!.x, windowChair!.y)
  await expect(page.locator('html')).toHaveAttribute('data-seated-seat-id', 'window-chair', { timeout: 30_000 })
  await page.screenshot({ path: path.join(OUTPUT, 'learning-lab-window-chair-seated.png') })

  for (const roomId of ['chim-alan', 'auditorium', 'sports-center'] as const) {
    await page.getByRole('tab', { name: roomId === 'chim-alan' ? 'Çim Alan' : roomId === 'auditorium' ? 'Auditorium' : 'Sports Center' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-room-id', roomId)
    const target = await page.evaluate(() => {
      const targets = window.__STUDY_GAME_APP__.tapTargets()
      const segmentDistance = (
        point: { x: number; y: number },
        from: { x: number; y: number },
        to: { x: number; y: number },
      ) => {
        const dx = to.x - from.x
        const dy = to.y - from.y
        const lengthSquared = dx * dx + dy * dy
        if (lengthSquared === 0) return Math.hypot(point.x - from.x, point.y - from.y)
        const amount = Math.max(0, Math.min(1, (
          ((point.x - from.x) * dx) + ((point.y - from.y) * dy)
        ) / lengthSquared))
        return Math.hypot(point.x - (from.x + amount * dx), point.y - (from.y + amount * dy))
      }
      const seatDistance = (point: { x: number; y: number }) => targets.seats.reduce((closest, seat) => {
        let inside = false
        for (let index = 0, previous = seat.hitAreaScreen.length - 1; index < seat.hitAreaScreen.length; previous = index, index += 1) {
          const current = seat.hitAreaScreen[index]!
          const prior = seat.hitAreaScreen[previous]!
          const intersects = (current.y > point.y) !== (prior.y > point.y)
            && point.x < (((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y)) + current.x
          if (intersects) inside = !inside
        }
        if (inside) return 0
        let distance = Number.POSITIVE_INFINITY
        for (let index = 0; index < seat.hitAreaScreen.length; index += 1) {
          distance = Math.min(distance, segmentDistance(
            point,
            seat.hitAreaScreen[index]!,
            seat.hitAreaScreen[(index + 1) % seat.hitAreaScreen.length]!,
          ))
        }
        return Math.min(closest, distance)
      }, Number.POSITIVE_INFINITY)

      return targets.floor
        .filter((candidate) => (
          document.elementFromPoint(candidate.screen.x, candidate.screen.y)?.tagName === 'CANVAS'
          && seatDistance(candidate.screen) >= 16
        ))
        .sort((left, right) => Math.hypot(left.screen.x - 900, left.screen.y - 520) - Math.hypot(right.screen.x - 900, right.screen.y - 520))[0] ?? null
    })
    expect(target, `${roomId} needs a visible real-mouse floor target`).not.toBeNull()
    await page.mouse.click(target!.screen.x, target!.screen.y)
    await expect.poll(() => page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().state), { timeout: 30_000 }).toBe('ready')
    await page.screenshot({ path: path.join(OUTPUT, `${roomId}-standing.png`) })
  }
})
