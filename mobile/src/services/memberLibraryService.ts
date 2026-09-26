import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import {
  loadFavoriteChannelIds,
  saveFavoriteChannelIds,
} from './radioFavorites';

export type MemberFavoriteKind = 'station' | 'podcast_show' | 'podcast_episode';

export type MemberFavorite = {
  kind: MemberFavoriteKind;
  content_id: string;
  title?: string | null;
  subtitle?: string | null;
  artwork_url?: string | null;
  created_at?: string;
};

export type MemberEpisodeProgress = {
  content_id: string;
  position_seconds: number;
  duration_seconds: number;
  completed: boolean;
  title?: string | null;
  subtitle?: string | null;
  artwork_url?: string | null;
  updated_at?: string;
};

export type MemberListeningHistoryItem = {
  id: number;
  kind: MemberFavoriteKind;
  content_id: string;
  title?: string | null;
  subtitle?: string | null;
  artwork_url?: string | null;
  event_type: 'play' | 'resume' | 'complete';
  position_seconds?: number | null;
  duration_seconds?: number | null;
  listened_at?: string;
};

export type MemberLibrary = {
  favorites: MemberFavorite[];
  progress: MemberEpisodeProgress[];
};

export type FavoriteInput = {
  kind: MemberFavoriteKind;
  contentId: string;
  title?: string;
  subtitle?: string;
  artworkUrl?: string;
};

export type EpisodeProgressInput = {
  episodeId: string;
  positionSeconds: number;
  durationSeconds: number;
  completed?: boolean;
  title?: string;
  subtitle?: string;
  artworkUrl?: string;
};

export type ListeningHistoryInput = {
  kind: MemberFavoriteKind;
  contentId: string;
  title?: string;
  subtitle?: string;
  artworkUrl?: string;
  eventType?: 'play' | 'resume' | 'complete';
  positionSeconds?: number | null;
  durationSeconds?: number | null;
};

type FavoriteMutation = {
  type: 'favorite';
  accountId: string;
  favorite: FavoriteInput;
  active: boolean;
};

type ProgressMutation = {
  type: 'progress';
  accountId: string;
  progress: EpisodeProgressInput;
};

type PendingMutation = FavoriteMutation | ProgressMutation;

type RadioChannelFavoriteSource = {
  id: string;
  name?: string;
  description?: string;
  artwork?: string;
};

const PENDING_MUTATIONS_KEY = 'radiotedu_member_library_pending_v1';
const RADIO_FAVORITE_OWNER_KEY = 'radiotedu_radio_favorites_owner_v1';
const MAX_PROGRESS_SECONDS = 60 * 60 * 24 * 30;

function accountKey(accountId: string): string {
  return String(accountId ?? '').trim();
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const text = value.trim();
  return text ? text.slice(0, 500) : undefined;
}

function normalizeFavorite(value: unknown): MemberFavorite | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  const contentId = record.content_id;
  if (
    (kind !== 'station' && kind !== 'podcast_show' && kind !== 'podcast_episode') ||
    typeof contentId !== 'string' ||
    !contentId.trim()
  ) {
    return null;
  }
  return {
    kind,
    content_id: contentId,
    title: cleanText(record.title) ?? null,
    subtitle: cleanText(record.subtitle) ?? null,
    artwork_url: cleanText(record.artwork_url) ?? null,
    created_at: typeof record.created_at === 'string' ? record.created_at : undefined,
  };
}

function normalizeProgress(value: unknown): MemberEpisodeProgress | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const contentId = record.content_id;
  const position = Number(record.position_seconds);
  const duration = Number(record.duration_seconds);
  if (
    typeof contentId !== 'string' ||
    !contentId.trim() ||
    !Number.isFinite(position) ||
    !Number.isFinite(duration)
  ) {
    return null;
  }
  return {
    content_id: contentId,
    position_seconds: Math.max(0, Math.floor(position)),
    duration_seconds: Math.max(0, Math.floor(duration)),
    completed: record.completed === true,
    title: cleanText(record.title) ?? null,
    subtitle: cleanText(record.subtitle) ?? null,
    artwork_url: cleanText(record.artwork_url) ?? null,
    updated_at: typeof record.updated_at === 'string' ? record.updated_at : undefined,
  };
}

