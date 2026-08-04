import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const artifactDir = path.resolve('..', 'artifacts', 'study-game', 'hud-chat')
fs.mkdirSync(artifactDir, { recursive: true })

test('presents an immersive game HUD and room-scoped working chat', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = async function playForStudyTest() {
      return undefined
    }
  })
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  await expect(page.locator('.action-dock')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Campus' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Chat' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'People' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Wardrobe' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Events' })).toBeVisible()
  await expect(page.getByTestId('radio-player')).toBeVisible()
  await expect(page.getByTestId('radio-player')).toContainText('RadioTEDU')
  await expect(page.locator('html')).toHaveAttribute('data-campus-cats', '1')
  await page.getByRole('button', { name: 'Play RadioTEDU' }).click()
  await expect(page.getByTestId('radio-player')).toHaveAttribute('data-playing', 'true')
  await expect(page.locator('#radio-status')).toContainText('On air')
  await page.getByRole('button', { name: 'Pause RadioTEDU' }).click()
  await expect(page.getByTestId('radio-player')).toHaveAttribute('data-playing', 'false')

  await page.getByRole('button', { name: 'Campus' }).click()
  await expect(page.locator('#navigator-panel')).toBeVisible()
  await expect(page.getByTestId('navigator-room-list').locator('.navigator-room-card')).toHaveCount(4)
  await page.getByLabel('Search places').fill('Çim')
  await expect(page.getByTestId('navigator-room-list').locator('.navigator-room-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Close campus navigator' }).click()

  await page.getByRole('button', { name: 'People' }).click()
  await page.getByTestId('presence-local-selin').click()
  await page.getByTestId('player-ignore').click()
  await expect(page.getByTestId('player-ignore')).toHaveText('Unignore')
  await page.getByTestId('player-report').click()
  await expect(page.locator('#player-report-controls')).toBeVisible()
  await page.locator('#player-report-reason').selectOption('spam')
  await page.locator('#player-report-controls').getByRole('button', { name: 'Send report' }).click()
  await expect(page.locator('#player-report-controls')).toBeHidden()
  await page.getByTestId('player-ignore').click()
  await expect(page.getByTestId('player-ignore')).toHaveText('Ignore')
  await page.getByRole('button', { name: 'Close player' }).click()

  await page.getByRole('button', { name: 'Events' }).click()
  await page.getByRole('button', { name: 'Study Path' }).click()
  await expect(page.getByTestId('study-path-list').locator('.study-path-card')).toHaveCount(4)
  await expect(page.getByTestId('study-path-list')).toContainText('Focus for 25 Minutes')
  await page.getByRole('button', { name: 'Close events' }).click()
  await expect(page.locator('.authority-chip')).toHaveAttribute('data-authority', 'preview')
  await expect(page.locator('html')).toHaveAttribute('data-study-authority', 'preview')
  expect(await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }))).toEqual({
    page: page.viewportSize()!.width,
    viewport: page.viewportSize()!.width,
  })
  if (testInfo.project.name === 'desktop-chromium') {
    const stage = await page.locator('#study-game').boundingBox()
    expect(stage).not.toBeNull()
    expect(stage!.width / stage!.height).toBeCloseTo(16 / 9, 2)
    const canvas = await page.locator('#game-canvas canvas').boundingBox()
    expect(canvas).not.toBeNull()
    expect(canvas!.width).toBeCloseTo(stage!.width - 2, 0)
    expect(canvas!.height).toBeCloseTo(stage!.height - 2, 0)
  }
  await page.screenshot({ path: path.join(artifactDir, `${testInfo.project.name}-01-hud.png`) })

  await page.getByRole('button', { name: 'Chat' }).click()
  await expect(page.locator('#chat-panel')).toBeVisible()
  await expect(page.locator('#chat-connection')).toContainText('LIVE')
  await page.locator('[data-chat-reaction="📚"]').click()
  await expect(page.getByTestId('chat-log')).toContainText('📚')
  await expect(page.locator('html')).toHaveAttribute('data-study-goals-complete', '1')
  await page.getByLabel('Chat message').fill('Hello from the Library')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByTestId('chat-log')).toContainText('Hello from the Library')
  await expect(page.locator('.chat-message[data-own="true"]')).toHaveCount(2)
  await expect(page.locator('#chat-feedback')).toContainText('Delivered')
  await expect(page.locator('html')).toHaveAttribute('data-chat-bubble', 'Hello from the Library')
  await expect(page.locator('html')).toHaveAttribute('data-chat-speaker', 'TEDU Student')

  await page.getByLabel('Chat message').fill('<img src=x onerror=alert(1)>')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByTestId('chat-log')).toContainText('<img src=x onerror=alert(1)>')
  await expect(page.locator('#chat-log img')).toHaveCount(0)
  await page.screenshot({ path: path.join(artifactDir, `${testInfo.project.name}-02-chat.png`) })

  await page.getByRole('button', { name: 'Close chat' }).click()
  await page.getByRole('tab', { name: 'Çim Alan' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-room-id', 'chim-alan')
  await expect(page.locator('html')).toHaveAttribute('data-campus-cats', '2')
  await expect(page.locator('#room-arrival-title')).toHaveText('Çim Alan')
  await expect(page.locator('#room-arrival')).toBeVisible()
  await page.getByRole('button', { name: 'Chat' }).click()
  await expect(page.getByTestId('chat-log')).not.toContainText('Hello from the Library')
  await expect(page.locator('#chat-room-label')).toContainText('ÇIM ALAN')

  await page.getByRole('button', { name: 'Close chat' }).click()
  await page.getByRole('tab', { name: 'Library' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-room-id', 'library')
  await page.getByRole('button', { name: 'Chat' }).click()
  await expect(page.getByTestId('chat-log')).toContainText('Hello from the Library', { timeout: 10_000 })
})

test('turns sitting in the Library into a clear focus-session experience', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  await page.evaluate(() => window.__STUDY_GAME_APP__.walkToSeat('front-left'))
  await expect(page.locator('html')).toHaveAttribute('data-game-state', 'seated', { timeout: 30_000 })
  await expect(page.locator('html')).toHaveAttribute('data-study-active', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-study-counting', 'true')
  await expect(page.locator('#study-phase')).toHaveText('FOCUSING NOW')
  await expect(page.locator('#study-mission-kicker')).toHaveText('PREVIEW SESSION')
  await expect(page.locator('#study-mission-title')).toHaveText('Focus session in progress')
  await expect.poll(async () => page.getByTestId('study-timer').textContent(), { timeout: 5_000 }).not.toBe('00:00:00')
  await page.screenshot({ path: path.join(artifactDir, `${testInfo.project.name}-03-studying.png`) })

  await page.evaluate(() => window.__STUDY_GAME_APP__.stand())
  await expect(page.locator('html')).toHaveAttribute('data-game-state', 'ready', { timeout: 10_000 })
  await expect(page.locator('#study-phase')).toHaveText('FOCUS READY')
})
