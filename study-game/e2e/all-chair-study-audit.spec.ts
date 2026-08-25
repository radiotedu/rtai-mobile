import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

const OUTPUT = process.env.STUDY_CHAIR_AUDIT_OUTPUT
  ?? 'C:/Users/tuna.ozsari/Desktop/artifacts/study-chair-ui-audit-20260821/chairs-current'

const ROOM_IDS = ['library', 'chim-alan', 'auditorium', 'learning-lab'] as const
const REQUESTED_ROOM = process.env.STUDY_CHAIR_AUDIT_ROOM
const REQUESTED_SEAT = process.env.STUDY_CHAIR_AUDIT_SEAT
const REQUESTED_VIEWPORT = process.env.STUDY_CHAIR_AUDIT_VIEWPORT
const SHOW_TARGET_OVERLAY = process.env.STUDY_CHAIR_AUDIT_OVERLAY === '1'
const ENTRY_PATH = process.env.STUDY_CHAIR_AUDIT_ENTRY_PATH ?? '/'

function auditEntry(query: string): string {
  const pathname = ENTRY_PATH.endsWith('/') ? ENTRY_PATH : `${ENTRY_PATH}/`
  return `${pathname}?${query}`
}

function requestedViewport(): { width: number; height: number } | null {
  const match = REQUESTED_VIEWPORT?.match(/^(\d+)x(\d+)$/)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (width < 320 || height < 180) return null
  return { width, height }
}

type SeatAudit = {
  roomId: string
  seatId: string
  label: string
  screen: { x: number; y: number }
  timerBefore: string
  timerAfter: string
  sessionStarts: number
  screenshot: string
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let nonce = 1
    let session = 1
    const auditWindow = window as Window & { __CHAIR_AUDIT_SESSION_STARTS__?: number }
    auditWindow.__CHAIR_AUDIT_SESSION_STARTS__ = 0
    const response = (data: unknown) => Promise.resolve(new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    window.RadioTEDUStudyBridge = {
      apiBase: '/jukebox/api/v1/study',
      account: { id: 'chair-audit', displayName: 'Chair Audit', authenticated: true },
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
        if (url.pathname.endsWith('/sessions/start')) {
          auditWindow.__CHAIR_AUDIT_SESSION_STARTS__ = (auditWindow.__CHAIR_AUDIT_SESSION_STARTS__ ?? 0) + 1
          return response({ session: { id: `chair-audit-${session++}` }, nonce: `nonce-${nonce++}` })
        }
        if (/\/sessions\/[^/]+\/heartbeat$/.test(url.pathname)) return response({ nonce: `nonce-${nonce++}`, accepted_seconds: 1 })
        if (/\/sessions\/[^/]+\/finish$/.test(url.pathname)) return response({ points: { spendable_points: 240 } })
        return response({})
      },
    }
  })
})

async function switchRoom(page: Page, roomId: typeof ROOM_IDS[number]): Promise<void> {
  await page.evaluate((nextRoomId) => {
    window.__STUDY_GAME_APP__.stand()
    window.__STUDY_GAME_APP__.switchRoom(nextRoomId)
  }, roomId)
  await expect(page.locator('html')).toHaveAttribute('data-room-id', roomId, { timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().state), { timeout: 30_000 }).toBe('ready')
}

async function seatTarget(page: Page, seatId: string) {
  return page.evaluate((requestedSeatId) => {
    const target = window.__STUDY_GAME_APP__.tapTargets().seats.find((seat) => seat.id === requestedSeatId)
    if (!target) return null
    const centroid = {
      x: target.hitAreaScreen.reduce((sum, point) => sum + point.x, 0) / target.hitAreaScreen.length,
      y: target.hitAreaScreen.reduce((sum, point) => sum + point.y, 0) / target.hitAreaScreen.length,
    }
    return { ...target, screen: centroid }
  }, seatId)
}

