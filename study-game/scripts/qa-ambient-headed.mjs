import { chromium } from '@playwright/test'
import sharp from 'sharp'

const rooms = ['library', 'chim-alan', 'sports-center', 'auditorium', 'learning-lab']
const browser = await chromium.launch({ headless: false })

async function changedPixelRatio(first, second) {
  const left = await sharp(first).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const right = await sharp(second).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  if (left.info.width !== right.info.width || left.info.height !== right.info.height) throw new Error('Ambient screenshots changed size')
  let changed = 0
  for (let index = 0; index < left.data.length; index += 3) {
    const difference = Math.abs(left.data[index] - right.data[index])
      + Math.abs(left.data[index + 1] - right.data[index + 1])
      + Math.abs(left.data[index + 2] - right.data[index + 2])
    if (difference >= 12) changed += 1
  }
  return changed / (left.info.width * left.info.height)
}

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' })
  page.setDefaultNavigationTimeout(90_000)
  const report = []
  for (const room of rooms) {
    await page.goto(`http://127.0.0.1:4178/?room=${room}`, { waitUntil: 'domcontentloaded' })
    await page.locator('html[data-study-ready="true"]').waitFor({ state: 'attached' })
    try {
      await page.locator('html[data-ambient-motion="animated"]').waitFor({ state: 'attached', timeout: 10_000 })
    } catch {
      const runtimeState = await page.evaluate(() => ({
        dataset: { ...document.documentElement.dataset },
        roomTitle: document.querySelector('[data-room-title]')?.textContent ?? null,
      }))
      throw new Error(`Ambient runtime did not become ready: ${JSON.stringify(runtimeState)}`)
    }
    const canvas = page.locator('#game-canvas canvas')
    await canvas.waitFor({ state: 'visible' })
    const ambientState = await page.evaluate(() => ({
      ambientObjects: Number(document.documentElement.dataset.ambientObjects),
      label: document.documentElement.dataset.roomAmbience ?? null,
    }))
    const first = await canvas.screenshot()
    await page.waitForTimeout(1_400)
    const second = await canvas.screenshot()
    if (room === 'learning-lab') {
      await page.screenshot({ path: 'test-results/ambient-learning-lab.png', fullPage: false })
    }
    const changedRatio = await changedPixelRatio(first, second)
    const { ambientObjects, label } = ambientState
    if (!label || ambientObjects < 1 || ambientObjects > 12 || changedRatio < 0.00001) {
      throw new Error(`Ambient QA failed for ${room}`)
    }
    report.push({ room, label, ambientObjects, changedPixelPercent: Number((changedRatio * 100).toFixed(3)) })
  }

  const reducedPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await reducedPage.goto('http://127.0.0.1:4178/?room=library', { waitUntil: 'domcontentloaded' })
  await reducedPage.locator('html[data-ambient-motion="reduced"]').waitFor({ state: 'attached' })
  console.log(JSON.stringify({ status: 'passed', headed: true, rooms: report, reducedMotion: 'passed' }, null, 2))
} finally {
  await browser.close()
}
