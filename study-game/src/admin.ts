import './admin.css'

import { Ban, Flag, History, LockKeyhole, Radio, Search, ShieldCheck, UserRoundCheck, UsersRound, createIcons } from 'lucide'
import { LocalAdminTransport, RemoteAdminTransport, validateAdminSession, type AdminTransport } from './admin/AdminApi'
import {
  BAN_DURATIONS,
  MODERATION_REASONS,
  formatModerationReason,
  formatTimestamp,
  hasPermission,
  normalizeBanDraft,
  type AdminSession,
  type BanDuration,
  type ModerationAuditEvent,
  type ModerationOverview,
  type ModerationReason,
  type ModerationReport,
  type ModerationUser,
} from './admin/AdminDomain'

const root = document.querySelector<HTMLElement>('#admin-root')
if (!root) throw new Error('Admin root is missing')

const transport = resolveTransport()
if (!transport) {
  renderLocked('Administrator session required', 'Sign in with a RadioTEDU account that has Study moderation permission. This page never accepts preview keys or browser-stored admin tokens.')
} else {
  void boot(transport)
}

async function boot(api: AdminTransport) {
  try {
    const session = validateAdminSession(await api.session())
    if (!hasPermission(session, 'study.moderation.read')) {
      renderLocked('Access denied', 'Your authenticated RadioTEDU account does not have permission to open the Study moderation console.')
      return
    }
    renderShell(session)
    bindNavigation()
    bindUserSearch(api, session)
    await refreshAll(api, session)
  } catch (error) {
    renderLocked('Moderation console unavailable', safeError(error))
  }
}

let users: readonly ModerationUser[] = []
let reports: readonly ModerationReport[] = []
let auditEvents: readonly ModerationAuditEvent[] = []
let selectedUserId: string | null = null

async function refreshAll(api: AdminTransport, session: AdminSession, query = '', status: 'all' | 'active' | 'banned' = 'all') {
  setAlert('Loading server-authoritative moderation data…', 'info')
  try {
    const [overview, nextUsers, nextReports, nextAudit] = await Promise.all([
      api.overview(), api.users(query, status), api.reports('open'), api.audit(),
    ])
    users = nextUsers
    reports = nextReports
    auditEvents = nextAudit
    if (selectedUserId && !users.some((user) => user.userId === selectedUserId)) selectedUserId = null
    renderOverview(overview)
    renderUsers(api, session)
    renderReports(api, session)
    renderAudit()
    setAlert('', 'info')
  } catch (error) {
    setAlert(safeError(error), 'error')
  }
}

