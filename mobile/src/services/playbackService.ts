import TrackPlayer, {Event, State} from 'react-native-track-player';
import {
  clearConnectionWatchdog,
  ensureBrowsableQueue,
  fallbackActiveChannelStream,
  findChannelByQuery,
  getLatestCachedPodcastId,
  isPodcastId,
  playAdjacentQueueItem,
  playChannelById,
  playTrackById,
  pausePlaybackByUser,
  rebuildBrowsableQueue,
  resumePlaybackByUser,
  setCachedPodcasts,
  stopPlaybackByUser,
} from './playbackQueue';
import {fetchPodcasts} from './podcastService';
import {resolveCurrentStreamPreferences} from './streamPreferences';
import {logSafeError} from '../utils/safeLog';
import {Analytics} from './analyticsService';
import {startNetworkPlaybackRecovery} from './networkPlaybackRecovery';

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

let stopNetworkRecovery: (() => void) | undefined;

export const PlaybackService = async function () {
  stopNetworkRecovery?.();
  stopNetworkRecovery = startNetworkPlaybackRecovery();
  // Transport controls (notification, lock screen, car, headset, Bluetooth).
  TrackPlayer.addEventListener(Event.RemotePlay, resumePlaybackByUser);
  TrackPlayer.addEventListener(Event.RemotePause, pausePlaybackByUser);
  TrackPlayer.addEventListener(Event.RemoteStop, stopPlaybackByUser);
  TrackPlayer.addEventListener(Event.RemoteNext, () =>
    playAdjacentQueueItem(1),
  );
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    playAdjacentQueueItem(-1),
  );
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async ({interval}: any) => {
    try {
      const track = await TrackPlayer.getActiveTrack();
      if (track?.id && isPodcastId(String(track.id))) {
        await TrackPlayer.seekBy(interval || 30);
      }
    } catch (error) {
      logSafeError('playback.remoteJumpForward', error);
    }
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async ({interval}: any) => {
    try {
      const track = await TrackPlayer.getActiveTrack();
      if (track?.id && isPodcastId(String(track.id))) {
        await TrackPlayer.seekBy(-(interval || 15));
      }
    } catch (error) {
      logSafeError('playback.remoteJumpBackward', error);
    }
  });

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

  let wasPlayingBeforeDuck = false;

  TrackPlayer.addEventListener(
    Event.RemoteDuck,
    async ({paused, permanent, ducking}: any) => {
      try {
        const {state} = await TrackPlayer.getPlaybackState();
        const isCurrentlyPlaying = state === State.Playing;

        if (permanent) {
          wasPlayingBeforeDuck = false;
          await pausePlaybackByUser();
          return;
        }

        if (paused) {
          if (isCurrentlyPlaying) {
            wasPlayingBeforeDuck = true;
          }
          await TrackPlayer.pause();
          return;
        }

        if (ducking) {
          await TrackPlayer.setVolume(0.35);
          return;
        }

        // Interruption / ducking ended
        await TrackPlayer.setVolume(1.0);
        if (wasPlayingBeforeDuck) {
          wasPlayingBeforeDuck = false;
          await resumePlaybackByUser();
        }
      } catch (error) {
        logSafeError('playback.remoteDuck', error);
      }
    },
  );

  TrackPlayer.addEventListener(Event.PlaybackState, ({state}) => {
    if (state === State.Playing) {
      clearConnectionWatchdog();
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackError, async error => {
    try {
      const recovered = await fallbackActiveChannelStream();
      Analytics.playbackError(String(error?.code ?? 'unknown'), recovered);
      if (!recovered) {
        logSafeError('playback.noFallback', error);
      }
    } catch (fallbackError) {
      Analytics.playbackError(String(error?.code ?? 'unknown'), false);
      logSafeError('playback.fallback', fallbackError);
    }
  });
};
