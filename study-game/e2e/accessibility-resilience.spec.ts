import { expect, test } from '@playwright/test'

test('HUD panels keep keyboard focus visible and return it after Escape', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop keyboard acceptance')
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  const chatToggle = page.getByRole('button', { name: 'Chat', exact: true })
  await chatToggle.focus()
  // Re-enter the control through the keyboard so :focus-visible is tested
  // with the same modality a keyboard user actually produces.
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(chatToggle).toBeFocused()
  const focusRing = await chatToggle.evaluate((element) => {
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth), color: style.outlineColor }
  })
  expect(focusRing.style).not.toBe('none')
  expect(focusRing.width).toBeGreaterThanOrEqual(2)

  await page.keyboard.press('Enter')
  await expect(chatToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#chat-panel')).toBeVisible()

  await page.getByLabel('Chat message').focus()
  await page.keyboard.press('Escape')
  await expect(page.locator('#chat-panel')).toBeHidden()
  await expect(chatToggle).toBeFocused()
})

test('mobile HUD has no horizontal leak and keeps primary targets thumb-sized', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile resilience acceptance')
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  const metrics = await page.evaluate(() => {
    const selectors = ['.action-dock .dock-button', '.room-tabs button', '.radio-toggle']
    const targets = selectors.flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)])
      .filter((element) => {
        const style = getComputedStyle(element)
        const box = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0
      })
      .map((element) => {
        const box = element.getBoundingClientRect()
        return { id: element.id || element.textContent?.trim(), width: box.width, height: box.height }
      })
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      targets,
    }
  })

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth)
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth)
  expect(metrics.targets.length).toBeGreaterThanOrEqual(8)
  for (const target of metrics.targets) {
    expect(target.width, `${target.id} width`).toBeGreaterThanOrEqual(44)
    expect(target.height, `${target.id} height`).toBeGreaterThanOrEqual(44)
  }
})
