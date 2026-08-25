import { expect, test } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const artifactDir = path.resolve(process.cwd(), '..', 'artifacts', 'study-game', 'roadside-radio')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    type MockAudioSnapshot = { src: string; playCount: number; pauseCount: number; loadCount: number }
    const snapshots: MockAudioSnapshot[] = []
    class MockAudio extends EventTarget {
      preload = ''
      volume = 1
      paused = true
      snapshot: MockAudioSnapshot

      constructor(source = '') {
        super()
        this.snapshot = { src: source, playCount: 0, pauseCount: 0, loadCount: 0 }
        snapshots.push(this.snapshot)
      }

      get src() { return this.snapshot.src }
      set src(value: string) { this.snapshot.src = value }
      load() { this.snapshot.loadCount += 1 }
      pause() { this.paused = true; this.snapshot.pauseCount += 1 }
      play() {
        this.paused = false
        this.snapshot.playCount += 1
        this.dispatchEvent(new Event('playing'))
        return Promise.resolve()
      }
    }
    Object.defineProperty(window, 'Audio', { configurable: true, value: MockAudio })
    Object.defineProperty(window, '__STUDY_RADIO_AUDIO__', { configurable: true, value: snapshots })
  })
})

test('real canvas clicks make Spark and Rock select their fixed stations', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await fs.mkdir(artifactDir, { recursive: true })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?room=chim-alan')
  await expect(page.locator('html')).toHaveAttribute('data-study-ready', 'true', { timeout: 30_000 })

  const clickActor = async (id: 'spark' | 'rock') => {
    await page.waitForFunction((actorId) => {
      const canvas = document.querySelector('canvas')?.getBoundingClientRect()
      const target = window.__STUDY_GAME_APP__.tapTargets().blockers
        .find((item) => item.kind === 'actor' && item.id === actorId)?.screen
      return Boolean(canvas && target
        && target.x >= canvas.left && target.x <= canvas.right
        && target.y >= canvas.top && target.y <= canvas.bottom)
    }, id, { timeout: 20_000 })
    const target = await page.evaluate((actorId) => window.__STUDY_GAME_APP__.tapTargets().blockers
      .find((item) => item.kind === 'actor' && item.id === actorId)?.screen ?? null, id)
    expect(target, `${id} actor tap target`).not.toBeNull()
    if (testInfo.project.use.hasTouch) await page.touchscreen.tap(target!.x, target!.y)
    else await page.mouse.click(target!.x, target!.y)
  }

  await clickActor('spark')
  await expect(page.locator('#radio-status')).toContainText('Energize Radio · On air')
  let audio = await page.evaluate(() => (window as unknown as { __STUDY_RADIO_AUDIO__: Array<{ src: string; playCount: number }> }).__STUDY_RADIO_AUDIO__.at(0) ?? { src: '', playCount: -1 })
  expect(audio.src).toBe('https://stream.radiotedu.com/energize')
  expect(audio.playCount).toBe(1)

  await clickActor('rock')
  await expect(page.locator('#radio-status')).toContainText('Rock Radio · On air')
  audio = await page.evaluate(() => (window as unknown as { __STUDY_RADIO_AUDIO__: Array<{ src: string; playCount: number }> }).__STUDY_RADIO_AUDIO__.at(0) ?? { src: '', playCount: -1 })
  expect(audio.src).toBe('https://stream.radiotedu.com/rock')
  expect(audio.playCount).toBe(2)

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('radiotedu:study-radio-select', {
    detail: { channelId: 'https://attacker.invalid/stream' },
  })))
  audio = await page.evaluate(() => (window as unknown as { __STUDY_RADIO_AUDIO__: Array<{ src: string; playCount: number }> }).__STUDY_RADIO_AUDIO__.at(0) ?? { src: '', playCount: -1 })
  expect(audio.src).toBe('https://stream.radiotedu.com/rock')
  expect(audio.playCount).toBe(2)

  await page.screenshot({ path: path.join(artifactDir, `${testInfo.project.name}-chim-radios.png`) })
  expect(errors).toEqual([])
})

test('campus navigator links to the official TEDU 360 tour', async ({ page }) => {
  await page.goto('/?room=chim-alan')
  await expect(page.locator('html')).toHaveAttribute('data-study-ready', 'true', { timeout: 30_000 })
  await page.getByTestId('navigator-toggle').click()

  const tourLink = page.getByTestId('official-campus-tour-link')
  await expect(tourLink).toBeVisible()
  await expect(tourLink).toHaveAttribute('href', 'https://www.tedu.edu.tr/360-derece-sanal-tur')
  await expect(tourLink).toHaveAttribute('target', '_blank')
  await expect(tourLink).toHaveAttribute('rel', 'noopener noreferrer')
})
