import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.radiotedumobile.auth';
const LEGACY_KEYS = ['access_token', 'refresh_token'];

type AuthTokens = {accessToken: string; refreshToken: string};
export type AuthTokenSnapshot = AuthTokens & {generation: number};

let cached: AuthTokens | null | undefined;
let loading: Promise<AuthTokens | null> | null = null;
let generation = 0;
let mutationQueue: Promise<void> = Promise.resolve();

function isToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 16_384;
}

function parseTokens(value: string): AuthTokens | null {
  try {
    const parsed = JSON.parse(value) as Partial<AuthTokens>;
    if (isToken(parsed.accessToken) && isToken(parsed.refreshToken)) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
      };
    }
  } catch {
    return null;
  }
  return null;
}

function queueMutation(operation: () => Promise<void>): Promise<void> {
  const next = mutationQueue.then(operation, operation);
  mutationQueue = next.catch(() => undefined);
  return next;
}

async function loadTokens(): Promise<AuthTokens | null> {
  if (cached !== undefined) {
    return cached;
  }
  if (loading) {
    return loading;
  }
  const loadGeneration = generation;
  const request = (async () => {
    const credentials = await Keychain.getGenericPassword({service: SERVICE});
    if (credentials) {
      const storedTokens = parseTokens(credentials.password);
      if (storedTokens) {
        if (generation !== loadGeneration) {
          return cached ?? null;
        }
        cached = storedTokens;
        return storedTokens;
      }
      await Keychain.resetGenericPassword({service: SERVICE});
    }

    // One-time migration from releases that stored tokens in AsyncStorage.
    const values = await AsyncStorage.multiGet(LEGACY_KEYS);
    const legacy = Object.fromEntries(values);
    await AsyncStorage.multiRemove(LEGACY_KEYS);
    if (isToken(legacy.access_token) && isToken(legacy.refresh_token)) {
      if (generation !== loadGeneration) {
        return cached ?? null;
      }
      await setAuthTokens(legacy.access_token, legacy.refresh_token);
      return cached ?? null;
    }
    if (generation !== loadGeneration) {
      return cached ?? null;
    }
    cached = null;
    return null;
  })();
  loading = request;
  try {
    return await request;
  } finally {
    if (loading === request) {
      loading = null;
    }
  }
}

export async function setAuthTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  if (!isToken(accessToken) || !isToken(refreshToken)) {
    throw new Error('Invalid authentication tokens');
  }
  const tokens = {accessToken, refreshToken};
  const writeGeneration = ++generation;
  cached = undefined;
  loading = null;
  await queueMutation(async () => {
    const stored = await Keychain.setGenericPassword(
      'radiotedu-session',
      JSON.stringify(tokens),
      {
        service: SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      },
    );
    if (!stored) {
      throw new Error('Secure token storage unavailable');
    }
    if (generation === writeGeneration) {
      cached = tokens;
    }
    await AsyncStorage.multiRemove(LEGACY_KEYS);
  });
}

export async function updateAccessToken(
  accessToken: string,
  refreshToken?: string,
  expected?: AuthTokenSnapshot,
): Promise<boolean> {
  await mutationQueue;
  const current = await loadTokens();
  if (!current && !refreshToken) {
    throw new Error('No refresh token');
  }
  if (
    expected &&
    (generation !== expected.generation ||
      current?.refreshToken !== expected.refreshToken)
  ) {
    return false;
  }
  await setAuthTokens(accessToken, refreshToken ?? current!.refreshToken);
  return true;
}

export async function getAccessToken(): Promise<string | null> {
  await mutationQueue;
  return (await loadTokens())?.accessToken ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  await mutationQueue;
  return (await loadTokens())?.refreshToken ?? null;
}

export async function getAuthTokenSnapshot(): Promise<AuthTokenSnapshot | null> {
  await mutationQueue;
  const tokens = await loadTokens();
  return tokens ? {...tokens, generation} : null;
}

export async function clearAuthTokens(): Promise<void> {
  const clearGeneration = ++generation;
  cached = null;
  loading = null;
  await queueMutation(async () => {
    await Promise.all([
      Keychain.resetGenericPassword({service: SERVICE}),
      AsyncStorage.multiRemove(LEGACY_KEYS),
    ]);
    if (generation === clearGeneration) {
      cached = null;
    }
  });
}

export async function clearAuthTokensIfCurrent(
  expected: AuthTokenSnapshot,
): Promise<boolean> {
  await mutationQueue;
  const current = await loadTokens();
  if (
    generation !== expected.generation ||
    current?.refreshToken !== expected.refreshToken
  ) {
    return false;
  }
  await clearAuthTokens();
  return true;
}