function renderShell(session: AdminSession) {
  root!.innerHTML = `
    <section class="admin-shell">
      <header class="admin-topbar">
        <div class="admin-brand"><span><i data-lucide="radio" aria-hidden="true"></i></span><b><strong>RadioTEDU Study</strong><small>MODERATION CONSOLE</small></b></div>
        <span class="admin-environment">SERVER AUTHORITY</span>
        <div class="admin-operator"><span class="operator-avatar" id="operator-avatar"></span><span class="operator-copy"><strong id="operator-name"></strong><small>AUTHORIZED OPERATOR</small></span></div>
      </header>
      <div class="admin-content">
        <section class="admin-intro"><div><h1>Campus safety</h1><p>Review Study reports and apply scoped sanctions. Every state-changing action is confirmed by the server and written to the immutable moderation audit trail.</p></div><span class="admin-security"><i data-lucide="shield-check" aria-hidden="true"></i> Deny by default · audited actions</span></section>
        <output id="admin-alert" class="admin-alert" aria-live="polite"></output>
        <section class="admin-stats" aria-label="Moderation overview">
          <article class="admin-stat"><span><i data-lucide="users-round" aria-hidden="true"></i></span><b><strong id="stat-online">—</strong><small>Online now</small></b></article>
          <article class="admin-stat"><span><i data-lucide="ban" aria-hidden="true"></i></span><b><strong id="stat-bans">—</strong><small>Active Study bans</small></b></article>
          <article class="admin-stat"><span><i data-lucide="flag" aria-hidden="true"></i></span><b><strong id="stat-reports">—</strong><small>Open reports</small></b></article>
          <article class="admin-stat"><span><i data-lucide="history" aria-hidden="true"></i></span><b><strong id="stat-actions">—</strong><small>Actions today</small></b></article>
        </section>
        <nav class="admin-tabs" aria-label="Moderation sections">
          <button type="button" data-admin-tab="users" aria-selected="true">Students</button>
          <button type="button" data-admin-tab="reports" aria-selected="false">Reports <span id="report-tab-count"></span></button>
          <button type="button" data-admin-tab="audit" aria-selected="false">Audit log</button>
        </nav>
        <section id="view-users" class="admin-view">
          <div class="moderation-grid">
            <section class="admin-card">
              <header><span><strong>Study users</strong><small>Public profile and Study status only</small></span></header>
              <form id="user-search" class="admin-search"><input id="user-query" type="search" maxlength="80" autocomplete="off" placeholder="Search display name or public user ID" aria-label="Search Study users" /><select id="user-status" aria-label="Filter Study users"><option value="all">All statuses</option><option value="active">Active</option><option value="banned">Banned</option></select><button type="submit"><i data-lucide="search" aria-hidden="true"></i><span>Search</span></button></form>
              <div id="user-list" data-testid="admin-user-list"></div>
            </section>
            <aside class="admin-card"><header><span><strong>Moderation action</strong><small>Server-confirmed and reversible</small></span></header><div id="user-detail" class="user-detail"><div class="detail-placeholder">Select a Study user to review their status.</div></div></aside>
          </div>
        </section>
        <section id="view-reports" class="admin-view" hidden><section class="admin-card"><header><span><strong>Open reports</strong><small>Reports never create automatic sanctions</small></span></header><div id="report-list" class="report-list" data-testid="admin-report-list"></div></section></section>
        <section id="view-audit" class="admin-view" hidden><section class="admin-card"><header><span><strong>Moderation audit</strong><small>Read-only record returned by the server</small></span></header><div id="audit-list" class="audit-list" data-testid="admin-audit-list"></div></section></section>
      </div>
    </section>`
  document.querySelector('#operator-avatar')!.textContent = session.operator.displayName.trim().slice(0, 1).toUpperCase() || 'R'
  document.querySelector('#operator-name')!.textContent = session.operator.displayName
  refreshIcons()
}

function renderOverview(overview: ModerationOverview) {
  text('#stat-online', overview.onlineUsers)
  text('#stat-bans', overview.activeBans)
  text('#stat-reports', overview.openReports)
  text('#stat-actions', overview.actionsToday)
  text('#report-tab-count', overview.openReports ? `(${overview.openReports})` : '')
}

function renderUsers(api: AdminTransport, session: AdminSession) {
  const host = document.querySelector<HTMLElement>('#user-list')!
  host.replaceChildren()
  if (!users.length) {
    const empty = document.createElement('p')
    empty.className = 'empty-state'
    empty.textContent = 'No Study users match this filter.'
    host.append(empty)
    renderUserDetail(api, session)
    return
  }
  const table = document.createElement('table')
  table.className = 'user-table'
  table.innerHTML = '<thead><tr><th>User</th><th>Status</th><th>Room</th><th>Reports</th></tr></thead>'
  const body = document.createElement('tbody')
  for (const user of users) {
    const row = document.createElement('tr')
    row.tabIndex = 0
    row.dataset.userId = user.userId
    row.dataset.selected = String(user.userId === selectedUserId)
    row.setAttribute('aria-label', `Review ${user.displayName}`)
    const identity = document.createElement('td')
    const identityWrap = document.createElement('span')
    identityWrap.className = 'user-identity'
    const avatar = document.createElement('span')
    avatar.textContent = user.displayName.trim().slice(0, 1).toUpperCase() || 'R'
    const copy = document.createElement('b')
    const name = document.createElement('strong')
    name.textContent = user.displayName
    const id = document.createElement('small')
    id.textContent = user.userId
    copy.append(name, id)
    identityWrap.append(avatar, copy)
    identity.append(identityWrap)
    const status = document.createElement('td')
    const statusPill = document.createElement('span')
    statusPill.className = 'status-pill'
    statusPill.dataset.status = user.status
    statusPill.textContent = user.status
    status.append(statusPill)
    const room = document.createElement('td')
    room.textContent = user.roomId ?? 'Offline'
    const reportCount = document.createElement('td')
    reportCount.textContent = String(user.openReportCount)
    row.append(identity, status, room, reportCount)
    const select = () => {
      selectedUserId = user.userId
      renderUsers(api, session)
    }
    row.addEventListener('click', select)
    row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select() } })
    body.append(row)
  }
  table.append(body)
  host.append(table)
  renderUserDetail(api, session)
}

