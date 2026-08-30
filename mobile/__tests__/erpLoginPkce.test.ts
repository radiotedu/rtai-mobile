import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import * as Keychain from 'react-native-keychain';

import {
  beginPendingErpLoginPkce,
  clearPendingErpLoginPkce,
  deriveS256CodeChallenge,
  ERP_LOGIN_PKCE_MAX_AGE_MS,
  getPendingErpLoginPkce,
} from '../src/services/erpLoginPkce';

jest.mock('react-native-get-random-values', () => ({}));

const setGenericPassword = Keychain.setGenericPassword as jest.MockedFunction<
  typeof Keychain.setGenericPassword
>;
const getGenericPassword = Keychain.getGenericPassword as jest.MockedFunction<
  typeof Keychain.getGenericPassword
>;
const resetGenericPassword = Keychain.resetGenericPassword as jest.MockedFunction<
  typeof Keychain.resetGenericPassword
>;
const TEST_STORAGE = 'KeystoreAESGCM' as Keychain.STORAGE_TYPE;

describe('ERP login outer PKCE storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setGenericPassword.mockResolvedValue({
      service: 'test',
      storage: TEST_STORAGE,
    });
    getGenericPassword.mockResolvedValue(false);
    resetGenericPassword.mockResolvedValue(true);
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (bytes: Uint8Array) => {
          for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = index;
          }
          return bytes;
        },
      },
    });
  });

  it('derives the RFC 7636 S256 challenge', () => {
    expect(deriveS256CodeChallenge(
      'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    )).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('stores only one verifier and creation time in device-only Keychain storage', async () => {
    const pending = await beginPendingErpLoginPkce(1_700_000_000_000);

    expect(pending.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pending.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(setGenericPassword).toHaveBeenCalledTimes(1);
    const [username, password, options] = setGenericPassword.mock.calls[0];
    expect(username).toBe('radiotedu-erp-login-pkce');
    expect(Object.keys(JSON.parse(password)).sort()).toEqual(['createdAt', 'verifier']);
    expect(options).toMatchObject({
      service: 'com.radiotedumobile.auth.erp-login-pkce',
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });

  it('loads a valid pending verifier without copying it to persistent browser storage', async () => {
    getGenericPassword.mockResolvedValueOnce({
      username: 'radiotedu-erp-login-pkce',
      password: JSON.stringify({verifier: 'v'.repeat(43), createdAt: 10_000}),
      service: 'test',
      storage: TEST_STORAGE,
    });

    await expect(getPendingErpLoginPkce(10_001)).resolves.toEqual({
      verifier: 'v'.repeat(43),
      createdAt: 10_000,
    });
    expect(resetGenericPassword).not.toHaveBeenCalled();
  });

  it.each([
    {label: 'expired', createdAt: 10_000, now: 10_000 + ERP_LOGIN_PKCE_MAX_AGE_MS + 1},
    {label: 'future-dated', createdAt: 20_000, now: 10_000},
  ])('rejects and clears $label pending state', async ({createdAt, now}) => {
    getGenericPassword.mockResolvedValueOnce({
      username: 'radiotedu-erp-login-pkce',
      password: JSON.stringify({verifier: 'v'.repeat(43), createdAt}),
      service: 'test',
      storage: TEST_STORAGE,
    });
    getGenericPassword.mockResolvedValueOnce({
      username: 'radiotedu-erp-login-pkce',
      password: JSON.stringify({verifier: 'v'.repeat(43), createdAt}),
      service: 'test',
      storage: TEST_STORAGE,
    });

    await expect(getPendingErpLoginPkce(now)).resolves.toBeNull();
    expect(resetGenericPassword).toHaveBeenCalledWith({
      service: 'com.radiotedumobile.auth.erp-login-pkce',
    });
  });

  it('clears malformed state and compare-clears only the expected verifier', async () => {
    getGenericPassword.mockResolvedValueOnce({
      username: 'radiotedu-erp-login-pkce',
      password: '{not-json',
      service: 'test',
      storage: TEST_STORAGE,
    });
    await expect(getPendingErpLoginPkce()).resolves.toBeNull();
    expect(resetGenericPassword).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    getGenericPassword.mockResolvedValueOnce({
      username: 'radiotedu-erp-login-pkce',
      password: JSON.stringify({verifier: 'a'.repeat(43), createdAt: 10_000}),
      service: 'test',
      storage: TEST_STORAGE,
    });
    await expect(clearPendingErpLoginPkce('b'.repeat(43))).resolves.toBe(false);
    expect(resetGenericPassword).not.toHaveBeenCalled();
  });
});