function normalizeHistoryItem(value: unknown): MemberListeningHistoryItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  const contentId = record.content_id;
  const eventType = record.event_type;
  if (
    (kind !== 'station' && kind !== 'podcast_show' && kind !== 'podcast_episode') ||
    typeof contentId !== 'string' ||
    !contentId.trim() ||
    (eventType !== 'play' && eventType !== 'resume' && eventType !== 'complete')
  ) {
    return null;
  }
  const position = record.position_seconds == null ? null : Number(record.position_seconds);
  const duration = record.duration_seconds == null ? null : Number(record.duration_seconds);
  return {
    id: Number.isFinite(Number(record.id)) ? Number(record.id) : 0,
    kind,
    content_id: contentId,
    title: cleanText(record.title) ?? null,
    subtitle: cleanText(record.subtitle) ?? null,
    artwork_url: cleanText(record.artwork_url) ?? null,
    event_type: eventType,
    position_seconds: position != null && Number.isFinite(position) ? Math.max(0, Math.floor(position)) : null,
    duration_seconds: duration != null && Number.isFinite(duration) ? Math.max(0, Math.floor(duration)) : null,
    listened_at: typeof record.listened_at === 'string' ? record.listened_at : undefined,
  };
}

function normalizeLibrary(value: unknown): MemberLibrary {
  if (!value || typeof value !== 'object') {
    return {favorites: [], progress: []};
  }
  const data = value as Record<string, unknown>;
  return {
    favorites: Array.isArray(data.favorites)
      ? data.favorites.map(normalizeFavorite).filter((item): item is MemberFavorite => item !== null)
      : [],
    progress: Array.isArray(data.progress)
      ? data.progress.map(normalizeProgress).filter((item): item is MemberEpisodeProgress => item !== null)
      : [],
  };
}

function mutationKey(mutation: PendingMutation): string {
  return mutation.type === 'favorite'
    ? `favorite:${mutation.favorite.kind}:${mutation.favorite.contentId}`
    : `progress:${mutation.progress.episodeId}`;
}

async function readPendingMutations(): Promise<PendingMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_MUTATIONS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is PendingMutation => {
      if (!value || typeof value !== 'object') {
        return false;
      }
      const mutation = value as Record<string, unknown>;
      return (
        typeof mutation.accountId === 'string' &&
        ((mutation.type === 'favorite' && Boolean(mutation.favorite)) ||
          (mutation.type === 'progress' && Boolean(mutation.progress)))
      );
    });
  } catch {
    return [];
  }
}

async function writePendingMutations(mutations: PendingMutation[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_MUTATIONS_KEY, JSON.stringify(mutations));
}

async function enqueueMutation(mutation: PendingMutation): Promise<void> {
  const existing = await readPendingMutations();
  const key = mutationKey(mutation);
  const next = existing.filter(
    (item) => item.accountId !== mutation.accountId || mutationKey(item) !== key,
  );
  next.push(mutation);
  await writePendingMutations(next);
}

async function sendMutation(mutation: PendingMutation): Promise<void> {
  if (mutation.type === 'favorite') {
    const {favorite, active} = mutation;
    const url = `/profile/favorites/${favorite.kind}/${encodeURIComponent(favorite.contentId)}`;
    if (active) {
      await api.put(url, {
        title: cleanText(favorite.title),
        subtitle: cleanText(favorite.subtitle),
        artwork_url: cleanText(favorite.artworkUrl),
      });
    } else {
      await api.delete(url);
    }
    return;
  }

  const {progress} = mutation;
  await api.put(`/profile/progress/${encodeURIComponent(progress.episodeId)}`, {
    position_seconds: progress.positionSeconds,
    duration_seconds: progress.durationSeconds,
    completed: progress.completed === true,
    title: cleanText(progress.title),
    subtitle: cleanText(progress.subtitle),
    artwork_url: cleanText(progress.artworkUrl),
  });
}

async function flushPendingMutations(accountId: string): Promise<PendingMutation[]> {
  const pending = await readPendingMutations();
  const remaining: PendingMutation[] = [];
  for (const mutation of pending) {
    if (mutation.accountId !== accountId) {
      remaining.push(mutation);
      continue;
    }
    try {
      await sendMutation(mutation);
    } catch {
      remaining.push(mutation);
    }
  }
  await writePendingMutations(remaining);
  return remaining.filter((mutation) => mutation.accountId === accountId);
}

export async function loadMemberLibraryForAccount(accountId: string): Promise<MemberLibrary> {
  const owner = accountKey(accountId);
  if (!owner) {
    throw new Error('A registered RadioTEDU account is required.');
  }
  await flushPendingMutations(owner);
  const response = await api.get('/profile/library');
  return normalizeLibrary(response.data?.data);
}

export async function loadMemberListeningHistoryForAccount(
  accountId: string,
  limit: number = 100,
): Promise<MemberListeningHistoryItem[]> {
  const owner = accountKey(accountId);
  if (!owner) {
    throw new Error('A registered RadioTEDU account is required.');
  }
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const response = await api.get(`/profile/history?limit=${safeLimit}`);
  const data = response.data?.data;
  return Array.isArray(data?.items)
    ? data.items.map(normalizeHistoryItem).filter((item): item is MemberListeningHistoryItem => item !== null)
    : [];
}

