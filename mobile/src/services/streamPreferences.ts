import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type {StreamQuality} from '../data/radioChannels';

export type StreamQualityPreference = 'automatic' | StreamQuality;

export type StreamPreferences = {
  quality: StreamQualityPreference;
};

export type StreamNetworkSnapshot = {
  type?: unknown;
  isConnected?: boolean | null;
  details?: {
    cellularGeneration?: unknown;
    isConnectionExpensive?: unknown;
  } | null;
};

export const STREAM_PREFERENCES_STORAGE_KEY =
  '@radiotedu/stream-preferences-v2';

export const DEFAULT_STREAM_PREFERENCES: StreamPreferences = {
  quality: 'normal',
};

const QUALITY_VALUES = new Set<StreamQualityPreference>([
  'automatic',
  'low',
  'normal',
  'high',
  'flac',
]);
const listeners = new Set<(preferences: StreamPreferences) => void>();
let cachedPreferences: StreamPreferences | null = null;
let loadingPromise: Promise<StreamPreferences> | null = null;

export function normalizeStreamPreferences(value: unknown): StreamPreferences {
  const candidate =
    value && typeof value === 'object'
      ? (value as {quality?: unknown})
      : {};
  const legacyQuality =
    candidate.quality === 'medium' ? 'normal' : candidate.quality;

  return {
    quality: QUALITY_VALUES.has(legacyQuality as StreamQualityPreference)
      ? (legacyQuality as StreamQualityPreference)
      : DEFAULT_STREAM_PREFERENCES.quality,
  };
}

export async function loadStreamPreferences(): Promise<StreamPreferences> {
  if (cachedPreferences) {
    return cachedPreferences;
  }
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = AsyncStorage.getItem(STREAM_PREFERENCES_STORAGE_KEY)
    .then(raw => normalizeStreamPreferences(raw ? JSON.parse(raw) : null))
    .catch(() => DEFAULT_STREAM_PREFERENCES)
    .then(preferences => {
      cachedPreferences = preferences;
      return preferences;
    })
    .finally(() => {
      loadingPromise = null;
    });

  return loadingPromise;
}

export async function saveStreamPreferences(
  preferences: StreamPreferences,
): Promise<StreamPreferences> {
  const normalized = normalizeStreamPreferences(preferences);
  await AsyncStorage.setItem(
    STREAM_PREFERENCES_STORAGE_KEY,
    JSON.stringify(normalized),
  );
  cachedPreferences = normalized;
  listeners.forEach(listener => listener(normalized));
  return normalized;
}

export function subscribeStreamPreferences(
  listener: (preferences: StreamPreferences) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function automaticQualityForNetwork(
  network: StreamNetworkSnapshot,
): StreamQuality {
  if (network.isConnected === false || network.type === 'none') {
    return 'low';
  }

  if (network.type === 'cellular') {
    const generation = String(
      network.details?.cellularGeneration ?? '',
    ).toLowerCase();
    if (generation === '2g' || generation === '3g') {
      return 'low';
    }
    if (generation === '5g') {
      return 'high';
    }
    return 'normal';
  }

  if (network.details?.isConnectionExpensive === true) {
    return 'normal';
  }

  if (
    network.type === 'wifi' ||
    network.type === 'ethernet' ||
    network.type === 'vpn'
  ) {
    return 'high';
  }

  return 'normal';
}

export function resolvePreferredQuality(
  preference: StreamQualityPreference,
  network: StreamNetworkSnapshot,
): StreamQuality {
  return preference === 'automatic'
    ? automaticQualityForNetwork(network)
    : preference;
}

export function isCellularNetwork(network: StreamNetworkSnapshot): boolean {
  return network.type === 'cellular';
}

export async function resolveCurrentStreamPreferences(
  override?: Partial<StreamPreferences>,
): Promise<{
  preferences: StreamPreferences;
  quality: StreamQuality;
  network: StreamNetworkSnapshot;
}> {
  const stored = await loadStreamPreferences();
  const preferences = normalizeStreamPreferences({...stored, ...override});
  const network = (await NetInfo.fetch()) as StreamNetworkSnapshot;
  return {
    preferences,
    quality: resolvePreferredQuality(preferences.quality, network),
    network,
  };
}

export function resetStreamPreferencesCacheForTests(): void {
  cachedPreferences = null;
  loadingPromise = null;
  listeners.clear();
}