function renderUserDetail(api: AdminTransport, session: AdminSession) {
  const host = document.querySelector<HTMLElement>('#user-detail')!
  host.replaceChildren()
  const user = users.find((candidate) => candidate.userId === selectedUserId)
  if (!user) {
    const placeholder = document.createElement('div')
    placeholder.className = 'detail-placeholder'
    placeholder.textContent = 'Select a Study user to review their status.'
    host.append(placeholder)
    return
  }
  const header = document.createElement('div')
  header.className = 'detail-user'
  const avatar = document.createElement('b')
  avatar.className = 'detail-avatar'
  avatar.textContent = user.displayName.trim().slice(0, 1).toUpperCase() || 'R'
  const identity = document.createElement('span')
  const name = document.createElement('strong')
  name.textContent = user.displayName
  const id = document.createElement('small')
  id.textContent = user.userId
  identity.append(name, id)
  const pill = document.createElement('em')
  pill.className = 'status-pill'
  pill.dataset.status = user.status
  pill.textContent = user.status
  header.append(avatar, identity, pill)
  const meta = document.createElement('div')
  meta.className = 'detail-meta'
  meta.append(metaCell('Current room', user.roomId ? `${user.roomId} · ${user.instanceId ?? 'assigned'}` : 'Offline'), metaCell('Last seen', formatTimestamp(user.lastSeenAt)), metaCell('Open reports', String(user.openReportCount)), metaCell('Scope', 'RadioTEDU Study'))
  host.append(header, meta)
  if (user.status === 'banned' && user.activeBan) renderUnban(api, session, host, user)
  else renderBan(api, session, host, user)
}

function renderBan(api: AdminTransport, session: AdminSession, host: HTMLElement, user: ModerationUser) {
  const form = document.createElement('form')
  form.className = 'ban-form'
  form.dataset.testid = 'admin-ban-form'
  const heading = document.createElement('h3')
  heading.textContent = 'Create Study ban'
  const copy = document.createElement('p')
  copy.textContent = 'A ban immediately removes this account from Study rooms, releases its seat, and invalidates active Study sessions. It does not alter the main RadioTEDU account.'
  const reason = selectField('Reason', 'ban-reason', MODERATION_REASONS.map((value) => ({ value, label: formatModerationReason(value) })))
  const duration = selectField('Duration', 'ban-duration', BAN_DURATIONS.map((value) => ({ value, label: value === 'permanent' ? 'Permanent' : value })))
  const note = textareaField('Internal moderation note', 'ban-note', 'Explain the evidence and policy basis (3–500 characters).')
  const confirm = inputField(`Type “${user.displayName}” to confirm`, 'ban-confirmation', user.displayName)
  const footer = document.createElement('footer')
  const hint = document.createElement('small')
  hint.textContent = 'The server re-checks your permission and records the request ID.'
  const submit = document.createElement('button')
  submit.type = 'submit'
  submit.className = 'danger-action'
  submit.textContent = 'Ban from Study'
  submit.disabled = !hasPermission(session, 'study.moderation.ban')
  footer.append(hint, submit)
  form.append(heading, copy, reason, duration, note, confirm, footer)
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (submit.disabled) return
    try {
      submit.disabled = true
      const payload = normalizeBanDraft({
        targetUserId: user.userId,
        displayName: user.displayName,
        reason: value<HTMLSelectElement>('#ban-reason', form) as ModerationReason,
        duration: value<HTMLSelectElement>('#ban-duration', form) as BanDuration,
        note: value<HTMLTextAreaElement>('#ban-note', form),
        confirmation: value<HTMLInputElement>('#ban-confirmation', form),
      })
      await api.ban({ ...payload, idempotencyKey: crypto.randomUUID() })
      await refreshAll(api, session)
      setAlert(`${user.displayName} was banned from RadioTEDU Study.`, 'success')
    } catch (error) {
      setAlert(safeError(error), 'error')
      submit.disabled = false
    }
  })
  host.append(form)
}

