import {beforeEach, describe, expect, it} from '@jest/globals';

import {
  clearAuthTokens,
  clearAuthTokensIfCurrent,
  getAccessToken,
  getAuthTokenSnapshot,
  getRefreshToken,
  setAuthTokens,
  updateAccessToken,
} from '../src/services/authTokenStorage';

describe('secure auth token storage', () => {
  beforeEach(async () => {
    await clearAuthTokens();
  });

  it('updates a refresh result only when it belongs to the current session', async () => {
    await setAuthTokens('access-1', 'refresh-1');
    const snapshot = await getAuthTokenSnapshot();
    expect(snapshot).not.toBeNull();

    await setAuthTokens('access-new-login', 'refresh-new-login');
    const updated = await updateAccessToken(
      'stale-access',
      'stale-refresh',
      snapshot!,
    );

    expect(updated).toBe(false);
    expect(await getAccessToken()).toBe('access-new-login');
    expect(await getRefreshToken()).toBe('refresh-new-login');
  });

  it('does not let a stale refresh clear a newer session', async () => {
    await setAuthTokens('access-1', 'refresh-1');
    const snapshot = await getAuthTokenSnapshot();
    expect(snapshot).not.toBeNull();

    await setAuthTokens('access-2', 'refresh-2');

    expect(await clearAuthTokensIfCurrent(snapshot!)).toBe(false);
    expect(await getAccessToken()).toBe('access-2');
  });

  it('accepts a conditional refresh for the current session', async () => {
    await setAuthTokens('access-1', 'refresh-1');
    const snapshot = await getAuthTokenSnapshot();

    expect(
      await updateAccessToken('access-2', 'refresh-2', snapshot!),
    ).toBe(true);
    expect(await getAccessToken()).toBe('access-2');
    expect(await getRefreshToken()).toBe('refresh-2');
  });

  it('rejects empty or malformed token writes', async () => {
    await expect(setAuthTokens('', 'refresh')).rejects.toThrow(
      'Invalid authentication tokens',
    );
    expect(await getAuthTokenSnapshot()).toBeNull();
  });
});
