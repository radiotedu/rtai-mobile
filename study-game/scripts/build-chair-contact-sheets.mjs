import fs from 'node:fs/promises'
import path from 'node:path'

import { chromium } from '@playwright/test'

const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/build-chair-contact-sheets.mjs <chair-audit-directory>')

const audit = JSON.parse(await fs.readFile(path.join(input, 'audit.json'), 'utf8'))
const output = path.join(input, 'contact-sheets')
await fs.mkdir(output, { recursive: true })

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 930 }, deviceScaleFactor: 1 })
  for (const roomId of Object.keys(audit.inventory)) {
    const seats = audit.audit.filter((entry) => entry.roomId === roomId)
    for (let index = 0; index < seats.length; index += 4) {
      const chunk = seats.slice(index, index + 4)
      const figures = await Promise.all(chunk.map(async (entry) => {
        const image = `data:image/png;base64,${(await fs.readFile(path.join(input, entry.screenshot))).toString('base64')}`
        return `<figure><img src="${image}" alt=""><figcaption>${entry.roomId} · ${entry.seatId}<span>${entry.timerAfter}</span></figcaption></figure>`
      }))
      await page.setContent(`<!doctype html>
        <style>
          * { box-sizing: border-box }
          html, body { width: 1440px; min-height: 930px; margin: 0; background: #061412; color: #eafff6; font: 700 15px/1.2 Arial, sans-serif }
          main { display: grid; grid-template-columns: repeat(2, 1fr); grid-auto-rows: 450px; gap: 10px; padding: 10px }
          figure { position: relative; margin: 0; overflow: hidden; border: 2px solid #75e8bf; background: #0a1c19 }
          img { width: 100%; height: 100%; object-fit: contain; display: block }
          figcaption { position: absolute; inset: 0 0 auto 0; display: flex; justify-content: space-between; padding: 9px 12px; background: rgba(2, 13, 12, .9); letter-spacing: .02em }
          figcaption span { color: #83f4ca }
        </style>
        <main>${figures.join('')}</main>`)
      await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0))
      const fileName = `${roomId}--${String(Math.floor(index / 4) + 1).padStart(2, '0')}.png`
      await page.screenshot({ path: path.join(output, fileName) })
    }
  }
} finally {
  await browser.close()
}

console.log(`CONTACT_SHEETS_OK output=${output}`)
