export const ADMIN_PERMISSIONS = Object.freeze([
  'study.moderation.read',
  'study.moderation.ban',
  'study.moderation.unban',
  'study.moderation.reports',
  'study.moderation.audit',
] as const)

export type AdminPermission = typeof ADMIN_PERMISSIONS[number]
export type ModerationUserStatus = 'active' | 'banned'
export type ModerationReportStatus = 'open' | 'resolved' | 'dismissed'
export type ModerationReason = 'harassment' | 'spam' | 'hate-speech' | 'impersonation' | 'cheating' | 'other'
export type BanDuration = '1h' | '24h' | '7d' | '30d' | 'permanent'

export interface AdminSession {
  operator: { id: string; displayName: string }
  permissions: readonly AdminPermission[]
  expiresAt: string
}

export interface ModerationBan {
  id: string
  reason: ModerationReason
  note: string
  createdAt: string
  expiresAt: string | null
  createdByDisplayName: string
}

export interface ModerationUser {
  userId: string
  displayName: string
  status: ModerationUserStatus
  roomId: string | null
  instanceId: string | null
  lastSeenAt: string | null
  openReportCount: number
  activeBan: ModerationBan | null
}

export interface ModerationReport {
  id: string
  targetUserId: string
  targetDisplayName: string
  reporterDisplayName: string
  reason: ModerationReason
  roomId: string
  summary: string
  createdAt: string
  status: ModerationReportStatus
}

export interface ModerationAuditEvent {
  id: string
  action: 'ban-created' | 'ban-revoked' | 'report-resolved' | 'report-dismissed'
  actorDisplayName: string
  targetUserId: string
  targetDisplayName: string
  reason: ModerationReason
  note: string
  createdAt: string
  expiresAt: string | null
  requestId: string
}

export interface ModerationOverview {
  onlineUsers: number
  activeBans: number
  openReports: number
  actionsToday: number
}

export interface BanDraft {
  targetUserId: string
  reason: ModerationReason
  note: string
  duration: BanDuration
  confirmation: string
  displayName: string
}

export const MODERATION_REASONS: readonly ModerationReason[] = Object.freeze([
  'harassment', 'spam', 'hate-speech', 'impersonation', 'cheating', 'other',
])

export const BAN_DURATIONS: readonly BanDuration[] = Object.freeze(['1h', '24h', '7d', '30d', 'permanent'])

export function hasPermission(session: AdminSession, permission: AdminPermission): boolean {
  return session.permissions.includes(permission)
}

export function normalizeBanDraft(draft: BanDraft, now = Date.now()): {
  targetUserId: string
  reason: ModerationReason
  note: string
  expiresAt: string | null
} {
  const targetUserId = draft.targetUserId.trim()
  const note = draft.note.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!targetUserId || targetUserId.length > 160) throw new Error('INVALID_TARGET')
  if (!MODERATION_REASONS.includes(draft.reason)) throw new Error('INVALID_REASON')
  if (note.length < 3 || note.length > 500) throw new Error('INVALID_NOTE')
  if (draft.confirmation.trim() !== draft.displayName.trim()) throw new Error('CONFIRMATION_MISMATCH')
  if (!BAN_DURATIONS.includes(draft.duration)) throw new Error('INVALID_DURATION')

  const durationMs: Record<Exclude<BanDuration, 'permanent'>, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }
  return {
    targetUserId,
    reason: draft.reason,
    note,
    expiresAt: draft.duration === 'permanent' ? null : new Date(now + durationMs[draft.duration]).toISOString(),
  }
}

export function formatModerationReason(reason: ModerationReason): string {
  return ({
    harassment: 'Harassment',
    spam: 'Spam',
    'hate-speech': 'Hate speech',
    impersonation: 'Impersonation',
    cheating: 'Study or Gold abuse',
    other: 'Other policy breach',
  })[reason]
}

export function formatTimestamp(value: string | null): string {
  if (!value) return 'Not online'
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed) : 'Unknown'
}
