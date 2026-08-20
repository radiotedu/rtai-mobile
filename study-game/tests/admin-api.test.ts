import { describe, expect, it, vi } from 'vitest'
import { LocalAdminTransport, RemoteAdminTransport, validateAdminSession } from '../src/admin/AdminApi'

describe('Study admin API', () => {
  it('allows only same-origin admin API roots without credentials, queries, or fragments', () => {
    const request = vi.fn<typeof fetch>()
    expect(() => new RemoteAdminTransport({ apiBase: 'https://evil.example/admin', request }, 'https://radiotedu.com')).toThrow('INVALID_ADMIN_API_BASE')
    expect(() => new RemoteAdminTransport({ apiBase: '/api/admin?token=bad', request }, 'https://radiotedu.com')).toThrow('INVALID_ADMIN_API_BASE')
    expect(() => new RemoteAdminTransport({ apiBase: '/jukebox/api/v1/study/admin', request }, 'https://radiotedu.com')).not.toThrow()
  })

  it('uses explicit JSON, same-origin credentials, a moderation intent header, and an idempotency key', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { userId: 'user-1', displayName: 'Selin', status: 'banned', roomId: null, instanceId: null, lastSeenAt: null, openReportCount: 0, activeBan: null },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const api = new RemoteAdminTransport({ apiBase: '/jukebox/api/v1/study/admin', request }, 'https://radiotedu.com')
    await api.ban({ targetUserId: 'user-1', reason: 'spam', note: 'Repeated chat spam.', expiresAt: null, idempotencyKey: 'request-1' })
    expect(request).toHaveBeenCalledOnce()
    const [url, init] = request.mock.calls[0]!
    expect(url).toBe('https://radiotedu.com/jukebox/api/v1/study/admin/bans')
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' })
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json', 'X-Study-Admin-Intent': 'moderation-console' })
    expect(JSON.parse(String(init?.body))).toMatchObject({ targetUserId: 'user-1', idempotencyKey: 'request-1' })
  })

  it('models server-confirmed ban, revocation, report review, and audit history in local QA', async () => {
    const now = Date.parse('2026-08-09T12:00:00.000Z')
    const api = new LocalAdminTransport(() => now)
    const banned = await api.ban({ targetUserId: 'study-selin', reason: 'harassment', note: 'Confirmed harassment report.', expiresAt: '2026-08-10T12:00:00.000Z', idempotencyKey: 'ban-1' })
    expect(banned.status).toBe('banned')
    expect(banned.roomId).toBeNull()
    const restored = await api.unban({ banId: banned.activeBan!.id, targetUserId: banned.userId, note: 'Appeal accepted.', idempotencyKey: 'unban-1' })
    expect(restored.status).toBe('active')
    const report = await api.reviewReport({ reportId: 'report-1', status: 'resolved', note: 'Reviewed evidence.', idempotencyKey: 'report-review-1' })
    expect(report.status).toBe('resolved')
    expect((await api.audit()).map((event) => event.action)).toEqual(['report-resolved', 'ban-revoked', 'ban-created'])
  })

  it('drops unknown capabilities from the server session', () => {
    expect(validateAdminSession({
      operator: { id: 'operator-1', displayName: 'Moderator' },
      permissions: ['study.moderation.read', 'root.everything'] as never,
      expiresAt: '2026-08-09T20:00:00.000Z',
    }).permissions).toEqual(['study.moderation.read'])
  })
})
