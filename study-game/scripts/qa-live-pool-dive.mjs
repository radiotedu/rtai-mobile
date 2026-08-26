import fs from 'node:fs'
import path from 'node:path'

import { chromium } from '@playwright/test'

const liveUrl = process.env.STUDY_LIVE_URL ?? 'https://radiotedu.com/social/'
const outputDir = process.env.STUDY_LIVE_AUDIT_OUTPUT
  ?? path.resolve('..', 'artifacts', 'study-game', 'pool-dive-live')
fs.mkdirSync(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const results = []

try {
  for (const profile of [
    { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
    { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ]) {
    const { name, ...contextOptions } = profile
    const context = await browser.newContext(contextOptions)
    await context.addInitScript(() => {
      const response = (data, status = 200) => Promise.resolve(new Response(JSON.stringify({ success: true, data }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }))
      const prompts = ['center', 'right', 'left', 'center', 'left', 'right', 'center', 'left']
      let round = 1
      let score = 0
      let nonce = 'livepooldivenonce000000000000000001'
      window.RadioTEDUStudyBridge = {
        apiBase: '/jukebox/api/v1/study',
        account: { id: 'live-pool-audit', displayName: 'Live Pool Audit', authenticated: true },
        globalPoints: 240,
        request: async (input, init = {}) => {
          const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin)
          const body = typeof init.body === 'string' ? JSON.parse(init.body) : {}
          if (url.pathname.endsWith('/avatar/me')) return response({ ownedItemIds: [], equipped: {}, points: { spendable_points: 240 } })
          if (url.pathname.endsWith('/summary')) return response({ todaySeconds: 0, monthSeconds: 0, totalSeconds: 0 })
          if (url.pathname.endsWith('/instances/join')) {
            const roomId = body.roomId ?? 'library'
            return response({ instance: { id: `${roomId}-1`, roomId, number: 1, occupancy: 1, capacity: 60 } })
          }
          if (url.pathname.endsWith('/presence')) return response({ presence: [] })
          if (url.pathname.endsWith('/presence/heartbeat')) return response({})
          if (url.pathname.endsWith('/chat')) return response({ messages: [] })
          if (url.pathname.endsWith('/events')) return response({ events: [] })
          if (url.pathname.endsWith('/social-arcade/pool-dive/start')) {
            round = 1
            score = 0
            nonce = 'livepooldivenonce000000000000000001'
            return response({
              session: { id: 'live-pool-session', status: 'active', round, totalRounds: 8, score, prompt: prompts[0], nonce, promptExpiresAt: null, expiresAt: null, final: false },
              verification: 'server-authoritative',
            }, 201)
          }
          if (/\/social-arcade\/pool-dive\/sessions\/[^/]+\/action$/.test(url.pathname)) {
            const completedRound = round
            const correct = body.choice === prompts[completedRound - 1] && body.nonce === nonce
            score += correct ? 75 : 0
            round += 1
            const final = completedRound === 8
            nonce = final ? null : `livepooldivenonce${String(round).padStart(18, '0')}`
            return response({
              session: {
                id: 'live-pool-session',
                status: final ? 'completed' : 'active',
                round: final ? 8 : round,
                totalRounds: 8,
                score,
                prompt: final ? null : prompts[round - 1],
                nonce,
                promptExpiresAt: null,
                expiresAt: null,
                final,
              },
              result: { correct, validTiming: true, roundScore: correct ? 75 : 0, elapsedMs: 300, completedRound },
              pointsAwarded: final ? 10 : 0,
              spendablePoints: final ? 250 : 240,
              verification: 'server-authoritative',
            })
          }
          return response({})
        },
      }
    })

    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('crash', () => errors.push('page crashed'))
    const navigation = await page.goto(`${liveUrl}?room=library&pool-live-audit=${Date.now()}`, { waitUntil: 'domcontentloaded' })
    await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })
    const rejectAnalytics = page.locator('[data-rtac-reject]:visible').last()
    await rejectAnalytics.click({ timeout: 3_000 }).catch(() => {})

    await page.locator('#events-toggle').click()
    await page.locator('.events-view-tabs').getByRole('button', { name: 'Arcade', exact: true }).click()
    await page.getByRole('button', { name: 'Start verified game' }).click()
    await page.locator('.pool-dive-stage[data-pool-motion="ready"]').waitFor()
    await page.screenshot({ path: path.join(outputDir, `${name}-ready.png`) })

    for (let completedRound = 1; completedRound <= 8; completedRound += 1) {
      const stage = page.locator('.pool-dive-stage')
      const prompt = await stage.getAttribute('data-pool-prompt')
      await page.locator(`[data-pool-choice="${prompt}"]`).click()
      if (completedRound === 1) {
        await stage.locator('..').screenshot({ path: path.join(outputDir, `${name}-takeoff.png`) })
      }
      await page.locator(`.pool-dive[data-arcade-state="${completedRound === 8 ? 'complete' : 'active'}"]`).waitFor()
    }

    const state = await page.evaluate(() => ({
      score: document.querySelector('[data-pool-score]')?.textContent,
      result: document.querySelector('[data-pool-result]')?.textContent,
      motion: document.querySelector('.pool-dive-stage')?.getAttribute('data-pool-motion'),
      overflow: document.documentElement.scrollWidth - innerWidth,
      cookieSettingsHiddenDuringPanel: (() => {
        const settings = document.querySelector('.rtac .rtac__settings')
        return !settings || getComputedStyle(settings).visibility === 'hidden'
      })(),
      scriptAssets: [...document.scripts].map((script) => script.src).filter(Boolean),
    }))
    await page.screenshot({ path: path.join(outputDir, `${name}-complete.png`) })
    await page.getByLabel('Close events').click()
    const cookieSettingsVisibleAfterClose = await page.evaluate(() => {
      const settings = document.querySelector('.rtac .rtac__settings')
      return !settings || (getComputedStyle(settings).visibility !== 'hidden' && getComputedStyle(settings).display !== 'none')
    })
    if (
      navigation?.status() !== 200 || state.score !== '600' || state.motion !== 'complete'
      || state.overflow !== 0 || (name === 'mobile' && !state.cookieSettingsHiddenDuringPanel) || !cookieSettingsVisibleAfterClose
      || errors.length > 0
    ) {
      throw new Error(`${name} live Pool Dive smoke failed: ${JSON.stringify({ status: navigation?.status(), state, errors })}`)
    }
    results.push({ profile: name, httpStatus: navigation.status(), state, cookieSettingsVisibleAfterClose, errors })
    await context.close()
  }
} finally {
  await browser.close()
}

fs.writeFileSync(path.join(outputDir, 'audit.json'), JSON.stringify(results, null, 2))
console.log(JSON.stringify(results.map(({ profile, httpStatus, state, cookieSettingsVisibleAfterClose, errors }) => ({
  profile,
  httpStatus,
  state,
  cookieSettingsVisibleAfterClose,
  errors,
}))))
