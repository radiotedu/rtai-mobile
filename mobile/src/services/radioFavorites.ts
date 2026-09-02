import AsyncStorage from '@react-native-async-storage/async-storage';

const RADIO_FAVORITES_KEY = 'radiotedu_radio_favorites_v1';

type ChannelLike = {
  id: string;
};

const VOTING_CHANNEL_ID = 'radiotedu-spark';

/** Voting is a special interactive station and always closes the mobile list. */
export function orderVotingChannelLast<T extends ChannelLike>(channels: T[]): T[] {
  return [
    ...channels.filter(channel => channel.id !== VOTING_CHANNEL_ID),
    ...channels.filter(channel => channel.id === VOTING_CHANNEL_ID),
  ];
}

export function toggleFavoriteChannelId(favoriteIds: string[], channelId: string): string[] {
  if (favoriteIds.includes(channelId)) {
    return favoriteIds.filter((id) => id !== channelId);
  }

  return [...favoriteIds, channelId];
}

export function buildFavoriteChannelOrder<T extends ChannelLike>(
  channels: T[],
  favoriteIds: string[],
) {
  const favoriteIdSet = new Set(favoriteIds);
  const favorites = channels.filter((channel) => favoriteIdSet.has(channel.id));
  const remaining = channels.filter((channel) => !favoriteIdSet.has(channel.id));

  return {favorites, remaining};
}

let cachedFavoriteIds: string[] | null = null;
const listeners = new Set<(ids: string[]) => void>();

export function subscribeFavoriteChannelIds(listener: (ids: string[]) => void): () => void {
  listeners.add(listener);
  if (cachedFavoriteIds !== null) {
    listener(cachedFavoriteIds);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function getCachedFavoriteChannelIds(): string[] {
  return cachedFavoriteIds ?? [];
}

export async function loadFavoriteChannelIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(RADIO_FAVORITES_KEY);
  if (!raw) {
    cachedFavoriteIds = [];
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    cachedFavoriteIds = ids;
    return ids;
  } catch {
    cachedFavoriteIds = [];
    return [];
  }
}

export async function saveFavoriteChannelIds(favoriteIds: string[]) {
  cachedFavoriteIds = favoriteIds;
  await AsyncStorage.setItem(RADIO_FAVORITES_KEY, JSON.stringify(favoriteIds));
  listeners.forEach(listener => {
    try {
      listener(favoriteIds);
    } catch {
      // best-effort
    }
  });
}
