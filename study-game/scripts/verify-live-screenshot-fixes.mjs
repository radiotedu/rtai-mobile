import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

import { chromium } from '@playwright/test'

const LIVE_URL = 'https://radiotedu.com/study/?room=library&audit=screenshot-fixes-r1'
const OUTPUT = 'C:/Users/tuna.ozsari/Desktop/artifacts/study-screenshot-audit-20260821/live'

await fs.mkdir(OUTPUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 604, height: 187 } })
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
        const roomId = body.roomId ?? 'library'
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

  const viewport = page.viewportSize()
  const game = await page.locator('#study-game').boundingBox()
  const dock = await page.locator('.action-dock').boundingBox()
  assert(viewport && game && dock, 'viewport, game, and action dock must render')
  assert(Math.abs(game.height - viewport.height) <= 1, `game height ${game.height} must match viewport ${viewport.height}`)
  assert(dock.x >= 6 && dock.x + dock.width <= viewport.width - 6, 'action dock must fit horizontally')
  assert(dock.y >= 6 && dock.y + dock.height <= viewport.height - 6, 'action dock must fit vertically')
  await page.screenshot({ path: path.join(OUTPUT, 'live-short-viewport-action-dock.png') })

  await page.setViewportSize({ width: 604, height: 420 })
  await page.waitForTimeout(250)
  // These are the centres of two authored chair polygons at this verification
  // viewport. They come from the development-only tap-target oracle; production
  // remains closed and is exercised strictly through real pointer input.
  const seats = [
    { id: 'middle-back-right', label: 'far-side', x: 401.5, y: 166.93 },
    { id: 'front-desk', label: 'near-side', x: 432.52, y: 144.17 },
  ]
  for (const [index, target] of seats.entries()) {
    if (index > 0) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })
    }
    assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, target), 'CANVAS')
    await page.mouse.click(target.x, target.y)
    await page.locator(`html[data-game-state="seated"][data-seated-seat-id="${target.id}"]`).waitFor({ timeout: 30_000 })
    assert.equal(await page.getByTestId('player-card').isHidden(), true, 'chair click must not open a player profile')
    await page.screenshot({ path: path.join(OUTPUT, `live-library-${target.label}-seated.png`) })
  }

  assert.deepEqual(pageErrors, [], `live page errors: ${pageErrors.join('; ')}`)
  await fs.writeFile(path.join(OUTPUT, 'live-verification.json'), JSON.stringify({
    url: LIVE_URL,
    release: '20260821-study-screenshot-fixes-r1',
    verifiedAt: new Date().toISOString(),
    shortViewport: { viewport, game, dock },
    realMouseSeatDirections: seats.map(({ id, label }) => ({ id, label })),
    pageErrors,
  }, null, 2))
  console.log('LIVE_VERIFY_OK short_viewport=604x187 real_mouse_seats=2 page_errors=0')
} finally {
  await browser.close()
}
