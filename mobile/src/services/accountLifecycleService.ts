import axios from 'axios';

import {BASE_API} from './config';
import {clearAuthTokens, getRefreshToken} from './authTokenStorage';

export function buildLogoutPayload(refreshToken: string) {
  return {
    refresh_token: refreshToken.trim(),
  };
}

export function buildDeleteAccountPayload(password?: string) {
  return password === undefined
    ? {confirmation: 'DELETE'}
    : {confirmation: 'DELETE', password};
}

async function clearStoredAuthSession(): Promise<void> {
  await clearAuthTokens();
  delete axios.defaults.headers.common.Authorization;
}

export async function logoutAccountSession(): Promise<void> {
  const refreshToken = await getRefreshToken();

  try {
    if (refreshToken) {
      await axios.post(
        `${BASE_API}/auth/logout`,
        buildLogoutPayload(refreshToken),
      );
    }
  } finally {
    await clearStoredAuthSession();
  }
}

export async function deleteAccountAndClearSession(
  password?: string,
): Promise<void> {
  await axios.delete(`${BASE_API}/auth/account`, {
    data: buildDeleteAccountPayload(password),
  });
  await clearStoredAuthSession();
}
