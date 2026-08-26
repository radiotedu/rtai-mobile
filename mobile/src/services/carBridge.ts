/**
 * JS side of the native Android Auto / Automotive media browser.
 *
 * Implements the RadioTEDU car design: a grid Browse Home with live radio and
 * podcasts. Podcast episodes are grouped beneath their series.
 *  - Live Radios   : the live channels (playable)
 *  - Podcasts      : series → episodes (playable)
 *
 * The car renders the dark, driver-optimized template; we only supply the tree +
 * metadata + content-style hints. Android-only; no-op without the native module.
 */
import {DeviceEventEmitter, NativeModules, Platform} from 'react-native';
import TrackPlayer, {Event, State} from 'react-native-track-player';
import i18n, {getLanguagePreference} from '../i18n';
import {getChannelCopy} from '../i18n/channelCopy';
import {checkStreamAvailability} from '../utils/api';
import {
  buildVisibleChannels,
  channelsVisibleWithoutLiveCheck,
  RADIO_CHANNELS,
  setRuntimeVisibleChannels,
  shouldUseStationOnlyPresentation,
  StreamQuality,
} from '../data/radioChannels';
import type {Podcast} from './podcastService';
import {
  buildChannelTrack,
  ensureBrowsableQueue,
  findChannelByQuery,
  playAdjacentQueueItem,
  playChannelById,
  playTrackById,
  PODCAST_ID_PREFIX,
} from './playbackQueue';
import {resolveCurrentStreamPreferences} from './streamPreferences';

const CarBridge = NativeModules.RadioTeduCarBridge as
  | {
      setCatalog: (json: string) => void;
      updateNowPlaying: (
        title: string,
        artist: string,
        artwork: string,
        isPlaying: boolean,
      ) => void;
      setLanguagePreference?: (preference: string) => void;
    }
  | undefined;

const isAvailable = Platform.OS === 'android' && !!CarBridge;
// Bundled vector tiles so the car grid matches the design's coloured destinations.
const TILE = 'android.resource://com.radiotedumobile/drawable/';

// Android Auto runs in another process. Metro/file asset URIs are private to
// the app and can render as blank artwork there, so car metadata uses packaged,
// cross-process resources built from the approved 2048x2048 square artwork.
const CAR_STATION_ARTWORK: Record<string, string> = {
  'radiotedu-main': `${TILE}car_station_radiotedu`,
  'radiotedu-classic': `${TILE}car_station_classic`,
  'radiotedu-jazz': `${TILE}car_station_cazz`,
  'radiotedu-lofi': `${TILE}car_station_lofi`,
  'radiotedu-energize': `${TILE}car_station_energize`,
  'radiotedu-spark': `${TILE}car_station_radiotedu`,
  'radiotedu-rock': `${TILE}car_station_rock`,
  'radiotedu-en': `${TILE}car_station_en`,
  'radiotedu-fr': `${TILE}car_station_fr`,
};

function carStationArtwork(channelId: string): string {
  return CAR_STATION_ARTWORK[channelId] ?? `${TILE}car_station_radiotedu`;
}

let cachedPodcasts: Podcast[] = [];
let catalogQuality: StreamQuality = 'normal';
let catalogChannels = channelsVisibleWithoutLiveCheck();

/** Driving surfaces never select lossless/high mounts. */
export function carSafeQuality(quality: StreamQuality): StreamQuality {
  return quality === 'low' ? 'low' : 'normal';
}

function carStationTitle(channelId: string): string {
  return ({
    'radiotedu-main': 'RadioTEDU',
    'radiotedu-classic': 'RadioTEDU Classical',
    'radiotedu-jazz': 'RadioTEDU Jazz',
    'radiotedu-lofi': 'RadioTEDU Lo-Fi',
    'radiotedu-energize': 'RadioTEDU Energize',
    'radiotedu-spark': 'RadioTEDU Voting',
    'radiotedu-rock': 'RadioTEDU Rock',
    'radiotedu-en': 'RadioTEDU English',
    'radiotedu-fr': 'RadioTEDU Français',
  } as Record<string, string>)[channelId] ?? 'RadioTEDU';
}

