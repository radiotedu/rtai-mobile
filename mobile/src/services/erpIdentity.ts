import {Linking} from 'react-native';
import axios from 'axios';

import {BASE_API} from './config';

export const TEDU_LOGIN_RETURN_URI = 'radiotedu://auth/erp/linked';
export const ERP_IDENTITY_TIMEOUT_MS = 15000;

export type ErpIdentityErrorCode =
  | 'erp.callbackFailed'
  | 'erp.invalidResponse'
  | 'erp.unsafeUrl'
  | 'erp.invalidSession'
  | 'erp.startFailed';

export class ErpIdentityError extends Error {
  readonly code: ErpIdentityErrorCode;

  constructor(code: ErpIdentityErrorCode) {
    super(code);
    this.name = 'ErpIdentityError';
    this.code = code;
  }
}

export type TeduLoginSession = {
  user: Record<string, unknown>;
  access_token: string;
  refresh_token: string;
  first_login_reward?: unknown;
};

export type TeduLoginCallback =
  | {matched: false}
  | {matched: true; code: string; error: null}
  | {matched: true; code: null; error: ErpIdentityErrorCode};

type ParsedUrl = {
  protocol: string;
  hostname: string;
  pathname: string;
  searchParams: Record<string, string>;
};

export function isGuestTeduSession(session: TeduLoginSession): boolean {
  const user = session.user as Record<string, unknown>;
  const accountType = String(user.account_type ?? user.type ?? '').toLowerCase();
  const role = String(user.role ?? '').toLowerCase();
  return user.is_guest === true || accountType === 'guest' || role === 'guest';
}

/**
 * Hermes on some Android builds exposes URL but throws when URL.protocol is
 * accessed. Keep auth redirect validation dependency-free and deterministic.
 */
function parseUrl(value: string): ParsedUrl | null {
  const match = value.trim().match(
    /^([a-z][a-z\d+.-]*):\/\/([^/?#]+)(\/[^?#]*)?(?:\?([^#]*))?/i,
  );
  if (!match) {
    return null;
  }

  const authority = match[2].split('@').pop() ?? '';
  const hostname = authority.split(':')[0].toLowerCase();
  const searchParams: Record<string, string> = {};
  for (const pair of (match[4] ?? '').split('&')) {
    if (!pair) {
      continue;
    }
    const [rawKey, rawValue = ''] = pair.split('=');
    try {
      searchParams[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      // Ignore malformed optional query parameters; required values are checked below.
    }
  }

  return {
    protocol: `${match[1].toLowerCase()}:`,
    hostname,
    pathname: match[3] ?? '/',
    searchParams,
  };
}

function responseData<T>(response: {data?: {data?: T}}): T {
  if (!response.data?.data) {
    throw new ErpIdentityError('erp.invalidResponse');
  }
  return response.data.data;
}

export function parseTeduLoginCallback(url: string): TeduLoginCallback {
  try {
    const callback = parseUrl(url);
    if (!callback) {
      return {matched: false};
    }
    const normalizedPath = callback.pathname.replace(/\/$/, '');
    if (
      callback.protocol !== 'radiotedu:' ||
      callback.hostname !== 'auth' ||
      normalizedPath !== '/erp/linked'
    ) {
      return {matched: false};
    }

    const status = callback.searchParams.erp_status;
    const code = callback.searchParams.erp_code?.trim() ?? '';
    if (status === 'success' && code) {
      return {matched: true, code, error: null};
    }

    return {
      matched: true,
      code: null,
      error: 'erp.callbackFailed',
    };
  } catch {
    return {matched: false};
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }
  const error = new Error('ERP identity request aborted');
  error.name = 'AbortError';
  throw error;
}

export async function startTeduLogin(signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  const response = await axios.post(
    `${BASE_API}/auth/erp-link/login/start`,
    {return_uri: TEDU_LOGIN_RETURN_URI},
    {timeout: ERP_IDENTITY_TIMEOUT_MS, signal},
  );
  throwIfAborted(signal);
  const data = responseData<{authorization_url?: string}>(response);
  const authorizationUrl = data.authorization_url?.trim() ?? '';
  const parsedAuthorizationUrl = parseUrl(authorizationUrl);
  if (
    !parsedAuthorizationUrl ||
    parsedAuthorizationUrl.protocol !== 'https:' ||
    parsedAuthorizationUrl.hostname !== 'radiotedu.com' ||
    parsedAuthorizationUrl.pathname !== '/erp/oauth/authorize'
  ) {
    throw new ErpIdentityError('erp.unsafeUrl');
  }
  throwIfAborted(signal);
  await Linking.openURL(authorizationUrl);
}

export async function exchangeTeduLoginCode(
  code: string,
  signal?: AbortSignal,
): Promise<TeduLoginSession> {
  throwIfAborted(signal);
  const response = await axios.post(
    `${BASE_API}/auth/erp-link/login/exchange`,
    {code},
    {timeout: ERP_IDENTITY_TIMEOUT_MS, signal},
  );
  throwIfAborted(signal);
  const session = responseData<TeduLoginSession>(response);
  if (
    !session.access_token ||
    !session.refresh_token ||
    !session.user ||
    isGuestTeduSession(session)
  ) {
    throw new ErpIdentityError('erp.invalidSession');
  }
  return session;
}
