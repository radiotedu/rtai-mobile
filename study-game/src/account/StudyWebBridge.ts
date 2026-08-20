import type { StudyAccount } from '../adapters/StudyAdapter'
import type { StudyWebSession } from './StudyAuthClient'

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type OriginLike = Pick<Location, 'origin'>

const STUDY_API_BASE = '/jukebox/api/v1/study'
const ALLOWED_API_PATH = /^\/jukebox\/api\/v1\/(?:study|economy)(?:\/|$)/
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export type StudyWebBridge = Readonly<{
  apiBase: string
  fetchImpl: typeof fetch
  account: StudyAccount
  globalPoints: number
}>

function accountDisplayName(session: StudyWebSession): string {
  const preferred = session.user.display_name?.trim()
  if (preferred) return preferred.slice(0, 80)
  const email = session.user.email?.trim()
  if (email) return email.slice(0, 80)
  return 'RadioTEDU Student'
}

export function createStudyWebBridge(
  session: StudyWebSession,
  location: OriginLike = window.location,
  fetchImpl: FetchLike = fetch,
): StudyWebBridge {
  const userId = session.user?.id?.trim()
  const csrfToken = session.csrf_token?.trim()
  if (!userId || !csrfToken) throw new Error('A verified RadioTEDU web session is required.')

  const origin = new URL(location.origin).origin
  const request: FetchLike = async (input, init = {}) => {
    const rawUrl = input instanceof Request ? input.url : input.toString()
    const target = new URL(rawUrl, origin)
    if (target.origin !== origin || target.hash || !ALLOWED_API_PATH.test(target.pathname)) {
      throw new Error('Study blocked a request outside its same-origin API scope.')
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init.headers).forEach((value, name) => headers.set(name, value))
    const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (!SAFE_METHODS.has(method)) headers.set('X-RadioTEDU-CSRF', csrfToken)

    return fetchImpl(`${target.pathname}${target.search}`, {
      ...init,
      method,
      headers,
      credentials: 'same-origin',
    })
  }

  const gold = session.user.gold_balance
  return Object.freeze({
    apiBase: STUDY_API_BASE,
    fetchImpl: request as typeof fetch,
    account: Object.freeze({
      id: userId,
      displayName: accountDisplayName(session),
      authenticated: true,
    }),
    globalPoints: Number.isSafeInteger(gold) && Number(gold) >= 0 ? Number(gold) : 0,
  })
}