type CarItem = {
  id: string;
  title: string;
  subtitle: string;
  artwork: string;
  playable: boolean;

  // ExoPlayer (no dependency on the RN JS runtime). Empty for non-playable
  // items (e.g. jukebox:none). channelStreamUrl(...) is not exported from
  // playbackQueue, so we derive radio URLs via buildChannelTrack(...).url,
  // which is exactly channel.streams?.[quality] || channel.streamUrl.
  url: string;
  quality?: StreamQuality;
  audioFormat?: 'HE-AAC v2' | 'AAC-LC' | 'FLAC' | 'MP3 192' | 'Podcast audio' | string;
  /** Optional lossless stream; never exposed as a browse-row URL. */
  hiFiUrl?: string;
  /** Podcast series identifier; used by native Android Auto Next/Previous. */
  seriesId?: string;
};

const t = () => i18n.t.bind(i18n);

// --- Destination data (best-effort; empty on failure, never throws) ---

function radioItems(): CarItem[] {
  return catalogChannels.map(c => {
    const copy = getChannelCopy(c.copyKey, i18n.language, {
      name: c.name,
      description: c.description,
    });
    const track = buildChannelTrack(c, catalogQuality);
    const audioFormat =
      track.streamQuality === 'flac'
        ? 'FLAC'
        : c.codecLabels?.[track.streamQuality as StreamQuality] ||
          (track.streamQuality === 'low' ? 'HE-AAC v2' : 'AAC-LC');
    const stationOnly = shouldUseStationOnlyPresentation(c, track.streamQuality);
    const description = stationOnly ? '' : copy.description;
    return {
      id: c.id,
      title: carStationTitle(c.id),
      // Make lossless playback explicit on distraction-safe car surfaces. The
      // mount path stays private; low/normal remain visually uncluttered.
      subtitle:
        track.streamQuality === 'flac'
          ? [audioFormat, description].filter(Boolean).join(' · ')
          : description,
      artwork: carStationArtwork(c.id),
      playable: true,
      quality: track.streamQuality,
      audioFormat,
      url: track.url,
      ...(c.id === 'radiotedu-classic' || c.id === 'radiotedu-jazz'
        ? {hiFiUrl: c.streams.flac}
        : {}),
    };
  });
}

function podcastItems(): CarItem[] {
  return cachedPodcasts
    .filter(p => !!p.audioUrl)
    .map(p => {
      const seriesTitle = p.feedTitle?.trim() || 'RadioTEDU Podcasts';
      return {
        id: `${PODCAST_ID_PREFIX}${p.id}`,
        title: p.title,
        subtitle: seriesTitle,
        artwork: p.imageUrl ?? '',
        playable: true,
        seriesId: `podcast-series:${encodeURIComponent(seriesTitle)}`,
        audioFormat: 'Podcast audio',
        // filtered above on !!p.audioUrl, so this is always a real URL.
        url: p.audioUrl ?? '',
      };
    });
}

function writeCachedCarCatalog(): void {
  const tr = t();

  const pods = podcastItems();
  const series = Array.from(
    pods.reduce((groups, episode) => {
      const id = episode.seriesId ?? 'podcast-series:RadioTEDU%20Podcasts';
      const existing = groups.get(id);
      if (existing) {
        existing.items.push(episode);
      } else {
        groups.set(id, {
          id,
          title: episode.subtitle || 'RadioTEDU Podcasts',
          artwork: episode.artwork,
          items: [episode],
        });
      }
      return groups;
    }, new Map<string, {id: string; title: string; artwork: string; items: CarItem[]}>()).values(),
  );

  const categories = [
    {
      id: 'cat_radio',
      title: tr('auto.liveRadio'),
      subtitle: tr('auto.stationsOnAir', {count: catalogChannels.length}),
      artwork: `${TILE}car_tile_radio`,
      items: radioItems(),
    },
    {
      id: 'cat_podcasts',
      title: tr('auto.podcasts'),
      subtitle: tr('auto.showsCount', {count: series.length}),
      artwork: `${TILE}car_tile_podcasts`,
      items: series.map(show => ({
        id: show.id,
        title: show.title,
        subtitle: tr('auto.episodesCount', {count: show.items.length}),
        artwork: show.artwork,
        playable: false,
        url: '',
      })),
    },
    ...series.map(show => ({
      id: show.id,
      parentId: 'cat_podcasts',
      title: show.title,
      subtitle: tr('auto.episodesCount', {count: show.items.length}),
      artwork: show.artwork,
      items: show.items,
    })),
  ];

  try {
    CarBridge!.setCatalog(JSON.stringify({categories}));
  } catch {
    // best-effort
  }
}

