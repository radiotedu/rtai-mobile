import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const outputDir = path.resolve('test-results', 'headed-account-hud')
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: false })
try {
  const desktop = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  await desktop.goto('http://127.0.0.1:4179/?room=library', { waitUntil: 'networkidle' })
  await desktop.locator('.study-entry-card').waitFor({ state: 'visible' })
  await desktop.screenshot({ path: path.join(outputDir, 'desktop-entry.png') })

  await desktop.goto('http://127.0.0.1:4178/?room=library', { waitUntil: 'networkidle' })
  await desktop.locator('#account-toggle').waitFor({ state: 'visible' })
  await desktop.locator('#account-toggle').click()
  await desktop.locator('#account-panel').waitFor({ state: 'visible' })
  await desktop.screenshot({ path: path.join(outputDir, 'desktop-account-hud.png') })

  await desktop.goto('http://127.0.0.1:4178/?room=learning-lab', { waitUntil: 'networkidle' })
  await desktop.locator('.room-tabs button[data-room-id="learning-lab"][aria-selected="true"]').waitFor({ state: 'visible' })
  await desktop.screenshot({ path: path.join(outputDir, 'desktop-learning-lab.png') })

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await mobile.goto('http://127.0.0.1:4179/?room=library', { waitUntil: 'networkidle' })
  await mobile.locator('.study-entry-card').waitFor({ state: 'visible' })
  await mobile.screenshot({ path: path.join(outputDir, 'mobile-entry.png') })

  console.log(`Headed visual QA captured 4 states in ${outputDir}`)
} finally {
  await browser.close()
}
