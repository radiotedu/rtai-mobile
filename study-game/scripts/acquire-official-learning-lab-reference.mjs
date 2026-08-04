import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const sourceUrl = 'https://ece.tedu.edu.tr/sites/default/files/inline-images/whatsapp-image-2023-11-02-at-11.40.00.jpeg'
const outputPath = path.resolve('assets', 'sources', 'tedu-official', 'early-childhood-learning-lab.png')
await mkdir(path.dirname(outputPath), { recursive: true })

const browser = await chromium.launch({ headless: false })
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  await page.goto(sourceUrl, { waitUntil: 'networkidle' })
  const image = page.locator('img')
  await image.waitFor({ state: 'visible' })
  await image.screenshot({ path: outputPath })
  console.log(`Official TEDU learning-lab reference saved to ${outputPath}`)
} finally {
  await browser.close()
}