/** Build and push the car browse tree (Live Radio + Podcasts). */
export async function pushCarCatalog(podcasts?: Podcast[]): Promise<void> {
  if (!isAvailable) {
    return;
  }
  if (podcasts) {
    cachedPodcasts = podcasts;
  }
  const checks = await Promise.all(
    RADIO_CHANNELS.map(async channel => ({
      channel,
      isAvailable: await checkStreamAvailability(channel.streamUrl).catch(
        () => false,
      ),
    })),
  );
  catalogChannels = buildVisibleChannels(checks);
  if (catalogChannels.length === 0) {
    catalogChannels = channelsVisibleWithoutLiveCheck();
  }
  setRuntimeVisibleChannels(catalogChannels);
  catalogQuality = carSafeQuality((await resolveCurrentStreamPreferences()).quality);
  writeCachedCarCatalog();
}

function syncCarLanguagePreference(): void {
  try {
    CarBridge?.setLanguagePreference?.(getLanguagePreference());
  } catch {
    // Older native shells ignore the preference until the next app update.
  }
}

// --- Car transport -> playback (RNTP plays the actual audio) ---

async function handlePlayId(mediaId: string) {
  const radioChannel = RADIO_CHANNELS.find(channel => channel.id === mediaId);
  if (radioChannel) {
    const selection = await resolveCurrentStreamPreferences();
    await playChannelById(radioChannel.id, carSafeQuality(selection.quality));
    return;
  }
  const streamSelection = await resolveCurrentStreamPreferences();
  await ensureBrowsableQueue(streamSelection.quality);
  const played = await playTrackById(mediaId);
  if (!played) {
    await playChannelById(mediaId);
  }
}

async function handleCommand(action: string, mediaId: string | null) {
  try {
    switch (action) {
      case 'play':
        await TrackPlayer.play();
        break;
      case 'pause':
        await TrackPlayer.pause();
        break;
      case 'stop':
        await TrackPlayer.stop();
        break;
      case 'next':
        await playAdjacentQueueItem(1);
        break;
      case 'previous':
        await playAdjacentQueueItem(-1);
        break;
      case 'playId':
        if (mediaId) {
          await handlePlayId(mediaId);
        }
        break;
      case 'search': {
        const channel = findChannelByQuery(mediaId ?? '');
        const selection = await resolveCurrentStreamPreferences();
        await playChannelById(channel.id, carSafeQuality(selection.quality));
        break;
      }
    }
  } catch {
    // ignore — car commands must never crash the app
  }
}

async function pushNowPlaying() {
  if (!isAvailable) {
    return;
  }
  try {
    const track = await TrackPlayer.getActiveTrack();
    const {state} = await TrackPlayer.getPlaybackState();
    const channel = RADIO_CHANNELS.find(item => item.id === String(track?.id ?? ''));
    const stationOnly = shouldUseStationOnlyPresentation(channel, (track as any)?.streamQuality);
    CarBridge!.updateNowPlaying(
      stationOnly ? 'RadioTEDU Lo-Fi' : track?.title ?? 'RadioTEDU',
      stationOnly ? '' : (track?.artist as string) ?? '',
      stationOnly
        ? carStationArtwork(channel!.id)
        : channel
          ? carStationArtwork(channel.id)
          : (track?.artwork as string) ?? '',
      state === State.Playing,
    );
  } catch {
    // best-effort
  }
}

let initialized = false;

/** Register car command + now-playing listeners. Call once at startup. */
export function initCarBridge(): void {
  if (!isAvailable || initialized) {
    return;
  }
  initialized = true;

  syncCarLanguagePreference();
  i18n.on('languageChanged', () => {
    syncCarLanguagePreference();
    // Reuse verified channels/podcasts so translated labels reach Media3
    // synchronously, without waiting for another availability network pass.
    writeCachedCarCatalog();
  });

  DeviceEventEmitter.addListener('RadioTeduCarCommand', e => {
    handleCommand(e?.action, e?.mediaId ?? null);
  });

  TrackPlayer.addEventListener(Event.PlaybackState, pushNowPlaying);
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, pushNowPlaying);

  pushCarCatalog().catch(() => undefined);
}
