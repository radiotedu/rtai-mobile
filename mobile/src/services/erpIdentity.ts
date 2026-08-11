import {Linking} from 'react-native';
import axios from 'axios';

import {BASE_API} from './config';

export const TEDU_LOGIN_RETURN_URI = 'radiotedu://auth/erp/linked';

export type TeduLoginSession = {
  user: Record<string, unknown>;
  access_token: string;
  refresh_token: string;
  first_login_reward?: unknown;
};

export type TeduLoginCallback =
  | {matched: false}
  | {matched: true; code: string; error: null}
  | {matched: true; code: null; error: string};

function responseData<T>(response: {data?: {data?: T}}): T {
  if (!response.data?.data) {
    throw new Error('RadioTEDU giriş yanıtı doğrulanamadı.');
  }
  return response.data.data;
}

export function parseTeduLoginCallback(url: string): TeduLoginCallback {
  try {
    const callback = new URL(url);
    const normalizedPath = callback.pathname.replace(/\/$/, '');
    if (
      callback.protocol !== 'radiotedu:' ||
      callback.hostname !== 'auth' ||
      normalizedPath !== '/erp/linked'
    ) {
      return {matched: false};
    }

    const status = callback.searchParams.get('erp_status');
    const code = callback.searchParams.get('erp_code')?.trim() ?? '';
    if (status === 'success' && code) {
      return {matched: true, code, error: null};
    }

    return {
      matched: true,
      code: null,
      error: 'TEDÜ girişi tamamlanamadı. Lütfen tekrar deneyin.',
    };
  } catch {
    return {matched: false};
  }
}

export async function startTeduLogin(): Promise<void> {
  const response = await axios.post(`${BASE_API}/auth/erp-link/login/start`, {
    return_uri: TEDU_LOGIN_RETURN_URI,
  });
  const data = responseData<{authorization_url?: string}>(response);
  const authorizationUrl = new URL(data.authorization_url ?? '');
  if (
    authorizationUrl.protocol !== 'https:' ||
    authorizationUrl.hostname !== 'radiotedu.com' ||
    authorizationUrl.pathname !== '/erp/oauth/authorize'
  ) {
    throw new Error('TEDÜ giriş adresi güvenli değil.');
  }
  await Linking.openURL(authorizationUrl.toString());
}

export async function exchangeTeduLoginCode(code: string): Promise<TeduLoginSession> {
  const response = await axios.post(`${BASE_API}/auth/erp-link/login/exchange`, {code});
  const session = responseData<TeduLoginSession>(response);
  if (!session.access_token || !session.refresh_token || !session.user) {
    throw new Error('TEDÜ oturumu doğrulanamadı.');
  }
  return session;
}
