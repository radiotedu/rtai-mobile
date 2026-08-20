export const STUDY_TERMS_VERSION = '2026-08-11'
export const STUDY_PRIVACY_VERSION = '2026-08-11'

const API_BASE = '/jukebox/api/v1/'

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

type ApiEnvelope<T> = {
  success?: boolean
  data?: T
  error?: string | { message?: string }
  message?: string
}

export type StudyWebAccount = Readonly<{
  id: string
  email?: string
  display_name?: string
  gold_balance?: number
}>

export type StudyWebSession = Readonly<{
  user: StudyWebAccount
  csrf_token: string
}>

export type StudyRegistrationInput = Readonly<{
  displayName: string
  email: string
  password: string
  age?: number
  legalAccepted: boolean
}>

function errorMessage(payload: ApiEnvelope<unknown> | null, status: number): string {
  if (typeof payload?.error === 'string') return payload.error
  if (payload?.error && typeof payload.error.message === 'string') return payload.error.message
  if (typeof payload?.message === 'string') return payload.message
  return `RadioTEDU account request failed (HTTP ${status})`
}

async function accountRequest<T>(
  path: string,
  options: RequestInit = {},
  fetchImpl: FetchLike = fetch,
): Promise<T> {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  const response = await fetchImpl(`${API_BASE}${path.replace(/^\//, '')}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  })
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null
  if (!response.ok || payload?.success === false) throw new Error(errorMessage(payload, response.status))
  return (payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload) as T
}

export function isTeduEmailAddress(value: string): boolean {
  const domain = value.trim().toLowerCase().split('@').pop() || ''
  return domain === 'tedu.edu.tr' || domain.endsWith('.tedu.edu.tr')
}

export async function loginStudyAccount(
  email: string,
  password: string,
  fetchImpl?: FetchLike,
): Promise<StudyWebSession> {
  return accountRequest<StudyWebSession>('auth/web/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  }, fetchImpl)
}

export async function registerStudyAccount(
  input: StudyRegistrationInput,
  fetchImpl?: FetchLike,
): Promise<StudyWebSession> {
  const email = input.email.trim().toLowerCase()
  if (!input.legalAccepted) throw new Error('Accept the Terms of Use and Privacy Notice to continue.')
  if (!isTeduEmailAddress(email) && (!Number.isInteger(input.age) || Number(input.age) < 18)) {
    throw new Error('You must be at least 18 to register with a non-TEDU email address.')
  }
  return accountRequest<StudyWebSession>('auth/web/register', {
    method: 'POST',
    body: JSON.stringify({
      display_name: input.displayName.trim(),
      email,
      password: input.password,
      ...(isTeduEmailAddress(email) ? {} : { age: Number(input.age) }),
      terms_accepted: true,
      privacy_acknowledged: true,
      terms_version: STUDY_TERMS_VERSION,
      privacy_version: STUDY_PRIVACY_VERSION,
    }),
  }, fetchImpl)
}

export async function verifyStudyAccountSession(fetchImpl?: FetchLike): Promise<StudyWebSession> {
  return accountRequest<StudyWebSession>('auth/web/session', {}, fetchImpl)
}

export async function startStudyTeduLogin(
  returnUri: string,
  fetchImpl?: FetchLike,
): Promise<{ authorization_url?: string; authorize_url?: string }> {
  return accountRequest('auth/erp-link/login/start', {
    method: 'POST',
    body: JSON.stringify({ return_uri: returnUri }),
  }, fetchImpl)
}

export async function exchangeStudyTeduCode(code: string, fetchImpl?: FetchLike): Promise<StudyWebSession> {
  return accountRequest<StudyWebSession>('auth/web/erp-exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
  }, fetchImpl)
}
