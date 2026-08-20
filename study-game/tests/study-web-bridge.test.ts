import { describe, expect, it, vi } from 'vitest'
import { createStudyWebBridge } from '../src/account/StudyWebBridge'
import type { StudyWebSession } from '../src/account/StudyAuthClient'

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const SESSION: StudyWebSession = Object.freeze({
  user: Object.freeze({
    id: 'user-1',
    email: 'student@tedu.edu.tr',
    display_name: 'TEDU Student',
    gold_balance: 240,
  }),
  csrf_token: 'csrf-proof',
})

describe('Study web-session bridge', () => {
  it('creates an authenticated Study identity and authoritative Gold seed', () => {
    const bridge = createStudyWebBridge(SESSION, { origin: 'https://radiotedu.com' })
    expect(bridge.apiBase).toBe('/jukebox/api/v1/study')
    expect(bridge.account).toEqual({ id: 'user-1', displayName: 'TEDU Student', authenticated: true })
    expect(bridge.globalPoints).toBe(240)
  })

  it('uses same-origin cookies without adding CSRF to safe reads', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response('{}', { status: 200 }))
    const bridge = createStudyWebBridge(SESSION, { origin: 'https://radiotedu.com' }, fetchImpl)
    await bridge.fetchImpl('/jukebox/api/v1/study/avatar/me')
    const [input, init] = fetchImpl.mock.calls[0]!
    expect(input).toBe('/jukebox/api/v1/study/avatar/me')
    expect(init?.credentials).toBe('same-origin')
    expect(new Headers(init?.headers).has('X-RadioTEDU-CSRF')).toBe(false)
  })

  it('adds the web-session CSRF proof to Study and Gold mutations', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response('{}', { status: 200 }))
    const bridge = createStudyWebBridge(SESSION, { origin: 'https://radiotedu.com' }, fetchImpl)
    await bridge.fetchImpl('/jukebox/api/v1/economy/activity', { method: 'POST', body: '{}' })
    const [, init] = fetchImpl.mock.calls[0]!
    expect(init?.credentials).toBe('same-origin')
    expect(new Headers(init?.headers).get('X-RadioTEDU-CSRF')).toBe('csrf-proof')
  })

  it('rejects cross-origin and out-of-scope requests before fetch', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response('{}', { status: 200 }))
    const bridge = createStudyWebBridge(SESSION, { origin: 'https://radiotedu.com' }, fetchImpl)
    await expect(bridge.fetchImpl('https://example.com/jukebox/api/v1/study/avatar/me')).rejects.toThrow('same-origin API scope')
    await expect(bridge.fetchImpl('/wp-json/wp/v2/users')).rejects.toThrow('same-origin API scope')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails closed when identity or CSRF proof is missing', () => {
    expect(() => createStudyWebBridge({ user: { id: '' }, csrf_token: '' }, { origin: 'https://radiotedu.com' })).toThrow('verified RadioTEDU web session')
  })
})
