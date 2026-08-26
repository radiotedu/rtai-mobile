import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const artifactDir = path.resolve('..', 'artifacts', 'study-game', 'pool-dive-animation')
fs.mkdirSync(artifactDir, { recursive: true })

async function openPoolDive(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })
  await page.locator('#events-toggle').click()
  await expect(page.locator('#events-panel')).toBeVisible()
  await page.locator('.events-view-tabs').getByRole('button', { name: 'Arcade', exact: true }).click()
  await expect(page.getByTestId('arcade-list')).toBeVisible()
  await page.getByRole('button', { name: 'Start verified game' }).click()
  await expect(page.locator('.pool-dive')).toHaveAttribute('data-arcade-state', 'active')
  await expect(page.locator('.pool-dive-stage')).toHaveAttribute('data-pool-motion', 'ready')
}

async function screenshotPanel(page: import('@playwright/test').Page, destination: string) {
  const panel = page.locator('#events-panel')
  const clip = await panel.boundingBox()
  if (!clip) throw new Error('Arcade panel is not visible')
  await page.screenshot({ path: destination, clip })
}

test('animates a verified dive and serializes rapid input', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await openPoolDive(page)

  const card = page.locator('.pool-dive')
  const stage = page.locator('.pool-dive-stage')
  const initialLayout = await page.locator('#events-panel').evaluate((panel) => {
    const header = panel.querySelector(':scope > header')!.getBoundingClientRect()
    const stage = panel.querySelector('.pool-dive-stage')!.getBoundingClientRect()
    const panelBounds = panel.getBoundingClientRect()
    return { headerBottom: header.bottom, stageTop: stage.top, stageBottom: stage.bottom, panelBottom: panelBounds.bottom }
  })
  expect(initialLayout.stageTop).toBeGreaterThanOrEqual(initialLayout.headerBottom)
  expect(initialLayout.stageBottom).toBeLessThanOrEqual(initialLayout.panelBottom)
  await screenshotPanel(page, path.join(artifactDir, `${testInfo.project.name}-01-ready.png`))

  const firstPrompt = await stage.getAttribute('data-pool-prompt')
  expect(['left', 'center', 'right']).toContain(firstPrompt)
  await page.locator(`[data-pool-choice="${firstPrompt}"]`).click()
  await expect(stage).toHaveAttribute('data-pool-motion', 'takeoff')
  expect(await card.locator('[data-pool-choice]').evaluateAll((buttons: HTMLButtonElement[]) => (
    buttons.every((button) => button.disabled)
  ))).toBe(true)
  await screenshotPanel(page, path.join(artifactDir, `${testInfo.project.name}-02-takeoff.png`))

  await expect(stage).toHaveAttribute('data-pool-motion', 'splash')
  await expect(stage).toHaveAttribute('data-pool-outcome', 'clean')
  await screenshotPanel(page, path.join(artifactDir, `${testInfo.project.name}-03-splash.png`))
  await expect(stage).toHaveAttribute('data-pool-motion', 'ready')
  await expect(page.locator('[data-pool-round]')).toContainText('2 / 8')

  const secondPrompt = await stage.getAttribute('data-pool-prompt')
  await page.locator(`[data-pool-choice="${secondPrompt}"]`).evaluate((button: HTMLButtonElement) => {
    button.click()
    button.click()
  })
  await expect(stage).toHaveAttribute('data-pool-motion', 'ready')
  await expect(page.locator('[data-pool-round]')).toContainText('3 / 8')
  await page.waitForTimeout(150)
  await expect(page.locator('[data-pool-round]')).toContainText('3 / 8')

  const layout = await card.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const laneButtons = [...element.querySelectorAll<HTMLButtonElement>('[data-pool-choice]')]
    return {
      cardInsideViewport: bounds.left >= 0 && bounds.right <= innerWidth,
      minimumTarget: Math.min(...laneButtons.map((button) => button.getBoundingClientRect().height)),
      documentOverflow: document.documentElement.scrollWidth - innerWidth,
    }
  })
  expect(layout.cardInsideViewport).toBe(true)
  expect(layout.minimumTarget).toBeGreaterThanOrEqual(44)
  expect(layout.documentOverflow).toBe(0)
})

test('reduced motion preserves the complete verified interaction', async ({ page }) => {
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openPoolDive(page)

  const stage = page.locator('.pool-dive-stage')
  const prompt = await stage.getAttribute('data-pool-prompt')
  await page.locator(`[data-pool-choice="${prompt}"]`).click()
  await expect(stage).toHaveAttribute('data-pool-motion', 'ready')
  await expect(page.locator('[data-pool-round]')).toContainText('2 / 8')
  await expect(page.locator('[data-pool-score]')).toHaveText('75')
})
