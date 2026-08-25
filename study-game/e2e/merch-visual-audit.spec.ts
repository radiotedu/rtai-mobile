import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const OUTPUT = process.env.STUDY_MERCH_AUDIT_OUTPUT
  ?? path.resolve('..', 'artifacts', 'study-game', 'merch-visual-audit')

const OUTFITS = [
  ...['radio-hoodie', 'radiotedu-tee', 'varsity-jacket'].flatMap((top) => (
    ['jeans', 'black-cargos'].flatMap((bottom) => (
      ['sneakers', 'boots'].flatMap((shoes) => (
        ['bucket-hat', 'beanie'].map((hat) => ({ top, bottom, shoes, hat }))
      ))
    ))
  )),
] as const

type Outfit = (typeof OUTFITS)[number]
type AuditEntry = {
  project: string
  state: 'standing' | 'seated'
  outfit: Outfit
  seatId: string | null
  textures: Record<string, string | null>
  screenshot: string
}

test.setTimeout(180_000)

async function equipOutfit(page: Page, outfit: Outfit) {
  await page.evaluate(async (next) => {
    await window.__STUDY_GAME_APP__.equip('top', next.top)
    await window.__STUDY_GAME_APP__.equip('bottom', next.bottom)
    await window.__STUDY_GAME_APP__.equip('shoes', next.shoes)
    await window.__STUDY_GAME_APP__.equip('hat', next.hat)
  }, outfit)
  await expect(page.locator('html')).toHaveAttribute('data-top-id', outfit.top)
  await expect(page.locator('html')).toHaveAttribute('data-bottom-id', outfit.bottom)
  await expect(page.locator('html')).toHaveAttribute('data-shoes-id', outfit.shoes)
  await expect(page.locator('html')).toHaveAttribute('data-hat-id', outfit.hat)
}

async function avatarClip(page: Page) {
  return page.evaluate(() => {
    const snapshot = window.__STUDY_GAME_APP__.snapshot()
    const x = snapshot.camera.x + (snapshot.position.x - snapshot.camera.worldViewX) * snapshot.camera.zoom
    const y = snapshot.camera.y + (snapshot.position.y - snapshot.camera.worldViewY) * snapshot.camera.zoom
    const width = Math.min(190, innerWidth)
    const height = Math.min(190, innerHeight)
    return {
      x: Math.max(0, Math.min(innerWidth - width, x - width / 2)),
      y: Math.max(0, Math.min(innerHeight - height, y - 148)),
      width,
      height,
    }
  })
}

async function captureOutfits(
  page: Page,
  project: string,
  state: 'standing' | 'seated',
  audit: AuditEntry[],
) {
  for (const outfit of OUTFITS) {
    await equipOutfit(page, outfit)
    const snapshot = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())
    const expectedAction = state === 'seated' ? 'sit' : 'idle'
    const expected = {
      top: `top-${outfit.top}-${expectedAction}`,
      bottom: `bottom-${outfit.bottom}-${expectedAction}`,
      shoes: `shoes-${outfit.shoes}-${expectedAction}`,
      hat: `hat-${outfit.hat}-${expectedAction}`,
    }
    for (const slot of ['top', 'bottom', 'shoes', 'hat'] as const) {
      const key = expected[slot]
      const actual = snapshot.layerTextures[slot]
      if (!actual) {
        throw new Error(`${state} ${slot} layer is hidden for ${JSON.stringify(outfit)}; textures=${JSON.stringify(snapshot.layerTextures)}`)
      }
      expect(actual, `${state} ${slot} texture for ${JSON.stringify(outfit)}`).toContain(key)
    }
    const slug = `${outfit.top}--${outfit.bottom}--${outfit.shoes}--${outfit.hat}`
    const screenshot = `${project}--${state}--${slug}.png`
    await page.screenshot({
      path: path.join(OUTPUT, screenshot),
      clip: await avatarClip(page),
    })
    audit.push({
      project,
      state,
      outfit,
      seatId: snapshot.seatId,
      textures: Object.fromEntries(Object.entries(snapshot.layerTextures).map(([slot, texture]) => [slot, texture ?? null])),
      screenshot,
    })
  }
}

test('all 24 merch combinations align while standing and seated on desktop and mobile', async ({ page }, testInfo) => {
  fs.mkdirSync(OUTPUT, { recursive: true })
  const audit: AuditEntry[] = []
  await page.addInitScript(() => {
    localStorage.setItem('study-game.inventory', JSON.stringify({
      owned: [
        'short-hair',
        'radio-hoodie',
        'radiotedu-tee',
        'varsity-jacket',
        'jeans',
        'black-cargos',
        'sneakers',
        'boots',
        'bucket-hat',
        'beanie',
      ],
      equipped: {},
    }))
  })
  await page.goto('/?room=library')
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  await captureOutfits(page, testInfo.project.name, 'standing', audit)

  await page.evaluate(() => window.__STUDY_GAME_APP__.walkToSeat('front-left'))
  await page.locator('html[data-game-state="seated"][data-seated-seat-id="front-left"]').waitFor({ timeout: 30_000 })
  await expect(page.locator('#study-timer')).toHaveAttribute('data-running', 'true')
  await captureOutfits(page, testInfo.project.name, 'seated', audit)

  const finalSnapshot = await page.evaluate(() => window.__STUDY_GAME_APP__.snapshot())
  expect(finalSnapshot).toMatchObject({
    state: 'seated',
    seatId: 'front-left',
    topId: 'varsity-jacket',
    bottomId: 'black-cargos',
    shoesId: 'boots',
    hatId: 'beanie',
  })
  expect(audit).toHaveLength(48)
  fs.writeFileSync(path.join(OUTPUT, `${testInfo.project.name}--audit.json`), JSON.stringify({
    project: testInfo.project.name,
    combinations: OUTFITS.length,
    captures: audit.length,
    audit,
  }, null, 2))
})
