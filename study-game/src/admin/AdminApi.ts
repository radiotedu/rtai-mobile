import {
  ADMIN_PERMISSIONS,
  MODERATION_REASONS,
  type AdminPermission,
  type AdminSession,
  type ModerationAuditEvent,
  type ModerationBan,
  type ModerationOverview,
  type ModerationReason,
  type ModerationReport,
  type ModerationReportStatus,
  type ModerationUser,
} from './AdminDomain'

interface ApiEnvelope<T> { success?: boolean; data?: T; message?: string; error?: string }

export interface AdminTransport {
  session(): Promise<AdminSession>
  overview(): Promise<ModerationOverview>
  users(query?: string, status?: 'all' | 'active' | 'banned'): Promise<readonly ModerationUser[]>
  reports(status?: 'all' | ModerationReportStatus): Promise<readonly ModerationReport[]>
  audit(): Promise<readonly ModerationAuditEvent[]>
  ban(input: { targetUserId: string; reason: ModerationReason; note: string; expiresAt: string | null; idempotencyKey: string }): Promise<ModerationUser>
  unban(input: { banId: string; targetUserId: string; note: string; idempotencyKey: string }): Promise<ModerationUser>
  reviewReport(input: { reportId: string; status: 'resolved' | 'dismissed'; note: string; idempotencyKey: string }): Promise<ModerationReport>
}

export interface StudyAdminBridge {
  apiBase: string
  request: typeof fetch
}

export class RemoteAdminTransport implements AdminTransport {
  readonly #base: string
  readonly #requestImpl: typeof fetch

  constructor(bridge: StudyAdminBridge, locationOrigin: string) {
    const baseUrl = new URL(bridge.apiBase, locationOrigin)
    if (
      baseUrl.origin !== locationOrigin || !baseUrl.pathname.startsWith('/')
      || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash
    ) throw new Error('INVALID_ADMIN_API_BASE')
    this.#base = baseUrl.href.replace(/\/+$/, '')
    this.#requestImpl = bridge.request
  }

