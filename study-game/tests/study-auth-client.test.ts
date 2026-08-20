import { describe, expect, it, vi } from 'vitest'
import { loginStudyAccount, registerStudyAccount, startStudyTeduLogin, STUDY_PRIVACY_VERSION, STUDY_TERMS_VERSION } from '../src/account/StudyAuthClient'

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('Study-native account client', () => {
  it('logs in through the first-party web session endpoint with same-origin cookies', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ success: true, data: { user: { id: 'user-1' }, csrf_token: 'csrf' } }))
    const session = await loginStudyAccount(' USER@Example.com ', 'correct-horse', fetchImpl)

    expect(session.user.id).toBe('user-1')
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [path, init] = fetchImpl.mock.calls[0]!
    expect(path).toBe('/jukebox/api/v1/auth/web/login')
    expect(init?.credentials).toBe('same-origin')
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'user@example.com', password: 'correct-horse' })
  })

  it('keeps the 18+ rule and legal versions in non-TEDU registration requests', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ success: true, data: { user: { id: 'user-2' }, csrf_token: 'csrf' } }))
    await registerStudyAccount({ displayName: ' Arda ', email: 'arda@example.com', password: 'password-123', age: 18, legalAccepted: true }, fetchImpl)

    const body = JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body))
    expect(body).toMatchObject({
      display_name: 'Arda',
      email: 'arda@example.com',
      age: 18,
      terms_accepted: true,
      privacy_acknowledged: true,
      terms_version: STUDY_TERMS_VERSION,
      privacy_version: STUDY_PRIVACY_VERSION,
    })
  })

  it('blocks underage non-TEDU registration before making a request', async () => {
    const fetchImpl = vi.fn<FetchLike>()
    await expect(registerStudyAccount({ displayName: 'Minor', email: 'minor@example.com', password: 'password-123', age: 17, legalAccepted: true }, fetchImpl))
      .rejects.toThrow('at least 18')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not request age for a TEDU institutional address', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ success: true, data: { user: { id: 'user-3' }, csrf_token: 'csrf' } }))
    await registerStudyAccount({ displayName: 'Student', email: 'student@tedu.edu.tr', password: 'password-123', legalAccepted: true }, fetchImpl)
    expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body))).not.toHaveProperty('age')
  })

  it('starts TEDÜ login only through the server-owned OAuth start endpoint', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ success: true, data: { authorization_url: 'https://radiotedu.com/erp/login' } }))
    const result = await startStudyTeduLogin('https://radiotedu.com/study/auth-callback.html', fetchImpl)
    expect(result.authorization_url).toBe('https://radiotedu.com/erp/login')
    expect(fetchImpl.mock.calls[0]![0]).toBe('/jukebox/api/v1/auth/erp-link/login/start')
  })

  it('surfaces server errors without treating them as a session', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ success: false, error: 'Invalid credentials' }, 401))
    await expect(loginStudyAccount('user@example.com', 'wrong-pass', fetchImpl)).rejects.toThrow('Invalid credentials')
  })
})
