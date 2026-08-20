import { chromium } from '@playwright/test'

const browser = await chromium.launch({ headless: false })

try {
  const desktop = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  desktop.setDefaultNavigationTimeout(90_000)
  await desktop.goto('http://127.0.0.1:4178/?view=home', { waitUntil: 'domcontentloaded' })
  await desktop.locator('html[data-study-ready="home"]').waitFor({ state: 'attached' })
  await desktop.locator('#home-room-list .home-room-card').first().waitFor({ state: 'visible' })
  const desktopState = await desktop.evaluate(() => ({
    rooms: document.querySelectorAll('#home-room-list .home-room-card').length,
    rankingRows: document.querySelectorAll('#home-ranking-list li').length,
    overflow: document.querySelector('.study-home').scrollWidth - document.querySelector('.study-home').clientWidth,
  }))
  if (desktopState.rooms !== 5 || desktopState.rankingRows < 1 || desktopState.overflow > 1) {
    throw new Error(`Desktop home QA failed: ${JSON.stringify(desktopState)}`)
  }
  await desktop.screenshot({ path: 'test-results/home-dashboard-desktop.png', fullPage: true })
  await desktop.locator('[data-room-id="learning-lab"]').click()
  await desktop.locator('html[data-study-ready="true"][data-room-id="learning-lab"]').waitFor({ state: 'attached' })

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  mobile.setDefaultNavigationTimeout(90_000)
  await mobile.goto('http://127.0.0.1:4178/?view=home', { waitUntil: 'domcontentloaded' })
  await mobile.locator('html[data-study-ready="home"]').waitFor({ state: 'attached' })
  const mobileOverflow = await mobile.evaluate(() => document.querySelector('.study-home').scrollWidth - document.querySelector('.study-home').clientWidth)
  if (mobileOverflow > 1) throw new Error(`Mobile home overflowed by ${mobileOverflow}px`)
  await mobile.screenshot({ path: 'test-results/home-dashboard-mobile.png', fullPage: true })
  await mobile.locator('#home-enter-primary').click()
  await mobile.locator('html[data-study-ready="true"][data-room-id="library"]').waitFor({ state: 'attached' })

  console.log(JSON.stringify({
    status: 'passed',
    headed: true,
    desktop: desktopState,
    mobile: { overflow: mobileOverflow },
    worldEntry: ['learning-lab', 'library'],
  }, null, 2))
} finally {
  await browser.close()
}