function renderUnban(api: AdminTransport, session: AdminSession, host: HTMLElement, user: ModerationUser) {
  const ban = user.activeBan!
  const summary = document.createElement('section')
  summary.className = 'active-ban'
  const title = document.createElement('b')
  title.textContent = `${formatModerationReason(ban.reason)} · ${ban.expiresAt ? `until ${formatTimestamp(ban.expiresAt)}` : 'permanent'}`
  const note = document.createElement('p')
  note.textContent = ban.note
  summary.append(title, note)
  const form = document.createElement('form')
  form.className = 'unban-form'
  form.dataset.testid = 'admin-unban-form'
  const heading = document.createElement('h3')
  heading.textContent = 'Revoke active ban'
  const copy = document.createElement('p')
  copy.textContent = 'Revocation is audited and restores access only after the server confirms it.'
  const revocationNote = textareaField('Revocation note', 'unban-note', 'Explain why this ban should be removed.')
  const footer = document.createElement('footer')
  const hint = document.createElement('small')
  hint.textContent = `Created by ${ban.createdByDisplayName}`
  const submit = document.createElement('button')
  submit.type = 'submit'
  submit.className = 'secondary-action'
  submit.textContent = 'Revoke ban'
  submit.disabled = !hasPermission(session, 'study.moderation.unban')
  footer.append(hint, submit)
  form.append(heading, copy, revocationNote, footer)
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const noteValue = value<HTMLTextAreaElement>('#unban-note', form).replace(/\s+/g, ' ').trim()
    if (noteValue.length < 3 || noteValue.length > 500) { setAlert('A 3–500 character revocation note is required.', 'error'); return }
    try {
      submit.disabled = true
      await api.unban({ banId: ban.id, targetUserId: user.userId, note: noteValue, idempotencyKey: crypto.randomUUID() })
      await refreshAll(api, session)
      setAlert(`${user.displayName}'s Study ban was revoked.`, 'success')
    } catch (error) {
      setAlert(safeError(error), 'error')
      submit.disabled = false
    }
  })
  host.append(summary, form)
}

function renderReports(api: AdminTransport, session: AdminSession) {
  const host = document.querySelector<HTMLElement>('#report-list')!
  host.replaceChildren()
  if (!reports.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'No open Study reports.'; host.append(empty); return }
  for (const report of reports) {
    const item = document.createElement('article')
    item.className = 'report-item'
    item.dataset.reportId = report.id
    const header = document.createElement('header')
    const title = document.createElement('h3')
    title.textContent = `${report.targetDisplayName} · ${formatModerationReason(report.reason)}`
    const time = document.createElement('time')
    time.dateTime = report.createdAt
    time.textContent = formatTimestamp(report.createdAt)
    header.append(title, time)
    const summary = document.createElement('p')
    summary.textContent = report.summary
    const context = document.createElement('small')
    context.textContent = `${report.roomId} · reported by ${report.reporterDisplayName}`
    const actions = document.createElement('div')
    actions.className = 'report-actions'
    const label = document.createElement('label')
    label.textContent = 'Review note'
    const input = document.createElement('input')
    input.className = 'report-note'
    input.maxLength = 500
    input.placeholder = 'Required for audit trail'
    label.append(input)
    const resolve = actionButton('Resolve', 'primary-action')
    const dismiss = actionButton('Dismiss', 'secondary-action')
    resolve.disabled = dismiss.disabled = !hasPermission(session, 'study.moderation.reports')
    const review = async (status: 'resolved' | 'dismissed', button: HTMLButtonElement) => {
      const note = input.value.replace(/\s+/g, ' ').trim()
      if (note.length < 3) { setAlert('A review note is required.', 'error'); return }
      try {
        button.disabled = true
        await api.reviewReport({ reportId: report.id, status, note, idempotencyKey: crypto.randomUUID() })
        await refreshAll(api, session)
        setAlert(`Report ${status}.`, 'success')
      } catch (error) { setAlert(safeError(error), 'error'); button.disabled = false }
    }
    resolve.addEventListener('click', () => void review('resolved', resolve))
    dismiss.addEventListener('click', () => void review('dismissed', dismiss))
    actions.append(label, resolve, dismiss)
    item.append(header, summary, context, actions)
    host.append(item)
  }
}

function renderAudit() {
  const host = document.querySelector<HTMLElement>('#audit-list')!
  host.replaceChildren()
  if (!auditEvents.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'No moderation actions in this view.'; host.append(empty); return }
  for (const event of auditEvents) {
    const item = document.createElement('article')
    item.className = 'audit-item'
    item.dataset.action = event.action
    const header = document.createElement('header')
    const title = document.createElement('h3')
    title.textContent = `${event.action.replaceAll('-', ' ')} · ${event.targetDisplayName}`
    const time = document.createElement('time')
    time.dateTime = event.createdAt
    time.textContent = formatTimestamp(event.createdAt)
    header.append(title, time)
    const note = document.createElement('p')
    note.textContent = event.note
    const meta = document.createElement('small')
    meta.textContent = `${event.actorDisplayName} · ${formatModerationReason(event.reason)} · request ${event.requestId}`
    item.append(header, note, meta)
    host.append(item)
  }
}

