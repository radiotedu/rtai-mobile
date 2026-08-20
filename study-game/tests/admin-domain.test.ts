import { describe, expect, it } from 'vitest'
import { hasPermission, normalizeBanDraft, type AdminSession } from '../src/admin/AdminDomain'

const session: AdminSession = {
  operator: { id: 'operator-1', displayName: 'Moderator' },
  permissions: ['study.moderation.read', 'study.moderation.ban'],
  expiresAt: '2026-08-09T20:00:00.000Z',
}

describe('admin moderation domain', () => {
  it('normalizes a temporary ban without trusting a client duration in milliseconds', () => {
    expect(normalizeBanDraft({
      targetUserId: ' user-1 ', displayName: 'Selin', confirmation: 'Selin',
      reason: 'harassment', note: '  Repeated   unwanted messages. ', duration: '24h',
    }, Date.parse('2026-08-09T12:00:00.000Z'))).toEqual({
      targetUserId: 'user-1',
      reason: 'harassment',
      note: 'Repeated unwanted messages.',
      expiresAt: '2026-08-10T12:00:00.000Z',
    })
  })

  it('represents permanent bans with a null expiry', () => {
    expect(normalizeBanDraft({
      targetUserId: 'user-1', displayName: 'Selin', confirmation: 'Selin',
      reason: 'other', note: 'Confirmed policy breach.', duration: 'permanent',
    }).expiresAt).toBeNull()
  })

  it('requires an exact display-name confirmation and a useful audit note', () => {
    expect(() => normalizeBanDraft({
      targetUserId: 'user-1', displayName: 'Selin', confirmation: 'selin',
      reason: 'spam', note: 'Repeated spam.', duration: '1h',
    })).toThrow('CONFIRMATION_MISMATCH')
    expect(() => normalizeBanDraft({
      targetUserId: 'user-1', displayName: 'Selin', confirmation: 'Selin',
      reason: 'spam', note: 'x', duration: '1h',
    })).toThrow('INVALID_NOTE')
  })

  it('never infers a moderation permission from read access', () => {
    expect(hasPermission(session, 'study.moderation.read')).toBe(true)
    expect(hasPermission(session, 'study.moderation.ban')).toBe(true)
    expect(hasPermission(session, 'study.moderation.unban')).toBe(false)
  })
})
