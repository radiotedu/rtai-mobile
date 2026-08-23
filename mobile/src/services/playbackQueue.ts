/**
 * Single source of truth for the TrackPlayer queue.
 *
 * The queue is also what Android Auto / CarPlay browse, so it must always hold
 * the full, stable set of playable items - the live radio channels first, then
 * (optionally) recent podcast episodes. Every play action skips *within* this
 * queue instead of resetting it, so the car browse list never collapses.
 *
 * react-native-track-player v4 exposes the queue to the car as a single flat
 * list (no nested folders from JS), so channels and podcasts share one queue.
 */
import TrackPlayer, {State, Track} from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Alert} from 'react-native';
import {Image} from 'react-native';
import i18n from '../i18n';
import {
  buildStreamFallbacks,
  HIGH_QUALITY_MOBILE_DATA_WARNING,
  RADIO_CHANNELS,
  getRuntimeVisibleChannels,
  RadioChannel,
  resolveStreamQuality,
  shouldUseStationOnlyPresentation,
  StreamFallback,
  StreamQuality,
} from '../data/radioChannels';
import {getChannelCopy} from '../i18n/channelCopy';
import {logSafeError} from '../utils/safeLog';
import type {Podcast} from './podcastService';
import {
  isCellularNetwork,
  resolveCurrentStreamPreferences,
} from './streamPreferences';

export const PODCAST_ID_PREFIX = 'podcast:';

const RECENTS_KEY = '@radiotedu/recents';
const MAX_RECENTS = 6;

export interface RecentItem {
  id: string;
  title: string;
  artist: string;
  artwork: string;
}

