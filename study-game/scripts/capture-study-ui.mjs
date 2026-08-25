import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

import { chromium, devices } from '@playwright/test'

const BASE_URL = process.argv[2]
const OUTPUT = process.argv[3]
if (!BASE_URL || !OUTPUT) throw new Error('Usage: node scripts/capture-study-ui.mjs <base-url> <output-directory>')

await fs.mkdir(OUTPUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const metrics = {}

async function captureLocked(name, options) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.locator('.study-gate').waitFor({ timeout: 30_000 })
    await page.screenshot({ path: path.join(OUTPUT, `${name}-entry.png`) })
    await page.getByRole('button', { name: /^Log in/i }).first().click()
    await page.locator('form[data-study-auth-form="login"]').waitFor()
    await page.screenshot({ path: path.join(OUTPUT, `${name}-login.png`) })
    metrics[`${name}Login`] = await page.evaluate(() => {
      const card = document.querySelector('.study-entry-card')?.getBoundingClientRect()
      const inputs = [...document.querySelectorAll('.study-auth-form input')].map((node) => node.getBoundingClientRect().height)
      const buttons = [...document.querySelectorAll('.study-auth-submit, .study-auth-tedu')].map((node) => node.getBoundingClientRect().height)
      return {
        viewport: { width: innerWidth, height: innerHeight },
        card: card ? { x: card.x, y: card.y, width: card.width, height: card.height } : null,
        inputs,
        buttons,
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      }
    })
    assert.equal(metrics[`${name}Login`].horizontalOverflow, 0)
  } finally {
    await context.close()
  }
}

async function captureGame(name, options) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  await page.addInitScript(() => {
    let nonce = 1
    const response = (data) => Promise.resolve(new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    window.RadioTEDUStudyBridge = {
      apiBase: '/jukebox/api/v1/study',
      account: { id: 'ui-audit', displayName: 'UI Audit', authenticated: true },
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
        if (url.pathname.endsWith('/sessions/start')) return response({ session: { id: 'ui-audit-session' }, nonce: `nonce-${nonce++}` })
        if (/\/sessions\/[^/]+\/heartbeat$/.test(url.pathname)) return response({ nonce: `nonce-${nonce++}`, accepted_seconds: 1 })
        if (/\/sessions\/[^/]+\/finish$/.test(url.pathname)) return response({ points: { spendable_points: 240 } })
        return response({})
      },
    }
  })
  try {
    const url = new URL(BASE_URL)
    url.searchParams.set('room', 'learning-lab')
    url.searchParams.set('ui-audit', Date.now().toString())
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })
    await page.screenshot({ path: path.join(OUTPUT, `${name}-game.png`) })
    metrics[`${name}Game`] = await page.evaluate(() => {
      const box = (selector) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect()
        return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
      }
      return {
        viewport: { width: innerWidth, height: innerHeight },
        bar: box('.study-bar'),
        account: box('.account-chip'),
        rail: box('.world-rail'),
        roomTabs: [...document.querySelectorAll('.world-rail .room-tabs button')].map((node) => {
          const rect = node.getBoundingClientRect()
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        }),
        dock: box('.action-dock'),
        dockButtons: [...document.querySelectorAll('.action-dock .dock-button')].map((node) => {
          const rect = node.getBoundingClientRect()
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        }),
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      }
    })
    assert.equal(metrics[`${name}Game`].horizontalOverflow, 0)
    const { dock, dockButtons } = metrics[`${name}Game`]
    assert.ok(dock, `${name}: action dock is missing`)
    assert.ok(
      dockButtons.every((button) => button.y >= dock.y - 0.5 && button.y + button.height <= dock.y + dock.height + 0.5),
      `${name}: an action button spills vertically outside the dock`,
    )
    if (name === 'desktop') {
      const { account, bar, rail, roomTabs } = metrics[`${name}Game`]
      assert.ok(account && bar && rail, 'desktop: HUD frame is incomplete')
      assert.ok(
        account.x >= bar.x - 0.5 && account.y >= bar.y - 0.5
          && account.x + account.width <= bar.x + bar.width + 0.5
          && account.y + account.height <= bar.y + bar.height + 0.5,
        'desktop: account control spills outside the top bar',
      )
      assert.equal(roomTabs.length, 5, 'desktop: every room tab must remain visible')
      assert.ok(
        roomTabs.every((tab) => tab.y >= rail.y - 0.5 && tab.y + tab.height <= rail.y + rail.height + 0.5),
        'desktop: a room tab spills outside the campus rail',
      )
    }
  } finally {
    await context.close()
  }
}

try {
  await captureLocked('desktop', { viewport: { width: 1440, height: 900 } })
  await captureLocked('mobile', { ...devices['Pixel 7'] })
  await captureGame('desktop', { viewport: { width: 1440, height: 900 } })
  await captureGame('mobile', { ...devices['Pixel 7'] })
  await fs.writeFile(path.join(OUTPUT, 'metrics.json'), JSON.stringify(metrics, null, 2))
  console.log(`STUDY_UI_CAPTURE_OK output=${OUTPUT}`)
} finally {
  await browser.close()
}
