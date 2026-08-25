import { describe, expect, it } from 'vitest'
import { resolveStudyEntry } from '../src/account/StudyEntry'

const location = {
  origin: 'https://radiotedu.com',
  pathname: '/social/',
  search: '?room=library',
  hash: '',
}

describe('Social account entry', () => {
  it('builds same-origin account routes with a return target', () => {
    const entry = resolveStudyEntry(undefined, location)
    expect(entry.loginUrl).toBe('/?hesap=giris&account_popup=1&return_to=%2Fsocial%2F%3Froom%3Dlibrary')
    expect(entry.registerUrl).toBe('/?hesap=kayit&account_popup=1&return_to=%2Fsocial%2F%3Froom%3Dlibrary')
    expect(entry.accountUrl).toBe('/account/')
    expect(entry.logoutUrl).toBe('/logout/?return_to=%2F')
  })

  it('accepts server-configured same-origin paths', () => {
    const entry = resolveStudyEntry({
      loginUrl: '/account/sign-in',
      registerUrl: '/account/join?campaign=study',
      accountUrl: '/my/profile',
      logoutUrl: '/account/sign-out?nonce=public-action-token',
    }, location)

    expect(entry.loginUrl).toContain('/account/sign-in?return_to=')
    expect(entry.registerUrl).toContain('/account/join?campaign=study&return_to=')
    expect(entry.accountUrl).toBe('/my/profile')
    expect(entry.logoutUrl).toBe('/account/sign-out?nonce=public-action-token&return_to=%2F')
  })

  it('rejects cross-origin and credential-bearing entry links', () => {
    const entry = resolveStudyEntry({
      loginUrl: 'https://example.com/phish',
      registerUrl: 'https://user:pass@radiotedu.com/register',
      accountUrl: '//evil.example/account',
      helpUrl: 'javascript:alert(1)',
    }, location)

    expect(entry.loginUrl).toMatch(/^\/\?hesap=giris&account_popup=1/)
    expect(entry.registerUrl).toMatch(/^\/\?hesap=kayit&account_popup=1/)
    expect(entry.accountUrl).toBe('/account/')
    expect(entry.helpUrl).toBe('/help/')
  })

  it('stays safe when the packaged fallback runs from a file URL', () => {
    const entry = resolveStudyEntry(undefined, {
      origin: 'null',
      pathname: '/android_asset/study-game/index.html',
      search: '?embedded=mobile',
      hash: '',
    })

    expect(entry.loginUrl).toMatch(/^\/\?hesap=giris&account_popup=1/)
    expect(entry.accountUrl).toBe('/account/')
  })
})