  session() { return this.#request<AdminSession>('/session') }
  overview() { return this.#request<ModerationOverview>('/overview') }
  users(query = '', status: 'all' | 'active' | 'banned' = 'all') {
    const search = new URLSearchParams({ query: query.trim().slice(0, 80), status })
    return this.#request<readonly ModerationUser[]>(`/users?${search}`)
  }
  reports(status: 'all' | ModerationReportStatus = 'open') {
    return this.#request<readonly ModerationReport[]>(`/reports?status=${encodeURIComponent(status)}`)
  }
  audit() { return this.#request<readonly ModerationAuditEvent[]>('/audit') }
  ban(input: { targetUserId: string; reason: ModerationReason; note: string; expiresAt: string | null; idempotencyKey: string }) {
    return this.#request<ModerationUser>('/bans', { method: 'POST', body: input })
  }
  unban(input: { banId: string; targetUserId: string; note: string; idempotencyKey: string }) {
    return this.#request<ModerationUser>(`/bans/${encodeURIComponent(input.banId)}/revoke`, { method: 'POST', body: input })
  }
  reviewReport(input: { reportId: string; status: 'resolved' | 'dismissed'; note: string; idempotencyKey: string }) {
    return this.#request<ModerationReport>(`/reports/${encodeURIComponent(input.reportId)}`, { method: 'PATCH', body: input })
  }

  async #request<T>(path: string, options: { method?: 'GET' | 'POST' | 'PATCH'; body?: object } = {}): Promise<T> {
    const response = await this.#requestImpl(`${this.#base}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store',
        'X-Study-Admin-Intent': 'moderation-console',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    const envelope = await response.json() as ApiEnvelope<T>
    if (!response.ok || envelope.success !== true || envelope.data === undefined) {
      throw new Error(envelope.message ?? envelope.error ?? `Admin request failed (${response.status})`)
    }
    return envelope.data
  }
}

export class LocalAdminTransport implements AdminTransport {
  readonly #now: () => number
  readonly #users: ModerationUser[]
  readonly #reports: ModerationReport[]
  readonly #audit: ModerationAuditEvent[] = []
  readonly #operator = { id: 'operator-local', displayName: 'RadioTEDU Broadcast Manager' }

  constructor(now: () => number = Date.now) {
    this.#now = now
    const seen = new Date(now() - 4 * 60_000).toISOString()
    this.#users = [
      { userId: 'study-selin', displayName: 'Selin', status: 'active', roomId: 'library', instanceId: 'library-1', lastSeenAt: seen, openReportCount: 1, activeBan: null },
      { userId: 'study-mert', displayName: 'Mert', status: 'active', roomId: 'chim-alan', instanceId: 'chim-alan-1', lastSeenAt: seen, openReportCount: 0, activeBan: null },
      { userId: 'study-deniz', displayName: 'Deniz', status: 'active', roomId: 'auditorium', instanceId: 'auditorium-1', lastSeenAt: seen, openReportCount: 2, activeBan: null },
      { userId: 'study-arda', displayName: 'Arda', status: 'banned', roomId: null, instanceId: null, lastSeenAt: seen, openReportCount: 0, activeBan: { id: 'ban-seed-1', reason: 'spam', note: 'Repeated room chat flooding.', createdAt: new Date(now() - 86_400_000).toISOString(), expiresAt: new Date(now() + 6 * 86_400_000).toISOString(), createdByDisplayName: this.#operator.displayName } },
    ]
    this.#reports = [
      { id: 'report-1', targetUserId: 'study-selin', targetDisplayName: 'Selin', reporterDisplayName: 'Campus student', reason: 'harassment', roomId: 'library', summary: 'Repeated unwanted messages during a focus session.', createdAt: new Date(now() - 25 * 60_000).toISOString(), status: 'open' },
      { id: 'report-2', targetUserId: 'study-deniz', targetDisplayName: 'Deniz', reporterDisplayName: 'Campus student', reason: 'spam', roomId: 'auditorium', summary: 'Repeated identical messages.', createdAt: new Date(now() - 55 * 60_000).toISOString(), status: 'open' },
    ]
  }

  async session(): Promise<AdminSession> {
    return { operator: this.#operator, permissions: [...ADMIN_PERMISSIONS], expiresAt: new Date(this.#now() + 30 * 60_000).toISOString() }
  }
  async overview(): Promise<ModerationOverview> {
    return { onlineUsers: this.#users.filter((user) => user.roomId).length, activeBans: this.#users.filter((user) => user.status === 'banned').length, openReports: this.#reports.filter((report) => report.status === 'open').length, actionsToday: this.#audit.length }
  }
  async users(query = '', status: 'all' | 'active' | 'banned' = 'all'): Promise<readonly ModerationUser[]> {
    const normalized = query.trim().toLocaleLowerCase('en')
    return this.#users.filter((user) => (!normalized || `${user.displayName} ${user.userId}`.toLocaleLowerCase('en').includes(normalized)) && (status === 'all' || user.status === status)).map(cloneUser)
  }
  async reports(status: 'all' | ModerationReportStatus = 'open'): Promise<readonly ModerationReport[]> {
    return this.#reports.filter((report) => status === 'all' || report.status === status).map((report) => ({ ...report }))
  }
  async audit(): Promise<readonly ModerationAuditEvent[]> { return this.#audit.map((event) => ({ ...event })) }
  async ban(input: { targetUserId: string; reason: ModerationReason; note: string; expiresAt: string | null; idempotencyKey: string }): Promise<ModerationUser> {
    const user = this.#requiredUser(input.targetUserId)
    if (user.status === 'banned') throw new Error('User already has an active Study ban.')
    const ban: ModerationBan = { id: `ban-${crypto.randomUUID()}`, reason: input.reason, note: input.note, createdAt: new Date(this.#now()).toISOString(), expiresAt: input.expiresAt, createdByDisplayName: this.#operator.displayName }
    Object.assign(user, { status: 'banned' as const, roomId: null, instanceId: null, activeBan: ban })
    this.#audit.unshift(this.#event('ban-created', user, input.reason, input.note, input.expiresAt, input.idempotencyKey))
    return cloneUser(user)
  }
  async unban(input: { banId: string; targetUserId: string; note: string; idempotencyKey: string }): Promise<ModerationUser> {
    const user = this.#requiredUser(input.targetUserId)
    if (!user.activeBan || user.activeBan.id !== input.banId) throw new Error('Active ban was not found.')
    const reason = user.activeBan.reason
    Object.assign(user, { status: 'active' as const, activeBan: null })
    this.#audit.unshift(this.#event('ban-revoked', user, reason, input.note, null, input.idempotencyKey))
    return cloneUser(user)
  }
  async reviewReport(input: { reportId: string; status: 'resolved' | 'dismissed'; note: string; idempotencyKey: string }): Promise<ModerationReport> {
    const report = this.#reports.find((candidate) => candidate.id === input.reportId)
    if (!report || report.status !== 'open') throw new Error('Open report was not found.')
    report.status = input.status
    const user = this.#requiredUser(report.targetUserId)
    user.openReportCount = Math.max(0, user.openReportCount - 1)
    this.#audit.unshift(this.#event(input.status === 'resolved' ? 'report-resolved' : 'report-dismissed', user, report.reason, input.note, null, input.idempotencyKey))
    return { ...report }
  }

  #requiredUser(userId: string) {
    const user = this.#users.find((candidate) => candidate.userId === userId)
    if (!user) throw new Error('User was not found.')
    return user
  }
  #event(action: ModerationAuditEvent['action'], user: ModerationUser, reason: ModerationReason, note: string, expiresAt: string | null, requestId: string): ModerationAuditEvent {
    return { id: `audit-${crypto.randomUUID()}`, action, actorDisplayName: this.#operator.displayName, targetUserId: user.userId, targetDisplayName: user.displayName, reason, note, createdAt: new Date(this.#now()).toISOString(), expiresAt, requestId }
  }
}

function cloneUser(user: ModerationUser): ModerationUser {
  return { ...user, activeBan: user.activeBan ? { ...user.activeBan } : null }
}

export function validateAdminSession(value: AdminSession): AdminSession {
  if (!value?.operator?.id || !value.operator.displayName || !Number.isFinite(Date.parse(value.expiresAt))) throw new Error('INVALID_ADMIN_SESSION')
  const permissions = value.permissions.filter((permission): permission is AdminPermission => ADMIN_PERMISSIONS.includes(permission as AdminPermission))
  return { operator: { id: value.operator.id, displayName: value.operator.displayName.slice(0, 80) }, permissions: [...new Set(permissions)], expiresAt: value.expiresAt }
}

export function isModerationReason(value: unknown): value is ModerationReason {
  return typeof value === 'string' && MODERATION_REASONS.includes(value as ModerationReason)
}
