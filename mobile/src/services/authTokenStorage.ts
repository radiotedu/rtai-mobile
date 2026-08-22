import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.radiotedumobile.auth';
const LEGACY_KEYS = ['access_token', 'refresh_token'];

type AuthTokens = {accessToken: string; refreshToken: string};
let cached: AuthTokens | null | undefined;
let loading: Promise<AuthTokens | null> | null = null;

async function loadTokens(): Promise<AuthTokens | null> {
  if (cached !== undefined) return cached;
  if (loading) return loading;
  loading = (async () => {
    const credentials = await Keychain.getGenericPassword({service: SERVICE});
    if (credentials) {
      try {
        cached = JSON.parse(credentials.password) as AuthTokens;
        return cached;
      } catch {
        await Keychain.resetGenericPassword({service: SERVICE});
      }
    }

    // One-time migration from releases that stored tokens in AsyncStorage.
    const values = await AsyncStorage.multiGet(LEGACY_KEYS);
    const legacy = Object.fromEntries(values);
    await AsyncStorage.multiRemove(LEGACY_KEYS);
    if (legacy.access_token && legacy.refresh_token) {
      await setAuthTokens(legacy.access_token, legacy.refresh_token);
      return cached ?? null;
    }
    cached = null;
    return null;
  })().finally(() => {
    loading = null;
  });
  return loading;
}

export async function setAuthTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const tokens = {accessToken, refreshToken};
  const stored = await Keychain.setGenericPassword(
    'radiotedu-session',
    JSON.stringify(tokens),
    {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
  if (!stored) throw new Error('Secure token storage unavailable');
  cached = tokens;
  await AsyncStorage.multiRemove(LEGACY_KEYS);
}

export async function updateAccessToken(
  accessToken: string,
  refreshToken?: string,
): Promise<void> {
  const current = await loadTokens();
  if (!current && !refreshToken) throw new Error('No refresh token');
  await setAuthTokens(accessToken, refreshToken ?? current!.refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return (await loadTokens())?.accessToken ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  return (await loadTokens())?.refreshToken ?? null;
}

export async function clearAuthTokens(): Promise<void> {
  cached = null;
  await Promise.all([
    Keychain.resetGenericPassword({service: SERVICE}),
    AsyncStorage.multiRemove(LEGACY_KEYS),
  ]);
}
