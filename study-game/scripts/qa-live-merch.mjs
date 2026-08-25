import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const liveUrl = process.env.STUDY_LIVE_URL ?? 'https://radiotedu.com/study/'
const output = process.env.STUDY_LIVE_AUDIT_OUTPUT
  ?? 'C:/Users/tuna.ozsari/Desktop/artifacts/study-merch-audit-20260821/live'
fs.mkdirSync(output, { recursive: true })

const browser = await chromium.launch({ headless: true })
const results = []

for (const profile of [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
]) {
  const { name: profileName, ...contextOptions } = profile
  const context = await browser.newContext(contextOptions)
  await context.addInitScript(() => {
    const response = (data, status = 200) => Promise.resolve(new Response(JSON.stringify({ success: true, data }), {
      status, headers: { 'Content-Type': 'application/json' },
    }))
    const owned = ['short-hair', 'radio-hoodie', 'varsity-jacket', 'jeans', 'black-cargos', 'sneakers', 'boots', 'bucket-hat', 'beanie']
    const computers = [
      { item_id: 'campus-computer', title: 'Campus Laptop', description: 'Starter computer.', kind: 'computer', cost_points: 0, rarity: 'common', asset_key: 'computer-basic', owned: true, equipped: true },
      { item_id: 'studybook-pro', title: 'StudyBook Pro', description: 'Study upgrade.', kind: 'computer', cost_points: 120, rarity: 'rare', asset_key: 'computer-pro', owned: false, equipped: false },
      { item_id: 'gold-scholar', title: 'Gold Scholar', description: 'Gold edition.', kind: 'computer', cost_points: 220, rarity: 'legendary', asset_key: 'computer-studio', owned: false, equipped: false },
    ]
    let gold = 500
    window.RadioTEDUStudyBridge = {
      apiBase: '/jukebox/api/v1/study',
      account: { id: 'live-merch-audit', displayName: 'Live Merch Audit', authenticated: true },
      globalPoints: 500,
      request: async (input, init = {}) => {
        const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin)
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : {}
        if (url.pathname.endsWith('/avatar/me')) return response({
          ownedItemIds: owned,
          equipped: {},
          points: { spendable_points: 500 },
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
        if (url.pathname.endsWith('/avatar/equip')) return response({})
        if (url.pathname.endsWith('/sessions/start')) return response({ session: { id: 'live-merch-session' }, nonce: 'live-merch-nonce-1' }, 201)
        if (/\/sessions\/[^/]+\/heartbeat$/.test(url.pathname)) return response({ nonce: 'live-merch-nonce-2', accepted_seconds: 1 })
        if (/\/sessions\/[^/]+\/finish$/.test(url.pathname)) return response({ points: { spendable_points: 500 } })
        if (url.pathname.endsWith('/economy/study/shop') && (init.method ?? 'GET') === 'GET') {
          return response({ items: computers, gold_balance: gold })
        }
        const purchaseMatch = url.pathname.match(/\/economy\/study\/shop\/([^/]+)\/purchase$/)
        if (purchaseMatch) {
          const item = computers.find((candidate) => candidate.item_id === decodeURIComponent(purchaseMatch[1]))
          if (item && !item.owned) {
            gold -= item.cost_points
            item.owned = true
          }
          return response({ gold_balance: gold }, 201)
        }
        const equipMatch = url.pathname.match(/\/economy\/study\/shop\/([^/]+)\/equip$/)
        if (equipMatch) {
          const item = computers.find((candidate) => candidate.item_id === decodeURIComponent(equipMatch[1]))
          for (const candidate of computers) candidate.equipped = candidate === item
          return response({})
        }
        return response({})
      },
    }
  })

  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('crash', () => errors.push('page crashed'))
  await page.goto(`${liveUrl}?room=library&live-merch-audit=${Date.now()}`, { waitUntil: 'domcontentloaded' })
  const enterLibrary = page.getByRole('button', { name: /Enter Library/i })
  if (await enterLibrary.isVisible().catch(() => false)) await enterLibrary.click()
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Wardrobe' }).click()
  for (const [slot, id] of [
    ['top', 'varsity-jacket'],
    ['bottom', 'black-cargos'],
    ['shoes', 'boots'],
    ['hat', 'beanie'],
  ]) {
    const button = page.getByTestId(`wearable-${id}`)
    await button.click()
    await page.locator('html').waitFor()
    if (await page.locator('html').getAttribute(`data-${slot}-id`) !== id) {
      throw new Error(`${profileName}: ${slot} did not equip ${id} through the live Wardrobe`)
    }
  }
  await page.getByLabel('Close wardrobe').click()

  if (profileName === 'desktop') {
    const target = { x: 687.7482057416269, y: 301.2117224880382 }
    if (await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, target) !== 'CANVAS') {
      throw new Error('desktop: audited front-left click point no longer reaches the live canvas')
    }
    await page.mouse.click(target.x, target.y)
    await page.locator('html[data-game-state="seated"][data-seated-seat-id="front-left"]').waitFor({ timeout: 30_000 })
    await page.locator('#study-timer[data-running="true"]').waitFor({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Campus Shop' }).click()
    const computer = page.locator('[data-computer-item="studybook-pro"]')
    await computer.waitFor({ state: 'visible', timeout: 10_000 })
    await computer.click()
    await page.waitForFunction(() => document.querySelector('[data-computer-item="studybook-pro"]')?.getAttribute('data-action') === 'equip')
    await computer.click()
    await page.waitForFunction(() => document.querySelector('[data-computer-item="studybook-pro"]')?.hasAttribute('disabled'))
    await page.getByLabel('Close Campus Shop').click()
  }

  const state = await page.evaluate(() => ({
    gameState: document.documentElement.dataset.gameState ?? null,
    seatId: document.documentElement.dataset.seatedSeatId ?? null,
    topId: document.documentElement.dataset.topId ?? null,
    bottomId: document.documentElement.dataset.bottomId ?? null,
    shoesId: document.documentElement.dataset.shoesId ?? null,
    hatId: document.documentElement.dataset.hatId ?? null,
  }))
  const screenshot = path.join(output, `${profileName}--premium-outfit--live.png`)
  await page.screenshot({ path: screenshot })
  results.push({ profile: profileName, url: page.url(), screenshot, errors, state })
  await context.close()
}

await browser.close()
fs.writeFileSync(path.join(output, 'audit.json'), JSON.stringify(results, null, 2))
console.log(JSON.stringify(results.map(({ profile, screenshot, errors, state }) => ({
  profile,
  screenshot,
  errors,
  state,
})), null, 2))