function bindNavigation() {
  document.querySelectorAll<HTMLButtonElement>('[data-admin-tab]').forEach((button) => button.addEventListener('click', () => {
    const tab = button.dataset.adminTab!
    document.querySelectorAll<HTMLButtonElement>('[data-admin-tab]').forEach((candidate) => { candidate.setAttribute('aria-selected', String(candidate === button)) })
    document.querySelectorAll<HTMLElement>('.admin-view').forEach((view) => { view.hidden = view.id !== `view-${tab}` })
  }))
}

function bindUserSearch(api: AdminTransport, session: AdminSession) {
  document.querySelector<HTMLFormElement>('#user-search')!.addEventListener('submit', (event) => {
    event.preventDefault()
    selectedUserId = null
    const query = value<HTMLInputElement>('#user-query')
    const status = value<HTMLSelectElement>('#user-status') as 'all' | 'active' | 'banned'
    void refreshAll(api, session, query, status)
  })
}

function renderLocked(title: string, message: string) {
  root!.innerHTML = `<section class="admin-lock"><article class="admin-lock-card"><span><i data-lucide="lock-keyhole" aria-hidden="true"></i></span><h1></h1><p></p><a href="/login/?return_to=/study/admin.html">Sign in securely</a></article></section>`
  document.querySelector('.admin-lock-card h1')!.textContent = title
  document.querySelector('.admin-lock-card p')!.textContent = message
  refreshIcons()
}

function resolveTransport(): AdminTransport | null {
  const bridge = window.RadioTEDUStudyAdminBridge
  if (bridge && typeof bridge.apiBase === 'string' && typeof bridge.request === 'function') {
    return new RemoteAdminTransport(bridge, window.location.origin)
  }
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'admin') return new LocalAdminTransport()
  return null
}

function metaCell(label: string, value: string) {
  const cell = document.createElement('span')
  const small = document.createElement('small')
  small.textContent = label
  const bold = document.createElement('b')
  bold.textContent = value
  cell.append(small, bold)
  return cell
}

function selectField(labelText: string, id: string, options: readonly { value: string; label: string }[]) {
  const label = document.createElement('label')
  const span = document.createElement('span')
  span.textContent = labelText
  const select = document.createElement('select')
  select.id = id
  for (const option of options) { const node = document.createElement('option'); node.value = option.value; node.textContent = option.label; select.append(node) }
  label.append(span, select)
  return label
}

function textareaField(labelText: string, id: string, placeholder: string) {
  const label = document.createElement('label')
  const span = document.createElement('span')
  span.textContent = labelText
  const textarea = document.createElement('textarea')
  textarea.id = id
  textarea.maxLength = 500
  textarea.placeholder = placeholder
  label.append(span, textarea)
  return label
}

function inputField(labelText: string, id: string, autocomplete: string) {
  const label = document.createElement('label')
  const span = document.createElement('span')
  span.textContent = labelText
  const input = document.createElement('input')
  input.id = id
  input.autocomplete = 'off'
  input.placeholder = autocomplete
  label.append(span, input)
  return label
}

function actionButton(label: string, className: string) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = label
  return button
}

function value<T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector: string, parent: ParentNode = document): string {
  return parent.querySelector<T>(selector)?.value ?? ''
}

function setAlert(message: string, kind: 'info' | 'error' | 'success') {
  const alert = document.querySelector<HTMLOutputElement>('#admin-alert')
  if (!alert) return
  alert.textContent = message
  alert.dataset.visible = String(Boolean(message))
  alert.dataset.kind = kind
}

function text(selector: string, content: string | number) {
  const element = document.querySelector(selector)
  if (element) element.textContent = String(content)
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'The moderation request could not be completed.'
  return message.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').slice(0, 240)
}

function refreshIcons() {
  createIcons({ icons: { Ban, Flag, History, LockKeyhole, Radio, Search, ShieldCheck, UserRoundCheck, UsersRound } })
}

declare global {
  interface Window {
    RadioTEDUStudyAdminBridge?: {
      apiBase: string
      request: typeof fetch
    } | null
  }
}
