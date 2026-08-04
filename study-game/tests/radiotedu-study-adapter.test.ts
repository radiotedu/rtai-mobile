import { describe, expect, it, vi } from 'vitest'

import { RadioTEDUStudyAdapter } from '../src/adapters/RadioTEDUStudyAdapter'

function success<T>(data: T, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ success: true, data }),
  }
}

function failure(status: number, message: string) {
  return {
    ok: false,
    status,
    json: async () => ({ success: false, message }),
  }
}

function createAdapter(fetchImpl: ReturnType<typeof vi.fn>, globalPoints = 120) {
  return new RadioTEDUStudyAdapter({
    apiBase: 'https://radiotedu.com/jukebox/api/v1/study',
    accessToken: 'access-token',
    account: { id: 'user-1', displayName: 'Ada', authenticated: true },
    globalPoints,
    clientSessionId: 'webview-session-1',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })
}

describe('RadioTEDUStudyAdapter', () => {
  it('keeps the browser fetch receiver valid when no custom fetch implementation is supplied', async () => {
    const originalFetch = globalThis.fetch
    const requests: string[] = []
    globalThis.fetch = (async function (this: unknown, input: RequestInfo | URL) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
      const url = String(input)
      requests.push(url)
      return url.endsWith('/avatar/me')
        ? success({ ownedItemIds: ['radio-hoodie'], equipped: {}, points: { spendable_points: 75 } })
        : success({ todaySeconds: 120, monthSeconds: 360, totalSeconds: 720 })
    }) as typeof fetch

    try {
      const adapter = new RadioTEDUStudyAdapter({
        apiBase: 'https://radiotedu.com/jukebox/api/v1/study',
        accessToken: 'access-token',
        account: { id: 'user-1', displayName: 'Ada', authenticated: true },
        clientSessionId: 'webview-session-1',
      })

      await adapter.initialize()

      expect(requests).toEqual([
        'https://radiotedu.com/jukebox/api/v1/study/avatar/me',
        'https://radiotedu.com/jukebox/api/v1/study/summary',
      ])
      expect(adapter.session().points).toMatchObject({ global: 75, studyToday: 2 })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('maps production legacy starter ids to playable assets and back to the API contract', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(success({
        ownedItemIds: ['default-hair', 'default-top', 'default-bottom', 'default-shoes'],
        equipped: { top: 'default-top' },
        points: { spendable_points: 0 },
      }))
      .mockResolvedValueOnce(success({ todaySeconds: 0, monthSeconds: 0, totalSeconds: 0 }))
      .mockResolvedValueOnce(success({}))
    const adapter = createAdapter(fetchImpl)

    await adapter.initialize()

    expect(adapter.session().ownedWearableIds).toEqual([
      'short-hair', 'radio-hoodie', 'jeans', 'sneakers',
    ])
    expect(adapter.session().equippedWearableIds).toEqual(['radio-hoodie'])

    await adapter.equipWearable('radio-hoodie', 'top')
    expect(JSON.parse(fetchImpl.mock.calls[2]![1].body)).toEqual({
      itemId: 'default-top',
      slot: 'top',
    })
  })

  it('replaces the displayed Gold balance with the authoritative avatar purchase response', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(success({
      ownedItemIds: ['varsity-jacket'],
      points: {spendable_points: 65},
      spendable_points: 65,
    }, 201))
    const adapter = createAdapter(fetchImpl, 100)

    expect(adapter.session().points.global).toBe(100)
    await adapter.purchaseWearable('varsity-jacket', 'avatar-request-1')

    expect(adapter.session().points.global).toBe(65)
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body)).toEqual({
      itemId: 'varsity-jacket',
      idempotencyKey: 'avatar-request-1',
    })
  })

  it('rejects purchase responses that do not prove ownership and a valid authoritative Gold balance', async () => {
    const missingOwnership = createAdapter(vi.fn().mockResolvedValueOnce(success({
      ownedItemIds: [], points: { spendable_points: 65 },
    }, 201)), 100)
    await expect(missingOwnership.purchaseWearable('varsity-jacket', 'missing-item')).rejects.toThrow(/INVALID_PURCHASE_RESPONSE/)
    expect(missingOwnership.session().points.global).toBe(100)

    const invalidBalance = createAdapter(vi.fn().mockResolvedValueOnce(success({
      ownedItemIds: ['varsity-jacket'], points: { spendable_points: 'not-a-number' },
    }, 201)), 100)
    await expect(invalidBalance.purchaseWearable('varsity-jacket', 'invalid-balance')).rejects.toThrow(/INVALID_PURCHASE_RESPONSE/)
    expect(invalidBalance.session().points.global).toBe(100)
  })

  it('keeps exactly one server-equipped item per wardrobe slot', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(success({
        ownedItemIds: ['radio-hoodie', 'varsity-jacket'],
        equipped: { top: 'radio-hoodie' },
        points: { spendable_points: 100 },
      }))
      .mockResolvedValueOnce(success({ todaySeconds: 0, monthSeconds: 0, totalSeconds: 0 }))
      .mockResolvedValueOnce(success({}))
    const adapter = createAdapter(fetchImpl, 100)
    await adapter.initialize()

    await adapter.equipWearable('varsity-jacket', 'top')

    expect(adapter.session().equippedWearableIds).toEqual(['varsity-jacket'])
  })

  it('uses Bearer auth and rotates the server heartbeat nonce', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(success({ session: { id: 'session-1' }, nonce: 'nonce-1' }, 201))
      .mockResolvedValueOnce(success({ session: { id: 'session-1' }, nonce: 'nonce-2', accepted_seconds: 10 }))
    const adapter = createAdapter(fetchImpl)

    await adapter.startStudySession('library', 'client-session-1')
    const accepted = await adapter.heartbeatStudySession({
      roomId: 'library', nodeId: 'front-left', seatId: 'front-left', position: { x: 4, y: 8 },
      interaction: 'seated', focused: true, foreground: true,
    })

    expect(accepted).toBe(10)
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://radiotedu.com/jukebox/api/v1/study/sessions/start')
    expect(fetchImpl.mock.calls[0]![1].headers.Authorization).toBe('Bearer access-token')
    expect(JSON.parse(fetchImpl.mock.calls[1]![1].body)).toMatchObject({ nonce: 'nonce-1', seatId: 'front-left' })
  })

  it('finishes idempotently and refreshes the authoritative summary', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(success({ session: { id: 'session-1' }, nonce: 'nonce-1' }, 201))
      .mockResolvedValueOnce(success({ session: { id: 'session-1' }, awarded_points: 3, spendable_points: 123 }))
      .mockResolvedValueOnce(success({ todaySeconds: 600, monthSeconds: 3600, totalSeconds: 7200 }))
    const adapter = createAdapter(fetchImpl)

    await adapter.startStudySession('chim-alan', 'client-session-2')
    const summary = await adapter.finishStudySession()
    const secondFinish = await adapter.finishStudySession()

    expect(summary).toEqual({ todaySeconds: 600, monthSeconds: 3600, totalSeconds: 7200 })
    expect(secondFinish).toEqual(summary)
    expect(adapter.session().points.global).toBe(123)
    expect(fetchImpl.mock.calls.filter(call => String(call[0]).includes('/finish'))).toHaveLength(1)
    const finishCall = fetchImpl.mock.calls.find(call => String(call[0]).includes('/finish'))
    expect(finishCall?.[1]).toMatchObject({ keepalive: true })
  })

  it('maps room presence and server chat without accepting anonymous fallback', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(success({
        instance: {
          id: 'library-2', roomId: 'library', number: 2,
          occupancy: 3, capacity: 51, preferredInstanceFull: false,
        },
      }))
      .mockResolvedValueOnce(success({
        presence: [{
          userId: 'user-2', displayName: 'Selin', roomId: 'library', instanceId: 'library-2', nodeId: 'quiet-window',
          position: { x: 2, y: 3 }, seatId: 'quiet-window', equipped: { hat: 'beanie' },
        }],
      }))
      .mockResolvedValueOnce(success({
        message: { id: 'message-1', userId: 'user-1', displayName: 'Ada', roomId: 'library', instanceId: 'library-2', text: 'Hello', createdAt: '2026-08-03T18:00:00.000Z' },
      }, 201))
    const adapter = createAdapter(fetchImpl)

    await adapter.enterRoom('library', 'bottom-center-aisle')
    const presence = await adapter.refreshPresence('library')
    const message = await adapter.sendChat('Hello', 'library')

    expect(presence[0]).toMatchObject({ userId: 'user-2', seatId: 'quiet-window', equippedWearableIds: ['beanie'] })
    expect(message).toMatchObject({ id: 'message-1', text: 'Hello' })
    expect(adapter.roomInstance?.('library')).toMatchObject({ id: 'library-2', number: 2, occupancy: 2, capacity: 51 })
    expect(fetchImpl.mock.calls[0]![0]).toContain('/instances/join')
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body)).toMatchObject({
      roomId: 'library', nodeId: 'bottom-center-aisle', clientSessionId: 'webview-session-1',
    })
    expect(fetchImpl.mock.calls[1]![0]).toContain('/presence?roomId=library&instanceId=library-2')
    expect(JSON.parse(fetchImpl.mock.calls[2]![1].body)).toMatchObject({ instanceId: 'library-2' })
    expect(fetchImpl.mock.calls[2]![1].headers.Authorization).toBe('Bearer access-token')
  })

  it('submits moderation reports through the authenticated room instance', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(success({
        instance: { id: 'library-4', roomId: 'library', number: 4, occupancy: 2, capacity: 51, preferredInstanceFull: false },
      }))
      .mockResolvedValueOnce(success({ accepted: true }, 201))
    const adapter = createAdapter(fetchImpl)

    await adapter.enterRoom('library', 'spawn')
    await adapter.reportPlayer('user-2', 'library', 'spam')

    expect(fetchImpl.mock.calls[1]![0]).toContain('/moderation/reports')
    const body = JSON.parse(fetchImpl.mock.calls[1]![1].body)
    expect(body).toMatchObject({ targetUserId: 'user-2', roomId: 'library', instanceId: 'library-4', reason: 'spam' })
    expect(body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('waits for one in-flight room join before sending presence heartbeat', async () => {
    let resolveJoin!: (value: ReturnType<typeof success>) => void
    const joinResponse = new Promise<ReturnType<typeof success>>((resolve) => { resolveJoin = resolve })
    const fetchImpl = vi.fn()
      .mockReturnValueOnce(joinResponse)
      .mockResolvedValueOnce(success({ presence: {} }))
    const adapter = createAdapter(fetchImpl)

    const joining = adapter.enterRoom('chim-alan', 'entrance')
    const heartbeat = adapter.heartbeatPresence?.({
      roomId: 'chim-alan', nodeId: 'entrance', seatId: null, position: { x: 50, y: 90 },
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    resolveJoin(success({
      instance: {
        id: 'chim-alan-1', roomId: 'chim-alan', number: 1,
        occupancy: 1, capacity: 9, preferredInstanceFull: false,
      },
    }))
    await Promise.all([joining, heartbeat])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchImpl.mock.calls[1]![1].body)).toMatchObject({
      roomId: 'chim-alan', instanceId: 'chim-alan-1', clientSessionId: 'webview-session-1',
    })
  })

  it('rejoins once when a stale presence assignment is rejected', async () => {
    const assigned = {
      instance: {
        id: 'library-1', roomId: 'library', number: 1,
        occupancy: 4, capacity: 51, preferredInstanceFull: false,
      },
    }
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(success(assigned))
      .mockResolvedValueOnce(failure(409, 'Study room instance rejoin required'))
      .mockResolvedValueOnce(success(assigned))
      .mockResolvedValueOnce(success({ presence: {} }))
    const adapter = createAdapter(fetchImpl)

    await adapter.enterRoom('library', 'bottom-center-aisle')
    await adapter.heartbeatPresence?.({
      roomId: 'library', nodeId: 'front-left', seatId: null, position: { x: 4, y: 8 },
    })

    expect(fetchImpl.mock.calls.filter((call) => String(call[0]).includes('/instances/join'))).toHaveLength(2)
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('rejects spoofed chat authors, unsafe text, and replayed heartbeat authority', async () => {
    const spoofedChat = vi.fn()
      .mockResolvedValueOnce(success({
        instance: { id: 'library-1', roomId: 'library', number: 1, occupancy: 1, capacity: 51 },
      }))
      .mockResolvedValueOnce(success({
        message: { id: 'spoofed', userId: 'attacker', displayName: 'Ada', text: 'Hello', createdAt: '2026-08-03T18:00:00.000Z' },
      }, 201))
    const chatAdapter = createAdapter(spoofedChat)
    await expect(chatAdapter.sendChat('Hello', 'library')).rejects.toThrow(/INVALID_CHAT_RESPONSE/)
    expect(JSON.parse(spoofedChat.mock.calls[1]![1].body).text).toBe('Hello')

    const heartbeatFetch = vi.fn()
      .mockResolvedValueOnce(success({ session: { id: 'session-1' }, nonce: 'nonce-1' }, 201))
      .mockResolvedValueOnce(success({ nonce: 'nonce-1', accepted_seconds: 10 }))
    const heartbeatAdapter = createAdapter(heartbeatFetch)
    await heartbeatAdapter.startStudySession('library', 'client-session-secure')
    await expect(heartbeatAdapter.heartbeatStudySession({
      roomId: 'library', nodeId: 'seat:front-left', seatId: 'front-left', position: { x: 4, y: 8 },
      interaction: 'seated', focused: true, foreground: true,
    })).rejects.toThrow(/INVALID_HEARTBEAT_RESPONSE/)

    const emptyAdapter = createAdapter(vi.fn())
    await expect(emptyAdapter.sendChat('\u202e\u200b', 'library')).rejects.toThrow(/CHAT_EMPTY/)
  })

  it('supports an authenticated bridge transport without exposing a bearer token to the game', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(success({ ownedItemIds: [], equipped: {}, points: { spendable_points: 75 } }))
      .mockResolvedValueOnce(success({ todaySeconds: 120, monthSeconds: 360, totalSeconds: 720 }))
    const adapter = new RadioTEDUStudyAdapter({
      apiBase: 'https://radiotedu.com/jukebox/api/v1/study',
      account: { id: 'user-1', displayName: 'Ada', authenticated: true },
      clientSessionId: 'webview-session-1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    await adapter.initialize()

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0]![1].headers).not.toHaveProperty('Authorization')
    expect(adapter.session().points.global).toBe(75)
  })

  it('uses the canonical gamification event service and marks joined events locally', async () => {
    const event = {
      id: 'campus-care',
      title: 'Campus Care Saturday',
      description: 'Clean shared campus spaces together.',
      location: 'TEDU Campus',
      starts_at: '2020-01-01T10:00:00.000Z',
      ends_at: '2099-01-01T12:00:00.000Z',
      check_in_points: 40,
    }
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(success({ events: [event] }))
      .mockResolvedValueOnce(success({ registration: { event_id: event.id } }, 201))
      .mockResolvedValueOnce(success({ events: [event] }))
    const adapter = createAdapter(fetchImpl)

    const [listed] = await adapter.listEvents()
    const joined = await adapter.registerEvent(event.id)

    expect(listed).toMatchObject({ id: event.id, rewardGold: 40, status: 'active', registered: false })
    expect(joined.registered).toBe(true)
    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      'https://radiotedu.com/jukebox/api/v1/gamification/events',
      'https://radiotedu.com/jukebox/api/v1/gamification/events/campus-care/register',
      'https://radiotedu.com/jukebox/api/v1/gamification/events',
    ])
    expect(fetchImpl.mock.calls[1]![1].headers.Authorization).toBe('Bearer access-token')
  })

  it('loads and validates the authoritative study home and leaderboard', async () => {
    const leaderboard = [{
      rank: 1, userId: 'user-1', displayName: 'Ada', studySeconds: 21_600, streakDays: 8,
    }]
    const fetchImpl = vi.fn().mockResolvedValueOnce(success({
      activePlayers: 24,
      summary: { todaySeconds: 1_800, monthSeconds: 28_800, totalSeconds: 90_000 },
      rooms: [
        { roomId: 'library', occupancy: 8, capacity: 51, instanceCount: 1 },
        { roomId: 'chim-alan', occupancy: 4, capacity: 9, instanceCount: 1 },
        { roomId: 'sports-center', occupancy: 3, capacity: 18, instanceCount: 1 },
        { roomId: 'auditorium', occupancy: 6, capacity: 90, instanceCount: 1 },
        { roomId: 'learning-lab', occupancy: 3, capacity: 24, instanceCount: 1 },
      ],
      leaderboard: { week: leaderboard, month: leaderboard, all: leaderboard },
      generatedAt: '2026-08-04T12:00:00.000Z',
    }))
    const adapter = createAdapter(fetchImpl)

    const home = await adapter.fetchHome()

    expect(home.activePlayers).toBe(24)
    expect(home.rooms).toHaveLength(5)
    expect(home.leaderboard.week[0]).toMatchObject({ rank: 1, displayName: 'Ada', isCurrentUser: true })
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://radiotedu.com/jukebox/api/v1/study/home')
  })

  it('rejects incomplete home authority and sanitizes leaderboard controls', async () => {
    const incomplete = createAdapter(vi.fn().mockResolvedValueOnce(success({
      activePlayers: 1,
      summary: {},
      rooms: [{ roomId: 'library', occupancy: 1, capacity: 51, instanceCount: 1 }],
      leaderboard: { week: [], month: [], all: [] },
    })))
    await expect(incomplete.fetchHome()).rejects.toThrow(/INVALID_HOME_RESPONSE/)

    const rooms = [
      { roomId: 'library', occupancy: 1, capacity: 51, instanceCount: 1 },
      { roomId: 'chim-alan', occupancy: 0, capacity: 9, instanceCount: 1 },
      { roomId: 'sports-center', occupancy: 0, capacity: 18, instanceCount: 1 },
      { roomId: 'auditorium', occupancy: 0, capacity: 90, instanceCount: 1 },
      { roomId: 'learning-lab', occupancy: 0, capacity: 24, instanceCount: 1 },
    ]
    const controlled = [{ rank: 1, userId: 'user-1', displayName: 'Ada\u202e Student', studySeconds: 60, streakDays: 2 }]
    const adapter = createAdapter(vi.fn().mockResolvedValueOnce(success({
      activePlayers: 1, summary: {}, rooms,
      leaderboard: { week: controlled, month: controlled, all: controlled },
    })))
    expect((await adapter.fetchHome()).leaderboard.week[0]!.displayName).toBe('Ada Student')
  })
})
