export type StudyEntryConfig = Readonly<{
  loginUrl?: string
  registerUrl?: string
  accountUrl?: string
  logoutUrl?: string
  helpUrl?: string
}>

export type ResolvedStudyEntry = Readonly<{
  loginUrl: string
  registerUrl: string
  accountUrl: string
  logoutUrl: string
  helpUrl: string
}>

type EntryLocation = Pick<Location, 'origin' | 'pathname' | 'search' | 'hash'>

function sameOriginPath(
  candidate: string | undefined,
  fallbackPath: string,
  location: EntryLocation,
): URL {
  const safeBase = /^https?:\/\//i.test(location.origin) ? location.origin : 'https://study.radiotedu.invalid'
  let resolved: URL
  try {
    resolved = new URL(candidate || fallbackPath, safeBase)
  } catch {
    resolved = new URL(fallbackPath, safeBase)
  }

  if (resolved.origin !== safeBase || resolved.username || resolved.password) {
    return new URL(fallbackPath, safeBase)
  }
  return resolved
}

function asPath(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`
}

function withReturnTo(url: URL, returnTo: string): URL {
  if (!url.searchParams.has('return_to')) url.searchParams.set('return_to', returnTo)
  return url
}

export function resolveStudyEntry(
  config: StudyEntryConfig | null | undefined,
  location: EntryLocation,
): ResolvedStudyEntry {
  const returnTo = `${location.pathname}${location.search}${location.hash}` || '/study/'
  const login = withReturnTo(sameOriginPath(config?.loginUrl, '/?hesap=giris&account_popup=1', location), returnTo)
  const register = withReturnTo(sameOriginPath(config?.registerUrl, '/?hesap=kayit&account_popup=1', location), returnTo)
  const logout = withReturnTo(sameOriginPath(config?.logoutUrl, '/logout/', location), '/')

  return Object.freeze({
    loginUrl: asPath(login),
    registerUrl: asPath(register),
    accountUrl: asPath(sameOriginPath(config?.accountUrl, '/account/', location)),
    logoutUrl: asPath(logout),
    helpUrl: asPath(sameOriginPath(config?.helpUrl, '/help/', location)),
  })
}
