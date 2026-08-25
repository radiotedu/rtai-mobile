import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const artifactDir = path.resolve('..', 'artifacts', 'study-game', 'gold-store')
fs.mkdirSync(artifactDir, { recursive: true })

test.setTimeout(90_000)

const wardrobeItems = [
  { id: 'beanie', slot: 'hat', price: '35 Gold' },
  { id: 'radio-hoodie', slot: 'top', price: 'Included' },
  { id: 'radiotedu-tee', slot: 'top', price: '45 Gold' },
  { id: 'varsity-jacket', slot: 'top', price: '80 Gold' },
  { id: 'jeans', slot: 'bottom', price: 'Included' },
  { id: 'black-cargos', slot: 'bottom', price: '60 Gold' },
  { id: 'sneakers', slot: 'shoes', price: 'Included' },
  { id: 'boots', slot: 'shoes', price: '50 Gold' },
  { id: 'bucket-hat', slot: 'hat', price: 'Included' },
] as const

test('every wearable renders, equips, persists, walks, and sits on desktop and mobile', async ({ page }) => {
  await page.goto('/')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Wardrobe' }).click()

  for (const item of wardrobeItems) {
    const button = page.getByTestId(`wearable-${item.id}`)
    await expect(button.locator('small')).toHaveText(item.price)
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('html')).toHaveAttribute(`data-${item.slot}-id`, item.id)
    await expect(page.locator(`[data-avatar-preview-layer="${item.slot}"]`)).toHaveCSS('background-image', new RegExp(`${item.slot}-${item.id}-idle`))
    const texture = await page.evaluate((slot) => window.__STUDY_GAME_APP__.snapshot().layerTextures[slot], item.slot)
    if (!texture) throw new Error(`${item.id} is missing from the live avatar texture snapshot`)
    expect(texture, `${item.id} should be visible on the live avatar`).toContain(`${item.slot}-${item.id}-idle`)
  }

  await page.getByTestId('wearable-beanie').click()
  await expect(page.locator('html')).toHaveAttribute('data-hat-id', 'beanie')

  await page.getByLabel('Close wardrobe').click()
  await page.getByRole('tab', { name: 'Sports Center' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-room-id', 'sports-center')
  await expect(page.locator('html')).toHaveAttribute('data-top-id', 'varsity-jacket')
  await expect(page.locator('html')).toHaveAttribute('data-bottom-id', 'black-cargos')
  await expect(page.locator('html')).toHaveAttribute('data-shoes-id', 'boots')
  await expect(page.locator('html')).toHaveAttribute('data-hat-id', 'beanie')

  await page.getByRole('tab', { name: 'Library' }).click()
  await page.evaluate(() => window.__STUDY_GAME_APP__.walkToSeat('front-left'))
  await expect(page.locator('html')).toHaveAttribute('data-game-state', 'seated', { timeout: 30_000 })
  const seated = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())
  expect(seated).toMatchObject({
    state: 'seated', topId: 'varsity-jacket', bottomId: 'black-cargos', shoesId: 'boots', hatId: 'beanie',
  })
  expect(seated.layerTextures.top).toContain('top-varsity-jacket-sit')
  expect(seated.layerTextures.bottom).toContain('bottom-black-cargos-sit')
  expect(seated.layerTextures.shoes).toContain('shoes-boots-sit')
  expect(seated.layerTextures.hat).toContain('hat-beanie-sit')

  await page.evaluate(() => window.__STUDY_GAME_APP__.stand())
  await expect(page.locator('html')).toHaveAttribute('data-game-state', 'ready', { timeout: 10_000 })
})