export async function setMemberFavoriteForAccount(
  accountId: string,
  favorite: FavoriteInput,
  active: boolean,
): Promise<void> {
  const owner = accountKey(accountId);
  if (!owner || !favorite.contentId.trim()) {
    return;
  }
  const mutation: FavoriteMutation = {
    type: 'favorite',
    accountId: owner,
    favorite: {
      ...favorite,
      contentId: favorite.contentId.trim(),
      title: cleanText(favorite.title),
      subtitle: cleanText(favorite.subtitle),
      artworkUrl: cleanText(favorite.artworkUrl),
    },
    active,
  };
  try {
    await enqueueMutation(mutation);
    await flushPendingMutations(owner);
  } catch {
    // Keep the on-device change; retry the queued write the next time the library loads.
  }
}

export async function saveMemberEpisodeProgressForAccount(
  accountId: string,
  progress: EpisodeProgressInput,
): Promise<void> {
  const owner = accountKey(accountId);
  if (!owner || !progress.episodeId.trim()) {
    return;
  }
  const mutation: ProgressMutation = {
    type: 'progress',
    accountId: owner,
    progress: {
      ...progress,
      episodeId: progress.episodeId.trim(),
      positionSeconds: Math.max(0, Math.min(MAX_PROGRESS_SECONDS, Math.floor(progress.positionSeconds))),
      durationSeconds: Math.max(0, Math.min(MAX_PROGRESS_SECONDS, Math.floor(progress.durationSeconds))),
      title: cleanText(progress.title),
      subtitle: cleanText(progress.subtitle),
      artworkUrl: cleanText(progress.artworkUrl),
    },
  };
  try {
    await enqueueMutation(mutation);
    await flushPendingMutations(owner);
  } catch {
    // Keep the most recent progress locally for a retry on the next library load.
  }
}

export async function recordMemberListeningHistoryForAccount(
  accountId: string,
  event: ListeningHistoryInput,
): Promise<void> {
  const owner = accountKey(accountId);
  const contentId = String(event.contentId ?? '').trim();
  if (!owner || !contentId) {
    return;
  }
  const clampSeconds = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) {
      return null;
    }
    return Math.max(0, Math.min(MAX_PROGRESS_SECONDS, Math.floor(value)));
  };
  await api.post('/profile/history', {
    kind: event.kind,
    content_id: contentId,
    title: cleanText(event.title),
    subtitle: cleanText(event.subtitle),
    artwork_url: cleanText(event.artworkUrl),
    event_type: event.eventType ?? 'play',
    position_seconds: clampSeconds(event.positionSeconds),
    duration_seconds: clampSeconds(event.durationSeconds),
  });
}

export function findMemberEpisodeProgress(
  library: MemberLibrary,
  episodeId: string,
): MemberEpisodeProgress | null {
  return library.progress.find((item) => item.content_id === episodeId) ?? null;
}

export async function syncRadioFavoritesForAccount(
  accountId: string,
  channels: RadioChannelFavoriteSource[],
): Promise<string[]> {
  const owner = accountKey(accountId);
  if (!owner) {
    return loadFavoriteChannelIds();
  }

  const localIds = await loadFavoriteChannelIds();
  const previousOwner = await AsyncStorage.getItem(RADIO_FAVORITE_OWNER_KEY);
  let library = await loadMemberLibraryForAccount(owner);
  let serverIds = new Set(
    library.favorites
      .filter((favorite) => favorite.kind === 'station')
      .map((favorite) => favorite.content_id),
  );

  // Import existing device favorites once. After that, the account library is
  // authoritative, so a removal on another device is not resurrected here.
  if (!previousOwner) {
    for (const channelId of localIds) {
      if (serverIds.has(channelId)) {
        continue;
      }
      const channel = channels.find((item) => item.id === channelId);
      await setMemberFavoriteForAccount(
        owner,
        {
          kind: 'station',
          contentId: channelId,
          title: channel?.name ?? channelId,
          subtitle: channel?.description,
          artworkUrl: channel?.artwork,
        },
        true,
      );
    }
    library = await loadMemberLibraryForAccount(owner);
    serverIds = new Set(
      library.favorites
        .filter((favorite) => favorite.kind === 'station')
        .map((favorite) => favorite.content_id),
    );
  }

  const pending = await readPendingMutations();
  for (const mutation of pending) {
    if (
      mutation.accountId !== owner ||
      mutation.type !== 'favorite' ||
      mutation.favorite.kind !== 'station'
    ) {
      continue;
    }
    if (mutation.active) {
      serverIds.add(mutation.favorite.contentId);
    } else {
      serverIds.delete(mutation.favorite.contentId);
    }
  }

  const favoriteIds = [...serverIds];
  await saveFavoriteChannelIds(favoriteIds);
  await AsyncStorage.setItem(RADIO_FAVORITE_OWNER_KEY, owner);
  return favoriteIds;
}
