import 'react-native-get-random-values';

import {sha256} from '@noble/hashes/sha256';
import {utf8ToBytes} from '@noble/hashes/utils';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.radiotedumobile.auth.erp-login-pkce';
const USERNAME = 'radiotedu-erp-login-pkce';
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export const ERP_LOGIN_PKCE_MAX_AGE_MS = 10 * 60 * 1000;
export const ERP_LOGIN_PKCE_METHOD = 'S256' as const;

type PendingErpLoginPkce = {
  verifier: string;
  createdAt: number;
};

type CryptoLike = {
  getRandomValues: <T extends ArrayBufferView>(array: T) => T;
};

let mutationQueue: Promise<void> = Promise.resolve();

function queueMutation(operation: () => Promise<void>): Promise<void> {
  const next = mutationQueue.then(operation, operation);
  mutationQueue = next.catch(() => undefined);
  return next;
}

function isVerifier(value: unknown): value is string {
  return typeof value === 'string'
    && /^[A-Za-z0-9\-._~]{43,128}$/.test(value);
}

function parsePending(value: string): PendingErpLoginPkce | null {
  try {
    const parsed = JSON.parse(value) as Partial<PendingErpLoginPkce>;
    if (
      Object.keys(parsed).sort().join(',') === 'createdAt,verifier'
      && isVerifier(parsed.verifier)
      && Number.isSafeInteger(parsed.createdAt)
      && Number(parsed.createdAt) > 0
    ) {
      return {
        verifier: parsed.verifier,
        createdAt: Number(parsed.createdAt),
      };
    }
  } catch {
    return null;
  }
  return null;
}

/* eslint-disable no-bitwise -- Base64 packing is defined in six-bit groups. */
function base64UrlEncode(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;

    output += BASE64URL[first >>> 2];
    output += BASE64URL[((first & 0x03) << 4) | (second >>> 4)];
    if (index + 1 < bytes.length) {
      output += BASE64URL[((second & 0x0f) << 2) | (third >>> 6)];
    }
    if (index + 2 < bytes.length) {
      output += BASE64URL[third & 0x3f];
    }
  }
  return output;
}
/* eslint-enable no-bitwise */

function createVerifier(): string {
  const cryptoObject = (globalThis as unknown as {crypto?: CryptoLike}).crypto;
  if (!cryptoObject?.getRandomValues) {
    throw new Error('Secure random number generation is unavailable');
  }
  const bytes = new Uint8Array(32);
  cryptoObject.getRandomValues(bytes);
  const verifier = base64UrlEncode(bytes);
  if (!isVerifier(verifier)) {
    throw new Error('Secure PKCE verifier generation failed');
  }
  return verifier;
}

export function deriveS256CodeChallenge(verifier: string): string {
  if (!isVerifier(verifier)) {
    throw new Error('Invalid PKCE verifier');
  }
  return base64UrlEncode(sha256(utf8ToBytes(verifier)));
}

async function readStoredPending(): Promise<PendingErpLoginPkce | null> {
  const credentials = await Keychain.getGenericPassword({service: SERVICE});
  if (!credentials) {
    return null;
  }
  if (credentials.username !== USERNAME) {
    await Keychain.resetGenericPassword({service: SERVICE});
    return null;
  }
  const pending = parsePending(credentials.password);
  if (!pending) {
    await Keychain.resetGenericPassword({service: SERVICE});
    return null;
  }
  return pending;
}

export async function beginPendingErpLoginPkce(
  now = Date.now(),
): Promise<PendingErpLoginPkce & {codeChallenge: string; method: typeof ERP_LOGIN_PKCE_METHOD}> {
  if (!Number.isSafeInteger(now) || now <= 0) {
    throw new Error('Invalid PKCE creation time');
  }
  const verifier = createVerifier();
  const pending = {verifier, createdAt: now};
  await queueMutation(async () => {
    const stored = await Keychain.setGenericPassword(
      USERNAME,
      JSON.stringify(pending),
      {
        service: SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      },
    );
    if (!stored) {
      throw new Error('Secure PKCE storage is unavailable');
    }
  });
  return {
    ...pending,
    codeChallenge: deriveS256CodeChallenge(verifier),
    method: ERP_LOGIN_PKCE_METHOD,
  };
}

export async function getPendingErpLoginPkce(
  now = Date.now(),
): Promise<PendingErpLoginPkce | null> {
  await mutationQueue;
  const pending = await readStoredPending();
  if (!pending) {
    return null;
  }
  const age = now - pending.createdAt;
  if (age < 0 || age > ERP_LOGIN_PKCE_MAX_AGE_MS) {
    await clearPendingErpLoginPkce(pending.verifier);
    return null;
  }
  return pending;
}

export async function clearPendingErpLoginPkce(
  expectedVerifier?: string,
): Promise<boolean> {
  let cleared = false;
  await queueMutation(async () => {
    if (expectedVerifier) {
      const current = await readStoredPending();
      if (!current || current.verifier !== expectedVerifier) {
        return;
      }
    }
    await Keychain.resetGenericPassword({service: SERVICE});
    cleared = true;
  });
  return cleared;
}