test('clicks every authored chair, starts verified study, and captures every seated pose', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one full-resolution screenshot set is sufficient')
  test.setTimeout(12 * 60_000)
  fs.mkdirSync(OUTPUT, { recursive: true })

  const viewport = requestedViewport()
  if (REQUESTED_VIEWPORT && !viewport) throw new Error(`Invalid STUDY_CHAIR_AUDIT_VIEWPORT: ${REQUESTED_VIEWPORT}`)
  if (viewport) await page.setViewportSize(viewport)

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('crash', () => pageErrors.push('page crashed'))

  await page.goto(auditEntry('room=library&chair-audit=1'))
  const enterLibrary = page.getByRole('button', { name: /Enter Library/i })
  if (await enterLibrary.isVisible()) await enterLibrary.click()
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  const audit: SeatAudit[] = []
  const inventory: Record<string, Array<{ id: string; label: string }>> = {}

  for (const roomId of ROOM_IDS.filter((candidate) => !REQUESTED_ROOM || candidate === REQUESTED_ROOM)) {
    await switchRoom(page, roomId)
    inventory[roomId] = await page.evaluate(() => window.__STUDY_GAME_APP__.tapTargets().seats
      .map(({ id }) => ({ id, label: id })))
    if (SHOW_TARGET_OVERLAY) {
      const targets = await page.evaluate(() => window.__STUDY_GAME_APP__.tapTargets().seats.map((seat) => ({
        id: seat.id,
        reachable: seat.reachable,
        occupied: seat.occupied,
        hitAreaScreen: seat.hitAreaScreen,
        centroid: {
          x: seat.hitAreaScreen.reduce((sum, point) => sum + point.x, 0) / seat.hitAreaScreen.length,
          y: seat.hitAreaScreen.reduce((sum, point) => sum + point.y, 0) / seat.hitAreaScreen.length,
        },
      })))
      fs.writeFileSync(path.join(OUTPUT, `${roomId}-seat-targets.json`), JSON.stringify(targets, null, 2))
      await page.evaluate(() => {
        document.querySelector('#seat-target-audit-overlay')?.remove()
        const ns = 'http://www.w3.org/2000/svg'
        const svg = document.createElementNS(ns, 'svg')
        svg.id = 'seat-target-audit-overlay'
        svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`)
        Object.assign(svg.style, { position: 'fixed', inset: '0', zIndex: '2147483646', pointerEvents: 'none' })
        for (const seat of window.__STUDY_GAME_APP__.tapTargets().seats) {
          const centroid = {
            x: seat.hitAreaScreen.reduce((sum, point) => sum + point.x, 0) / seat.hitAreaScreen.length,
            y: seat.hitAreaScreen.reduce((sum, point) => sum + point.y, 0) / seat.hitAreaScreen.length,
          }
          const polygon = document.createElementNS(ns, 'polygon')
          polygon.setAttribute('points', seat.hitAreaScreen.map((point) => `${point.x},${point.y}`).join(' '))
          polygon.setAttribute('fill', 'rgba(255, 64, 64, .28)')
          polygon.setAttribute('stroke', '#ff4040')
          polygon.setAttribute('stroke-width', '2')
          const label = document.createElementNS(ns, 'text')
          label.setAttribute('x', String(centroid.x))
          label.setAttribute('y', String(centroid.y))
          label.setAttribute('fill', '#fff')
          label.setAttribute('stroke', '#111')
          label.setAttribute('stroke-width', '3')
          label.setAttribute('paint-order', 'stroke')
          label.setAttribute('font-size', '9')
          label.textContent = seat.id
          svg.append(polygon, label)
        }
        document.body.append(svg)
      })
      await page.screenshot({ path: path.join(OUTPUT, `${roomId}-seat-targets.png`) })
      await page.locator('#seat-target-audit-overlay').evaluate((element) => element.remove())
    }
    if (REQUESTED_SEAT) inventory[roomId] = inventory[roomId]!.filter((seat) => seat.id === REQUESTED_SEAT)
    expect(inventory[roomId]!.length, `${roomId} must contain the requested audit seat`).toBeGreaterThan(0)

    for (const seat of inventory[roomId]!) {
      await switchRoom(page, roomId)
      let target = await seatTarget(page, seat.id)
      expect(target, `${roomId}:${seat.id} must exist`).not.toBeNull()
      expect(target!.reachable, `${roomId}:${seat.id} must be reachable`).toBe(true)
      expect(target!.occupied, `${roomId}:${seat.id} must be free in the audit room`).toBe(false)

      const visible = await page.evaluate(({ x, y }) => (
        x > 8 && x < innerWidth - 8 && y > 64 && y < innerHeight - 60
        && document.elementFromPoint(x, y)?.tagName === 'CANVAS'
      ), target!.screen)
      if (!visible) {
        await page.evaluate((point) => window.__STUDY_GAME_APP__.walkToPoint(point.x, point.y), target!.approach)
        await expect.poll(() => page.evaluate(() => window.__STUDY_GAME_APP__.snapshot().state), { timeout: 30_000 }).toBe('ready')
        target = await seatTarget(page, seat.id)
      }

      expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, target!.screen),
        `${roomId}:${seat.id} click point ${JSON.stringify(target!.screen)} must reach the canvas`).toBe('CANVAS')

      const startsBefore = await page.evaluate(() => (
        (window as Window & { __CHAIR_AUDIT_SESSION_STARTS__?: number }).__CHAIR_AUDIT_SESSION_STARTS__ ?? 0
      ))
      const timerBefore = (await page.locator('#study-timer').textContent())?.trim() ?? ''
      await page.mouse.click(target!.screen.x, target!.screen.y)
      await expect.poll(() => page.evaluate(() => {
        const snapshot = window.__STUDY_GAME_APP__.snapshot()
        return { state: snapshot.state, seatId: snapshot.seatId }
      }), { timeout: 30_000, message: `${roomId}:${seat.id} must seat from its real canvas click` })
        .toEqual({ state: 'seated', seatId: seat.id })
      await expect(page.locator('#study-timer'), `${roomId}:${seat.id} must start study time`)
        .toHaveAttribute('data-running', 'true')
      await expect.poll(() => page.evaluate(() => (
        (window as Window & { __CHAIR_AUDIT_SESSION_STARTS__?: number }).__CHAIR_AUDIT_SESSION_STARTS__ ?? 0
      )), { timeout: 10_000, message: `${roomId}:${seat.id} must create a server-authoritative session` })
        .toBe(startsBefore + 1)
      await page.waitForTimeout(1_150)
      const timerAfter = (await page.locator('#study-timer').textContent())?.trim() ?? ''
      expect(timerAfter, `${roomId}:${seat.id} timer must visibly advance`).not.toBe(timerBefore)

      const fileName = `${roomId}--${seat.id}.png`
      await page.screenshot({ path: path.join(OUTPUT, fileName) })
      audit.push({
        roomId,
        seatId: seat.id,
        label: seat.label,
        screen: target!.screen,
        timerBefore,
        timerAfter,
        sessionStarts: startsBefore + 1,
        screenshot: fileName,
      })
      fs.writeFileSync(path.join(OUTPUT, 'audit.json'), JSON.stringify({ inventory, audit, pageErrors }, null, 2))

      await page.evaluate(() => window.__STUDY_GAME_APP__.stand())
      await expect(page.locator('#study-timer'), `${roomId}:${seat.id} must stop after standing`)
        .toHaveAttribute('data-running', 'false')
    }
  }

  expect(pageErrors).toEqual([])
  expect(audit.length).toBe(Object.values(inventory).reduce((sum, seats) => sum + seats.length, 0))
})

test('keeps the short-wide camera in deterministic readable follow framing across fresh starts', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'short-wide framing is a desktop regression')
  test.setTimeout(3 * 60_000)
  await page.setViewportSize({ width: 1425, height: 407 })

  const samples: Array<{ actual: number; expected: number; width: number; height: number }> = []
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.goto(auditEntry(`room=library&camera-start-audit=${attempt}`))
    const enterLibrary = page.getByRole('button', { name: /Enter Library/i })
    if (await enterLibrary.isVisible()) await enterLibrary.click()
    await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

    const sample = await page.evaluate(() => {
      const snapshot = window.__STUDY_GAME_APP__.snapshot()
      const canvas = document.querySelector<HTMLCanvasElement>('canvas')
      if (!canvas) throw new Error('Study canvas is missing')
      const expected = Math.max(canvas.width / snapshot.roomSize.width, canvas.height / snapshot.roomSize.height)
      return {
        actual: snapshot.camera.zoom,
        expected,
        width: canvas.width,
        height: canvas.height,
      }
    })
    samples.push(sample)
    expect(Math.abs(sample.actual - sample.expected), `attempt ${attempt + 1} must use readable follow framing`).toBeLessThan(0.001)
  }

  expect(new Set(samples.map((sample) => sample.actual.toFixed(6))).size, 'fresh starts must use one stable zoom').toBe(1)
})

test('accepts forgiving mouse clicks just outside authored seat polygons in every room', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'mouse hit-area regression is desktop-specific')
  test.setTimeout(2 * 60_000)
  await page.goto(auditEntry('room=library&seat-slop-audit=1'))
  const enterLibrary = page.getByRole('button', { name: /Enter Library/i })
  if (await enterLibrary.isVisible()) await enterLibrary.click()
  await page.locator('html[data-study-ready="true"]').waitFor({ timeout: 30_000 })

  const seats = [
    ['library', 'middle-row'],
    ['chim-alan', 'amfi-b2'],
    ['auditorium', 'auditorium-middle'],
    ['learning-lab', 'activity-table-seat'],
  ] as const

  for (const [roomId, seatId] of seats) {
    await switchRoom(page, roomId)
    const point = await page.evaluate((requestedSeatId) => {
      const seat = window.__STUDY_GAME_APP__.tapTargets().seats.find((candidate) => candidate.id === requestedSeatId)
      if (!seat) return null
      const polygon = seat.hitAreaScreen
      const targets = window.__STUDY_GAME_APP__.tapTargets().seats
      const inside = (candidate: { x: number; y: number }, area: readonly { x: number; y: number }[]) => {
        let result = false
        for (let index = 0, previous = area.length - 1; index < area.length; previous = index, index += 1) {
          const current = area[index]!
          const prior = area[previous]!
          const intersects = (current.y > candidate.y) !== (prior.y > candidate.y)
            && candidate.x < (((prior.x - current.x) * (candidate.y - current.y)) / (prior.y - current.y)) + current.x
          if (intersects) result = !result
        }
        return result
      }
      const segmentDistance = (
        candidate: { x: number; y: number },
        from: { x: number; y: number },
        to: { x: number; y: number },
      ) => {
        const dx = to.x - from.x
        const dy = to.y - from.y
        const lengthSquared = dx * dx + dy * dy
        if (lengthSquared === 0) return Math.hypot(candidate.x - from.x, candidate.y - from.y)
        const amount = Math.max(0, Math.min(1, (
          ((candidate.x - from.x) * dx) + ((candidate.y - from.y) * dy)
        ) / lengthSquared))
        return Math.hypot(candidate.x - (from.x + amount * dx), candidate.y - (from.y + amount * dy))
      }
      const polygonDistance = (candidate: { x: number; y: number }, area: readonly { x: number; y: number }[]) => {
        if (inside(candidate, area)) return 0
        let result = Number.POSITIVE_INFINITY
        for (let index = 0; index < area.length; index += 1) {
          result = Math.min(result, segmentDistance(candidate, area[index]!, area[(index + 1) % area.length]!))
        }
        return result
      }
      const bounds = polygon.reduce((result, vertex) => ({
        minX: Math.min(result.minX, vertex.x),
        minY: Math.min(result.minY, vertex.y),
        maxX: Math.max(result.maxX, vertex.x),
        maxY: Math.max(result.maxY, vertex.y),
      }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })

      for (let y = bounds.minY - 9; y <= bounds.maxY + 9; y += 2) {
        for (let x = bounds.minX - 9; x <= bounds.maxX + 9; x += 2) {
          const candidate = { x, y }
          const targetDistance = polygonDistance(candidate, polygon)
          if (targetDistance < 4 || targetDistance > 9) continue
          const otherDistance = targets
            .filter((target) => target.id !== requestedSeatId)
            .reduce((closest, target) => Math.min(closest, polygonDistance(candidate, target.hitAreaScreen)), Infinity)
          if (
            targetDistance + 1 < otherDistance
            && document.elementFromPoint(candidate.x, candidate.y)?.tagName === 'CANVAS'
          ) {
            return candidate
          }
        }
      }
      return null
    }, seatId)
    expect(point, `${roomId}:${seatId} must expose an unobstructed near-seat mouse point`).not.toBeNull()

    await page.mouse.click(point!.x, point!.y)
    await expect.poll(() => page.evaluate(() => {
      const snapshot = window.__STUDY_GAME_APP__.snapshot()
      return { state: snapshot.state, seatId: snapshot.seatId }
    }), { timeout: 30_000, message: `${roomId}:${seatId} must accept a near-polygon mouse click` })
      .toEqual({ state: 'seated', seatId })
  }
})
