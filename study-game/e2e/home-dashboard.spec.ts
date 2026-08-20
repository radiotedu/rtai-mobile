import { expect, test } from '@playwright/test'

test('authenticated-style home exposes rooms, ranking, events, and enters the world', async ({ page }) => {
  await page.goto('/?view=home')

  await expect(page.getByTestId('study-home')).toBeVisible()
  await expect(page.locator('#home-room-list .home-room-card')).toHaveCount(5)
  await expect(page.getByTestId('home-leaderboard').locator('li')).toHaveCount(5)
  await expect(page.locator('#home-account-name')).toHaveText('TEDU Student')
  await expect(page.locator('html')).toHaveAttribute('data-home-data', 'local')

  await page.getByRole('button', { name: 'Month' }).click()
  await expect(page.getByTestId('home-leaderboard').locator('li').first()).toContainText('Ece')

  await page.locator('[data-room-id="learning-lab"]').dblclick({ delay: 5 })
  await expect(page.locator('html')).toHaveAttribute('data-room-id', 'learning-lab')
  await expect(page.locator('html')).toHaveAttribute('data-study-ready', 'true')
  await expect(page.locator('#game-canvas canvas')).toHaveCount(1)
  await expect(page.locator('#game-canvas canvas')).toBeVisible()
})

test('mobile home remains usable and enters the default study room', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?view=home')

  await expect(page.getByTestId('study-home')).toBeVisible()
  const overflow = await page.evaluate(() => document.querySelector('.study-home')!.scrollWidth - document.querySelector('.study-home')!.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  await page.locator('#home-enter-primary').click()
  await expect(page.locator('html')).toHaveAttribute('data-room-id', 'library')
  await expect(page.locator('#game-canvas canvas')).toBeVisible()
})