/** Remember a played item for the car "Recently Played" row (most-recent first). */
async function recordRecent(track: Track): Promise<void> {
  if (!track?.id) {
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    const list: RecentItem[] = raw ? JSON.parse(raw) : [];
    const next = [
      {
        id: String(track.id),
        title: track.title ?? 'RadioTEDU',
        artist: (track.artist as string) ?? '',
        artwork: (track.artwork as string) ?? '',
      },
      ...list.filter(r => r.id !== track.id),
    ].slice(0, MAX_RECENTS);
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
}

export async function getRecentItems(): Promise<RecentItem[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const FALLBACK_ARTWORK =
  'https://radiotedu.com/wp-content/uploads/2025/07/logo-02-scaled.png';
const PODCAST_ARTIST_FALLBACK = 'RadioTEDU Podcast';

// Cache of podcasts to expose in the car, set once at startup by App.tsx.
let cachedPodcasts: Podcast[] = [];
const channelFallbacks = new Map<string, StreamFallback[]>();

export type PlaybackSelectionResult = {
  played: boolean;
  cancelled: boolean;
  quality: StreamQuality;
};

export function isPodcastId(id: string | undefined | null): boolean {
  return !!id && id.startsWith(PODCAST_ID_PREFIX);
}

export function channelArtwork(channel: RadioChannel): string {
  if (typeof channel.logo === 'number') {
    const bundled = Image.resolveAssetSource(channel.logo);
    if (bundled?.uri) {
      return bundled.uri;
    }
  }
  return channel.artwork || FALLBACK_ARTWORK;
}

/** Full-resolution bundled square artwork for native media surfaces. */
export function channelArtworkResource(channel: RadioChannel): number | undefined {
  if (typeof channel.logo !== 'number') {
    return undefined;
  }
  return channel.logo;
}

function channelTrackFromStream(
  channel: RadioChannel,
  stream: StreamFallback,
): Track {
  const copy = getChannelCopy(channel.copyKey, i18n.language, {
    name: channel.name,
    description: channel.description,
  });
  return {
    id: channel.id,
    url: stream.url,
    title: copy.name,
    artist: shouldUseStationOnlyPresentation(channel, stream.quality) ? '' : copy.description,
    // TrackPlayer's Android bridge expects artwork as a URI string. Keep the
    // bundled high-resolution image, but resolve its numeric RN source first.
    artwork: channelArtwork(channel),
    isLiveStream: true,
    streamQuality: stream.quality,
    streamIsLegacy: stream.isLegacy,
  } as Track;
}

export function buildChannelTrack(
  channel: RadioChannel,
  quality: StreamQuality,
): Track {
  const resolvedQuality = resolveStreamQuality(channel, quality);
  const fallbacks = buildStreamFallbacks(channel, resolvedQuality);
  channelFallbacks.set(channel.id, fallbacks);
  return channelTrackFromStream(channel, fallbacks[0]);
}

export function buildPodcastTrack(podcast: Podcast): Track | null {
  if (!podcast.audioUrl) {
    return null; // external-only episodes can't be played in the car
  }
  return {
    id: `${PODCAST_ID_PREFIX}${podcast.id}`,
    url: podcast.audioUrl,
    title: podcast.title,
    artist: podcast.feedTitle || PODCAST_ARTIST_FALLBACK,
    artwork: podcast.imageUrl || FALLBACK_ARTWORK,
    isLiveStream: false,
  };
}

export function buildRadioQueue(quality: StreamQuality): Track[] {
  return getRuntimeVisibleChannels().map(channel =>
    buildChannelTrack(channel, quality),
  );
}

function buildPodcastQueue(podcasts: Podcast[]): Track[] {
  return podcasts
    .map(buildPodcastTrack)
    .filter((track): track is Track => track !== null);
}

/** Store podcasts so they appear in the car browse list. */
export function setCachedPodcasts(podcasts: Podcast[]): void {
  cachedPodcasts = podcasts;
}

/** First playable cached episode; fetch order is newest-first. */
export function getLatestCachedPodcastId(): string | null {
  const latest = cachedPodcasts.find(podcast => !!podcast.audioUrl);
  return latest ? `${PODCAST_ID_PREFIX}${latest.id}` : null;
}

/** Replace the entire queue with channels (+ cached podcasts). */
export async function rebuildBrowsableQueue(
  quality: StreamQuality,
): Promise<void> {
  await TrackPlayer.reset();
  await TrackPlayer.add(buildRadioQueue(quality));
  const podcastTracks = buildPodcastQueue(cachedPodcasts);
  if (podcastTracks.length > 0) {
    await TrackPlayer.add(podcastTracks);
  }
}

/**
 * Make sure the queue holds all channels (in order) before we skip into it.
 * Rebuilds only when the channels are missing - e.g. first launch - so we
 * don't needlessly disturb a queue the car is already browsing.
 */
export async function ensureBrowsableQueue(
  quality: StreamQuality,
): Promise<void> {
  const queue = await TrackPlayer.getQueue();
  const visibleChannels = getRuntimeVisibleChannels();
  const hasAllChannels = visibleChannels.every((channel, index) => {
    return queue[index]?.id === channel.id;
  });
  if (!hasAllChannels) {
    await rebuildBrowsableQueue(quality);
  }
}

export async function playTrackById(id: string): Promise<boolean> {
  const queue = await TrackPlayer.getQueue();
  const index = queue.findIndex(track => track.id === id);
  if (index === -1) {
    return false;
  }
  const activeTrack = await TrackPlayer.getActiveTrack();
  if (activeTrack?.id === id && activeTrack?.url === queue[index]?.url) {
    await TrackPlayer.play();
  } else {
    await TrackPlayer.skip(index);
    await TrackPlayer.play();
  }
  recordRecent(queue[index]).catch(() => {});
  return true;
}

/**
 * Play the next/previous queue item while keeping radio playback on the same
 * quality-selection and cellular-FLAC safety path as an explicit station tap.
 */
export async function playAdjacentQueueItem(offset: -1 | 1): Promise<boolean> {
  const queue = await TrackPlayer.getQueue();
  if (queue.length === 0) {
    return false;
  }

  const activeIndex = await TrackPlayer.getActiveTrackIndex();
  const startIndex =
    typeof activeIndex === 'number'
      ? activeIndex
      : offset > 0
        ? -1
        : 0;
  const targetIndex = (startIndex + offset + queue.length) % queue.length;
  const target = queue[targetIndex];
  const channel = RADIO_CHANNELS.find(item => item.id === String(target?.id ?? ''));

  if (channel) {
    const result = await playChannelById(channel.id);
    return result.played;
  }

  await TrackPlayer.skip(targetIndex);
  await TrackPlayer.play();
  recordRecent(target).catch(() => {});
  return true;
}

function confirmFlacOnCellular(channel: RadioChannel): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (answer: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(answer);
    };

    Alert.alert(
      'FLAC over mobile data',
      channel.mobileDataWarning || HIGH_QUALITY_MOBILE_DATA_WARNING,
      [
        {text: 'Cancel', style: 'cancel', onPress: () => finish(false)},
        {text: 'Play FLAC', onPress: () => finish(true)},
      ],
      {cancelable: true, onDismiss: () => finish(false)},
    );
  });
}

export const NORMAL_CONNECT_TIMEOUT_MS = 5000;
export const FLAC_CONNECT_TIMEOUT_MS = 12000;
let connectionWatchdogTimer: ReturnType<typeof setTimeout> | null = null;

export function clearConnectionWatchdog(): void {
  if (connectionWatchdogTimer) {
    clearTimeout(connectionWatchdogTimer);
    connectionWatchdogTimer = null;
  }
}

export function startConnectionWatchdog(
  channel: RadioChannel,
  quality: StreamQuality,
  timeoutMs?: number,
): void {
  clearConnectionWatchdog();

  const effectiveTimeout =
    timeoutMs ?? (quality === 'flac' ? FLAC_CONNECT_TIMEOUT_MS : NORMAL_CONNECT_TIMEOUT_MS);

  connectionWatchdogTimer = setTimeout(async () => {
    try {
      const {state} = await TrackPlayer.getPlaybackState();
      const activeTrack = await TrackPlayer.getActiveTrack();

      if (
        activeTrack?.id === channel.id &&
        state !== State.Playing
      ) {
        console.log(
          `[playbackQueue] Connection to stream timed out after ${effectiveTimeout}ms. Cascading fallback.`,
        );
        await fallbackActiveChannelStream();
      }
    } catch (error) {
      logSafeError('playback.connectionWatchdog', error);
    }
  }, effectiveTimeout);
}

