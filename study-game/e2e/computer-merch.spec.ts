import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const artifactDir = process.env.STUDY_MERCH_AUDIT_OUTPUT
  ?? path.resolve('..', 'artifacts', 'study-game', 'computer-merch')

test.setTimeout(90_000)

async function avatarAndDeskClip(page: Page) {
  return page.evaluate(() => {
    const snapshot = window.__STUDY_GAME_APP__.snapshot()
    const x = snapshot.camera.x + (snapshot.position.x - snapshot.camera.worldViewX) * snapshot.camera.zoom
    const y = snapshot.camera.y + (snapshot.position.y - snapshot.camera.worldViewY) * snapshot.camera.zoom
    const width = Math.min(360, innerWidth)
    const height = Math.min(280, innerHeight)
    return {
      x: Math.max(0, Math.min(innerWidth - width, x - width / 2)),
      y: Math.max(0, Math.min(innerHeight - height, y - 190)),
      width,
      height,
    }
  })
}

test('server computer merch purchases, equips, and updates the seated desk immediately', async ({ page }, testInfo) => {
  fs.mkdirSync(artifactDir, { recursive: true })
  await page.addInitScript(() => {
    type Computer = {
      item_id: string
      title: string
      description: string
      kind: string
      cost_points: number
      rarity: string
      asset_key: string
      owned: boolean
      equipped: boolean
    }
    const computers: Computer[] = [
      { item_id: 'campus-computer', title: 'Campus Laptop', description: 'Starter computer.', kind: 'computer', cost_points: 0, rarity: 'common', asset_key: 'computer-basic', owned: true, equipped: true },
      { item_id: 'studybook-pro', title: 'StudyBook Pro', description: 'Study upgrade.', kind: 'computer', cost_points: 120, rarity: 'rare', asset_key: 'computer-pro', owned: false, equipped: false },
      { item_id: 'gold-scholar', title: 'Gold Scholar', description: 'Gold edition.', kind: 'computer', cost_points: 220, rarity: 'legendary', asset_key: 'computer-studio', owned: false, equipped: false },
    ]
    let gold = 500
    const state = { purchaseCalls: 0, equipCalls: 0, idempotencyKeys: [] as string[] }
    Object.defineProperty(window, '__COMPUTER_E2E_STATE__', { value: state })
    const success = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), {
      status, headers: { 'Content-Type': 'application/json' },
    })
    const failure = (error: string, status: number) => new Response(JSON.stringify({ success: false, error }), {
      status, headers: { 'Content-Type': 'application/json' },
    })

    window.RadioTEDUStudyBridge = {
      apiBase: 'https://study-computers.test/study',
      account: { id: 'computer-student', displayName: 'Computer Student', authenticated: true },
      globalPoints: gold,
      request: async (input, init = {}) => {
        const url = new URL(String(input))
        if (url.pathname === '/study/avatar/me') {
          return success({ ownedItemIds: ['short-hair', 'radio-hoodie', 'black-cargos', 'sneakers', 'bucket-hat'], equipped: {}, points: { spendable_points: gold } })
        }
        if (url.pathname === '/study/summary') return success({ todaySeconds: 0, monthSeconds: 0, totalSeconds: 0 })
        if (url.pathname === '/study/sessions/start') return success({ session: { id: 'computer-session-1' }, nonce: 'computer-nonce-1' }, 201)
        if (/^\/study\/sessions\/[^/]+\/heartbeat$/.test(url.pathname)) return success({ nonce: 'computer-nonce-2', accepted_seconds: 15 })
        if (/^\/study\/sessions\/[^/]+\/finish$/.test(url.pathname)) return success({ summary: { todaySeconds: 0, monthSeconds: 0, totalSeconds: 0 } })
        if (url.pathname === '/gamification/events') return success({ events: [] })
        if (url.pathname === '/study/instances/join') {
          return success({ instance: { id: 'library-1', roomId: 'library', number: 1, occupancy: 1, capacity: 51, preferredInstanceFull: false } })
        }
        if (url.pathname === '/study/presence/heartbeat') return success({})
        if (url.pathname === '/study/presence') return success({ presence: [] })
        if (url.pathname === '/study/chat') return success({ messages: [] })
        if (url.pathname === '/economy/study/shop' && (init.method ?? 'GET') === 'GET') {
          return success({ items: computers, gold_balance: gold })
        }
        const purchaseMatch = url.pathname.match(/^\/economy\/study\/shop\/([^/]+)\/purchase$/)
        if (purchaseMatch) {
          state.purchaseCalls += 1
          state.idempotencyKeys.push(new Headers(init.headers).get('Idempotency-Key') ?? '')
          const item = computers.find((candidate) => candidate.item_id === decodeURIComponent(purchaseMatch[1]!))
          if (!item) return failure('ITEM_NOT_FOUND', 404)
          if (!item.owned) {
            if (gold < item.cost_points) return failure('INSUFFICIENT_GOLD', 409)
            gold -= item.cost_points
            item.owned = true
          }
          return success({ gold_balance: gold }, 201)
        }
        const equipMatch = url.pathname.match(/^\/economy\/study\/shop\/([^/]+)\/equip$/)
        if (equipMatch) {
          state.equipCalls += 1
          const item = computers.find((candidate) => candidate.item_id === decodeURIComponent(equipMatch[1]!))
          if (!item?.owned) return failure('ITEM_NOT_OWNED', 409)
          for (const candidate of computers) candidate.equipped = candidate === item
          return success({})
        }
        return failure(`UNHANDLED_${url.pathname}`, 404)
      },
    }
  })

  await page.goto('/?room=library')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })
  await page.evaluate(() => window.__STUDY_GAME_APP__.walkToSeat('front-left'))
  await page.locator('html[data-game-state="seated"][data-seated-seat-id="front-left"]').waitFor({ timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().studyDeviceTexture)).toContain('study-device:laptop-campus')

  await page.getByRole('button', { name: 'Campus Shop' }).click()
  await expect(page.locator('[data-computer-item]')).toHaveCount(3)

  for (const [itemId, textureId, expectedGold] of [
    ['studybook-pro', 'laptop-pro', '380'],
    ['gold-scholar', 'laptop-gold', '160'],
  ] as const) {
    const button = page.locator(`[data-computer-item="${itemId}"]`)
    await expect(button).toHaveAttribute('data-action', 'purchase')
    await button.click()
    await expect(button).toHaveAttribute('data-action', 'equip')
    await expect(page.locator('#point-balance')).toHaveText(expectedGold)
    await button.click()
    await expect(button).toBeDisabled()
    await expect.poll(() => page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().studyDeviceTexture)).toContain(`study-device:${textureId}`)
    await page.getByLabel('Close Campus Shop').click()
    await page.screenshot({
      path: path.join(artifactDir, `${testInfo.project.name}--${textureId}.png`),
      clip: await avatarAndDeskClip(page),
    })
    await page.getByRole('button', { name: 'Campus Shop' }).click()
  }

  const state = await page.evaluate(() => window.__COMPUTER_E2E_STATE__)
  expect(state.purchaseCalls).toBe(2)
  expect(state.equipCalls).toBe(2)
  expect(state.idempotencyKeys).toHaveLength(2)
  expect(new Set(state.idempotencyKeys).size).toBe(2)
  expect(state.idempotencyKeys.every((key) => key.length > 0)).toBe(true)
})

declare global {
  interface Window {
    __COMPUTER_E2E_STATE__: { purchaseCalls: number; equipCalls: number; idempotencyKeys: string[] }
  }
}
