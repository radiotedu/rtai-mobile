import TrackPlayer, {Event} from 'react-native-track-player';
import {
  ensureBrowsableQueue,
  fallbackActiveChannelStream,
  findChannelByQuery,
  getLatestCachedPodcastId,
  isPodcastId,
  playAdjacentQueueItem,
  playChannelById,
  playTrackById,
  rebuildBrowsableQueue,
  setCachedPodcasts,
} from './playbackQueue';
import {fetchPodcasts} from './podcastService';
import {resolveCurrentStreamPreferences} from './streamPreferences';
import {logSafeError} from '../utils/safeLog';

const LATEST_PODCAST_WORDS = [
  'latest',
  'newest',
  'son',
  'yeni',
  'последний',
  'новый',
  'احدث',
  'neuester',
  'neueste',
  'letzte',
  'dernier',
  'nouveau',
  'nouvel',
];
const PODCAST_CONTENT_WORDS = [
  'podcast',
  'episode',
  'bolum',
  'подкаст',
  'выпуск',
  'بودكاست',
  'حلقة',
  'folge',
];

function normalizeMediaVoiceText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
    .toLowerCase()
    .replace(/[-_.,!?;:'"()\x2f\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedWords(values: string[]): Set<string> {
  return new Set(values.map(normalizeMediaVoiceText));
}

export function isLatestPodcastVoiceQuery(value: string): boolean {
  const query = normalizeMediaVoiceText(value);
  const standalone = normalizedWords(['podcast', 'подкаст', 'بودكاست']);
  if (standalone.has(query)) {
    return true;
  }
  const words = new Set(query.split(' ').filter(Boolean));
  const latest = normalizedWords(LATEST_PODCAST_WORDS);
  const podcast = normalizedWords(PODCAST_CONTENT_WORDS);
  return (
    [...latest].some(word => words.has(word)) &&
    [...podcast].some(word => words.has(word))
  );
}

export async function playLatestPodcastFromSearch(): Promise<boolean> {
  const selection = await resolveCurrentStreamPreferences();
  await ensureBrowsableQueue(selection.quality);

  let cachedLatestId = getLatestCachedPodcastId();
  let queue = await TrackPlayer.getQueue();
  let latest = cachedLatestId
    ? queue.find(track => String(track.id) === cachedLatestId)
    : queue.find(track => isPodcastId(String(track.id)));

  if (!latest && !cachedLatestId) {
    try {
      const {items} = await fetchPodcasts(1);
      setCachedPodcasts(items);
      cachedLatestId = getLatestCachedPodcastId();
    } catch {
      return false;
    }
  }

  if (!latest && cachedLatestId) {
    await rebuildBrowsableQueue(selection.quality);
    queue = await TrackPlayer.getQueue();
    latest = queue.find(track => String(track.id) === cachedLatestId);
  }

  return latest ? playTrackById(String(latest.id)) : false;
}

export async function handleRemotePlaySearch(query: string): Promise<void> {
  if (isLatestPodcastVoiceQuery(query)) {
    const played = await playLatestPodcastFromSearch();
    if (!played) {
      logSafeError(
        'playback.latestPodcastUnavailable',
        new Error('No playable podcast is cached.'),
      );
    }
    return;
  }

  const channel = findChannelByQuery(query);
  await playChannelById(channel.id);
}

export const PlaybackService = async function () {
  // Transport controls (notification, lock screen, car, headset, Bluetooth).
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteNext, () =>
    playAdjacentQueueItem(1),
  );
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    playAdjacentQueueItem(-1),
  );

  // Android Auto / CarPlay: user tapped an item in the browse list.
  // The id is a channel id (e.g. "radiotedu-jazz") or "podcast:<id>".
  TrackPlayer.addEventListener(Event.RemotePlayId, async ({id}) => {
    try {
      if (isPodcastId(id)) {
        const streamSelection = await resolveCurrentStreamPreferences();
        await ensureBrowsableQueue(streamSelection.quality);
        await playTrackById(id);
      } else {
        await playChannelById(id);
      }
    } catch (error) {
      logSafeError('playback.remotePlayId', error);
    }
  });

  // Voice / search ("Play RadioTEDU", "put on jazz").
  TrackPlayer.addEventListener(Event.RemotePlaySearch, async ({query}) => {
    try {
      await handleRemotePlaySearch(query ?? '');
    } catch (error) {
      logSafeError('playback.remoteSearch', error);
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackError, async error => {
    try {
      const recovered = await fallbackActiveChannelStream();
      if (!recovered) {
        logSafeError('playback.noFallback', error);
      }
    } catch (fallbackError) {
      logSafeError('playback.fallback', fallbackError);
    }
  });
};
