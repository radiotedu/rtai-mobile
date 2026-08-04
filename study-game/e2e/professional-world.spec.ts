import { expect, test, type Page, type TestInfo } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const artifactDir = path.resolve(process.cwd(), '../artifacts/study-game/professional-world')

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-${name}.png`),
    animations: 'disabled',
  })
}

test.beforeAll(() => fs.mkdirSync(artifactDir, { recursive: true }))

test('professional campus world evidence', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-study-ready', 'true', { timeout: 30_000 })
  await expect(page.locator('html')).toHaveAttribute('data-room-id', 'library')
  await expect(page.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('event-list')).toContainText('Campus Care Saturday')
  await expect(page.getByTestId('event-list')).toContainText('TEDU Live: Auditorium')

  const initial = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }))
  expect(layout.page).toBeLessThanOrEqual(layout.viewport)
  await capture(page, testInfo, '01-library')

  await page.getByTestId('events-toggle').click()
  await expect(page.getByTestId('event-list')).toBeVisible()
  await capture(page, testInfo, '02-events')
  await page.getByLabel('Close events').click()

  await page.getByTestId('wardrobe-toggle').click()
  await expect(page.locator('#wardrobe-avatar-preview')).toBeVisible()
  await expect(page.locator('[data-avatar-preview-layer="top"]')).toHaveCSS('background-image', /top-radio-hoodie-idle/)
  await page.getByTestId('wearable-beanie').click()
  await expect(page.locator('html')).toHaveAttribute('data-hat-id', 'beanie')
  await page.locator('#wardrobe-panel').evaluate((panel) => { panel.scrollTop = 0 })
  await capture(page, testInfo, '03-wardrobe')
  await page.getByLabel('Close wardrobe').click()

  await page.keyboard.press('KeyW')
  await expect.poll(async () => (await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())).nodeId, {
    timeout: 20_000,
  }).not.toBe(initial.nodeId)
  await capture(page, testInfo, '04-keyboard-movement')

  await page.getByRole('tab', { name: 'Çim Alan' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-room-id', 'chim-alan')
  await expect(page.locator('#room-title')).toHaveText('Çim Alan')
  await capture(page, testInfo, '05-chim-alan')

  await page.getByRole('tab', { name: 'Sports Center' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-room-id', 'sports-center')
  await expect(page.locator('#room-title')).toHaveText('Sports Center')
  const sportsEntrance = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())
  await page.evaluate(() => window.__STUDY_GAME_APP__.walkToNode('center-floor'))
  await expect.poll(async () => (await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())).nodeId, {
    timeout: 20_000,
  }).not.toBe(sportsEntrance.nodeId)
  await capture(page, testInfo, '06-sports-center')

  await page.getByRole('tab', { name: 'Auditorium' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-room-id', 'auditorium')
  await expect(page.locator('#room-title')).toHaveText('Fatma–Semih Akbil Auditorium')
  await expect(page.locator('html')).toHaveAttribute('data-auditorium-screen', 'tedu')
  await capture(page, testInfo, '07-auditorium')

  await expect.poll(
    async () => page.locator('html').getAttribute('data-auditorium-screen'),
    { timeout: 8_000 },
  ).toBe('radiotedu')
  await capture(page, testInfo, '08-auditorium-event-screen')

  await page.evaluate(() => window.__STUDY_GAME_APP__.walkToSeat('auditorium-lower'))
  await expect(page.locator('html')).toHaveAttribute('data-game-state', 'seated', { timeout: 30_000 })
  await expect(page.locator('#study-timer')).toHaveAttribute('data-running', 'true')
  await capture(page, testInfo, '09-auditorium-study')

  const video = page.video()
  await page.close()
  if (video) await video.saveAs(path.join(artifactDir, `${testInfo.project.name}-walkthrough.webm`))
})
