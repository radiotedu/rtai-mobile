import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

import { chromium } from '@playwright/test'

const LIVE_URL = 'https://radiotedu.com/study/?room=learning-lab&audit=room-scale-fixes-r1'
const OUTPUT = 'C:/Users/tuna.ozsari/Desktop/artifacts/study-room-scale-audit-20260821/live'
const EXPECTED_GAME_ASSET = 'game-Cd0cEq3G.js'
const FLOOR_TARGET = { x: 554.8708133971292, y: 599.2183014354066 }
const WINDOW_CHAIR_TARGET = { x: 245.46000000000004, y: 458.09305023923446 }

await fs.mkdir(OUTPUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('crash', () => pageErrors.push('page crashed'))

await page.addInitScript(() => {
  let nonce = 1
  const response = (data) => Promise.resolve(new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))

  window.RadioTEDUStudyBridge = {
    apiBase: '/jukebox/api/v1/study',
    account: { id: 'visual-audit', displayName: 'Visual Audit', authenticated: true },
    globalPoints: 240,
    request: async (input, init = {}) => {
      const rawUrl = input instanceof Request ? input.url : input.toString()
      const url = new URL(rawUrl, window.location.origin)
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : {}
      if (url.pathname.endsWith('/avatar/me')) return response({
        ownedItemIds: ['default-hair', 'default-top', 'default-bottom', 'default-shoes', 'bucket-hat'],
        equipped: { hair: 'default-hair', top: 'default-top', bottom: 'default-bottom', shoes: 'default-shoes', hat: 'bucket-hat' },
        points: { spendable_points: 240 },
      })
      if (url.pathname.endsWith('/summary')) return response({ todaySeconds: 0, monthSeconds: 0, totalSeconds: 0 })
      if (url.pathname.endsWith('/instances/join')) {
        const roomId = body.roomId ?? 'learning-lab'
        return response({ instance: { id: `${roomId}-1`, roomId, number: 1, occupancy: 1, capacity: 60 } })
      }
      if (url.pathname.endsWith('/presence')) return response({ presence: [] })
      if (url.pathname.endsWith('/presence/heartbeat')) return response({})
      if (url.pathname.endsWith('/chat')) return response({ messages: [] })
      if (url.pathname.endsWith('/events')) return response({ events: [] })
      if (url.pathname.endsWith('/sessions/start')) return response({ session: { id: 'visual-audit-session' }, nonce: `nonce-${nonce++}` })
      if (/\/sessions\/[^/]+\/heartbeat$/.test(url.pathname)) return response({ nonce: `nonce-${nonce++}`, accepted_seconds: 1 })
      if (/\/sessions\/[^/]+\/finish$/.test(url.pathname)) return response({ points: { spendable_points: 240 } })
      return response({})
    },
  }
})

try {
  await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  if (await page.locator('html').getAttribute('data-room-id') !== 'learning-lab') {
    await page.getByRole('tab', { name: 'Learning Lab' }).click()
    await page.locator('html[data-room-id="learning-lab"]').waitFor({ timeout: 30_000 })
  }

  const gameAsset = await page.evaluate((expected) => performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .find((name) => name.includes(expected)) ?? null, EXPECTED_GAME_ASSET)
  assert(gameAsset, `expected live game asset ${EXPECTED_GAME_ASSET}`)

  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, FLOOR_TARGET), 'CANVAS')
  await page.mouse.click(FLOOR_TARGET.x, FLOOR_TARGET.y)
  await page.locator('html[data-game-state="ready"]').waitFor({ timeout: 30_000 })
  await page.screenshot({ path: path.join(OUTPUT, 'live-learning-lab-standing-near-chairs.png') })

  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, WINDOW_CHAIR_TARGET), 'CANVAS')
  await page.mouse.click(WINDOW_CHAIR_TARGET.x, WINDOW_CHAIR_TARGET.y)
  await page.locator('html[data-game-state="seated"][data-seated-seat-id="window-chair"]').waitFor({ timeout: 30_000 })
  await page.screenshot({ path: path.join(OUTPUT, 'live-learning-lab-window-chair-seated.png') })

  assert.deepEqual(pageErrors, [], `live page errors: ${pageErrors.join('; ')}`)
  await fs.writeFile(path.join(OUTPUT, 'live-verification.json'), JSON.stringify({
    url: LIVE_URL,
    release: '20260821-study-room-scale-fixes-r1',
    expectedGameAsset: EXPECTED_GAME_ASSET,
    gameAsset,
    realMouseTargets: {
      floor: FLOOR_TARGET,
      windowChair: WINDOW_CHAIR_TARGET,
    },
    pageErrors,
    verifiedAt: new Date().toISOString(),
  }, null, 2))
  console.log('LIVE_ROOM_SCALE_OK release=20260821-study-room-scale-fixes-r1 real_mouse_walk=1 real_mouse_seat=1 page_errors=0')
} finally {
  await browser.close()
}