/** Resolve the saved quality, update the queue item, then play it. */
export async function playChannelById(
  channelId: string,
  qualityOverride?: StreamQuality,
): Promise<PlaybackSelectionResult> {
  clearConnectionWatchdog();
  const channel = RADIO_CHANNELS.find(item => item.id === channelId);
  if (!channel) {
    throw new Error(`Unknown RadioTEDU channel: ${channelId}`);
  }

  const selection = await resolveCurrentStreamPreferences({
    ...(qualityOverride ? {quality: qualityOverride} : {}),
  });
  const quality = resolveStreamQuality(channel, qualityOverride || selection.quality);

  if (
    quality === 'flac' &&
    isCellularNetwork(selection.network) &&
    !(await confirmFlacOnCellular(channel))
  ) {
    return {played: false, cancelled: true, quality};
  }

  await ensureBrowsableQueue(quality);
  await replaceChannelTrack(channel, quality);
  let played = await playTrackById(channelId);
  if (!played) {
    // Channel wasn't in the queue (stale queue) - rebuild and retry once.
    await rebuildBrowsableQueue(quality);
    played = await playTrackById(channelId);
  }

  if (played) {
    startConnectionWatchdog(channel, quality);
  }

  return {played, cancelled: false, quality};
}

/**
 * Replace one channel's track in place (used when the user changes stream
 * quality) without tearing down the rest of the browsable queue.
 */
export async function replaceChannelTrack(
  channel: RadioChannel,
  quality: StreamQuality,
): Promise<void> {
  const queue = await TrackPlayer.getQueue();
  const index = queue.findIndex(track => track.id === channel.id);
  if (index === -1) {
    await rebuildBrowsableQueue(quality);
    return;
  }
  const newTrack = buildChannelTrack(channel, quality);
  if (queue[index]?.url === newTrack.url) {
    return;
  }
  const activeIndex = await TrackPlayer.getActiveTrackIndex();
  await TrackPlayer.remove(index);
  await TrackPlayer.add(newTrack, index);
  if (activeIndex === index) {
    await TrackPlayer.skip(index);
    await TrackPlayer.play();
  }
}

/**
 * Move a failed quality stream to the next safe candidate:
 * selected quality -> normal -> low -> legacy mount -> next available station.
 */
export async function fallbackActiveChannelStream(): Promise<boolean> {
  clearConnectionWatchdog();
  const track = await TrackPlayer.getActiveTrack();
  const channelId = String(track?.id ?? '');
  const channel = RADIO_CHANNELS.find(item => item.id === channelId);
  const fallbacks = channelFallbacks.get(channelId);
  if (!channel || !fallbacks?.length) {
    return false;
  }

  const currentUrl = String(track?.url ?? '');
  const currentIndex = fallbacks.findIndex(item => item.url === currentUrl);
  const next = fallbacks[currentIndex + 1];
  if (!next) {
    const visible = getRuntimeVisibleChannels();
    const currentIdx = visible.findIndex(c => c.id === channelId);
    const nextStation =
      visible.find((c, idx) => idx !== currentIdx && isChannelPlayable(c)) ||
      visible[0];
    if (nextStation && nextStation.id !== channelId) {
      console.log(
        `[playbackQueue] All fallbacks exhausted for ${channelId}. Switching to ${nextStation.id}`,
      );
      const res = await playChannelById(nextStation.id);
      return res.played;
    }
    return false;
  }

  const queue = await TrackPlayer.getQueue();
  const queueIndex = queue.findIndex(item => item.id === channelId);
  if (queueIndex === -1) {
    return false;
  }

  console.log(
    `[playbackQueue] Fallback for ${channelId}: switching to ${next.quality} (${next.url})`,
  );
  await TrackPlayer.remove(queueIndex);
  await TrackPlayer.add(channelTrackFromStream(channel, next), queueIndex);
  await TrackPlayer.skip(queueIndex);
  await TrackPlayer.play();
  startConnectionWatchdog(channel, next.quality);
  return true;
}

/**
 * Match a free-text voice query ("Play RadioTEDU", "put on jazz") to a channel.
 * Falls back to the main channel when nothing matches so voice always plays.
 */
export function findChannelByQuery(query: string): RadioChannel {
  const normalizeVoiceText = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const normalized = normalizeVoiceText(query);
  if (normalized.length > 0) {
    const visibleChannels = getRuntimeVisibleChannels();
    const mainChannel = visibleChannels[0] || RADIO_CHANNELS[0];
    const specificChannels = visibleChannels.filter(
      channel => channel.id !== mainChannel.id,
    );
    const match = specificChannels.find(channel => {
      const terms = [
        channel.name,
        channel.description,
        channel.mountPath.replace(/^\//, ''),
        channel.id.replace(/^radiotedu-/, ''),
      ];
      return terms.some(term => {
        const normalizedTerm = normalizeVoiceText(term);
        return normalizedTerm.length > 1 && normalized.includes(normalizedTerm);
      });
    });
    if (match) {
      return match;
    }
  }
  return getRuntimeVisibleChannels()[0] || RADIO_CHANNELS[0];
}