test('server-authoritative Gold purchases are deduplicated and update all paid wearables', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const owned = new Set(['short-hair', 'radio-hoodie', 'jeans', 'sneakers', 'bucket-hat'])
    const prices: Record<string, number> = {
      'varsity-jacket': 80,
      'radiotedu-tee': 45,
      'black-cargos': 60,
      boots: 50,
      beanie: 35,
    }
    let gold = 285
    const state = { purchaseCalls: 0, equipCalls: 0, lastIdempotencyKey: '' }
    Object.defineProperty(window, '__GOLD_E2E_STATE__', { value: state })
    const success = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), {
      status, headers: { 'Content-Type': 'application/json' },
    })
    const failure = (error: string, status: number) => new Response(JSON.stringify({ success: false, error }), {
      status, headers: { 'Content-Type': 'application/json' },
    })

    window.RadioTEDUStudyBridge = {
      apiBase: 'https://study-gold.test/study',
      account: { id: 'gold-student', displayName: 'Gold Student', authenticated: true },
      globalPoints: gold,
      request: async (input, init = {}) => {
        const url = new URL(String(input))
        if (url.pathname === '/study/avatar/me') {
          return success({ ownedItemIds: [...owned], equipped: {}, points: { spendable_points: gold } })
        }
        if (url.pathname === '/study/summary') return success({ todaySeconds: 0, monthSeconds: 0, totalSeconds: 0 })
        if (url.pathname === '/gamification/events') return success({ events: [] })
        if (url.pathname === '/study/instances/join') {
          return success({ instance: { id: 'library-1', roomId: 'library', number: 1, occupancy: 1, capacity: 51, preferredInstanceFull: false } })
        }
        if (url.pathname === '/study/presence/heartbeat') return success({})
        if (url.pathname === '/study/presence') return success({ presence: [] })
        if (url.pathname === '/study/chat') return success({ messages: [] })
        if (url.pathname === '/study/avatar/equip') {
          state.equipCalls += 1
          return success({})
        }
        if (url.pathname === '/study/avatar/purchase') {
          state.purchaseCalls += 1
          const body = JSON.parse(String(init.body ?? '{}')) as { itemId?: string; idempotencyKey?: string }
          const itemId = body.itemId ?? ''
          state.lastIdempotencyKey = body.idempotencyKey ?? ''
          await new Promise((resolve) => setTimeout(resolve, 120))
          if (!prices[itemId] || gold < prices[itemId]) return failure('INSUFFICIENT_GOLD', 409)
          if (!owned.has(itemId)) {
            gold -= prices[itemId]
            owned.add(itemId)
          }
          return success({ ownedItemIds: [...owned], points: { spendable_points: gold } }, 201)
        }
        return failure(`UNHANDLED_${url.pathname}`, 404)
      },
    }
  })

  await page.goto('/?room=library')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })
  await expect(page.locator('#point-balance')).toHaveText('285')
  await page.getByRole('button', { name: 'Campus Shop' }).click()
  await expect(page.getByTestId('gold-store-grid')).toBeVisible()
  await expect(page.locator('[data-store-item]')).toHaveCount(5)
  await page.screenshot({ path: path.join(artifactDir, `${testInfo.project.name}-gold-store.png`) })
  expect(await page.locator('[data-store-item]').evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.storeItem))).toEqual([
    'beanie', 'boots', 'black-cargos', 'radiotedu-tee', 'varsity-jacket',
  ])
  await page.locator('[data-store-item-id="varsity-jacket"]').click()
  await expect(page.locator('#wardrobe-panel')).toBeVisible()

  const varsity = page.getByTestId('wearable-varsity-jacket')
  await expect(varsity).toBeFocused()
  await expect(varsity).toHaveAttribute('data-state', 'locked')
  await varsity.dblclick({ delay: 5 })
  await expect(page.locator('#point-balance')).toHaveText('205')
  await expect(varsity).toHaveAttribute('data-state', 'equipped')
  expect(await page.evaluate(() => window.__GOLD_E2E_STATE__.purchaseCalls)).toBe(1)

  for (const [id, expectedGold] of [['black-cargos', '145'], ['boots', '95'], ['beanie', '60'], ['radiotedu-tee', '15']] as const) {
    const button = page.getByTestId(`wearable-${id}`)
    await expect(button).toHaveAttribute('data-state', 'locked')
    await button.click()
    await expect(page.locator('#point-balance')).toHaveText(expectedGold)
    await expect(button).toHaveAttribute('data-state', 'equipped')
  }

  await page.getByTestId('wearable-radio-hoodie').click()
  await varsity.click()
  await expect(page.locator('#point-balance')).toHaveText('15')
  const purchaseState = await page.evaluate(() => window.__GOLD_E2E_STATE__)
  expect(purchaseState.purchaseCalls).toBe(5)
  expect(purchaseState.equipCalls).toBeGreaterThanOrEqual(7)
  expect(purchaseState.lastIdempotencyKey).toMatch(/\S+/)
})

declare global {
  interface Window {
    __GOLD_E2E_STATE__: { purchaseCalls: number; equipCalls: number; lastIdempotencyKey: string }
  }
}
