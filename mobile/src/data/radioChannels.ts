import type {ImageSourcePropType} from 'react-native';

// Bundled, upscaled copies of the official artwork from /radyolar keep station
// branding sharp and available offline. Remote URLs remain for system media
// artwork because TrackPlayer and car surfaces require URI-backed images.
const MAIN_LOGO = require('../assets/images/stations/radiotedu-square-superres.png');
const CLASSIC_LOGO = require('../assets/images/stations/radiotedu-classic-square-superres.png');
const JAZZ_LOGO = require('../assets/images/stations/radiotedu-jazz-square-superres.png');
const LOFI_LOGO = require('../assets/images/stations/radiotedu-lo-fi-square-superres.png');
const ENERGIZE_LOGO = require('../assets/images/stations/radiotedu-energize-square-superres.png');
const ROCK_LOGO = require('../assets/images/stations/radiotedu-rock-square-superres.png');
const AI_EN_LOGO = require('../assets/images/stations/radiotedu-ai-english-square-superres.png');
const AI_FR_LOGO = require('../assets/images/stations/radiotedu-ai-francais-square-superres.png');

const MAIN_ARTWORK =
  'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu.png';
const CLASSIC_ARTWORK =
  'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu-classic.png';
const JAZZ_ARTWORK =
  'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu-jazz.png';
const LOFI_ARTWORK =
  'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu-lo-fi.png';
const ENERGIZE_ARTWORK =
  'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu-energize.png';
const ROCK_ARTWORK =
  'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu-rock.png';
const AI_EN_ARTWORK =
  'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu-ai-english.png';
const AI_FR_ARTWORK =
  'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu-ai-francais.png';

const STREAM_ORIGIN = 'https://stream.radiotedu.com';

export type StreamQuality = 'low' | 'normal' | 'high' | 'flac';

export const STREAM_QUALITIES: StreamQuality[] = [
  'low',
  'normal',
  'high',
  'flac',
];
export type RadioChannelAvailability = 'live' | 'coming-soon';

export interface RadioChannel {
  id: string;
  name: string;
  description: string;
  copyKey?: string;
  streamUrl: string;
  legacyStreamUrl: string;
  mountPath: string;
  streams: Partial<Record<StreamQuality, string>>;
  codecLabels?: Partial<Record<StreamQuality, string>>;
  icon: string;
  color: string;
  logo: ImageSourcePropType;
  artwork: string;
  role?: 'main' | 'music' | 'ai-host';
  availability?: RadioChannelAvailability;
  /** Hide until a live mount check succeeds; used for intermittently launched stations. */
  requiresLiveCheck?: boolean;
  mobileDataWarning?: string;
  /** Low/normal streams expose the station logo and name, not song metadata. */
  stationOnlyMetadata?: boolean;
  /** @deprecated Kept for persisted/older integrations; use stationOnlyMetadata. */
  suppressArtworkAndMetadata?: boolean;
}

export interface RadioChannelCheck {
  channel: RadioChannel;
  isAvailable: boolean;
}

export const HIGH_QUALITY_MOBILE_DATA_WARNING =
  'FLAC uses considerably more mobile data. Continue only if your data plan is suitable.';

function mountName(mountPath: string): string {
  return mountPath.replace(/^\/+/, '');
}

export function buildStreamUrl(
  mountPath: string,
  quality: StreamQuality,
): string {
  const mount = mountName(mountPath);
  if (quality === 'low') {
    return `${STREAM_ORIGIN}/${mount}-low`;
  }
  if (quality === 'flac') {
    return `${STREAM_ORIGIN}/${mount}-flac`;
  }
  // Normal stream (192 kbps) has NO suffix (e.g. /radio, /lofi, /cazz, etc.)
  return `${STREAM_ORIGIN}/${mount}`;
}

function buildQualityStreams(
  mountPath: string,
  hasFlac = false,
): Partial<Record<StreamQuality, string>> {
  return {
    low: buildStreamUrl(mountPath, 'low'),
    normal: buildStreamUrl(mountPath, 'normal'),
    high: buildStreamUrl(mountPath, 'normal'),
    ...(hasFlac ? {flac: buildStreamUrl(mountPath, 'flac')} : {}),
  };
}

export function isStationOnlyChannel(channel: RadioChannel | undefined): boolean {
  return Boolean(channel?.stationOnlyMetadata || channel?.suppressArtworkAndMetadata);
}

export function shouldUseStationOnlyPresentation(
  channel: RadioChannel | undefined,
  quality: StreamQuality | undefined,
): boolean {
  // A missing quality is an older/partially hydrated track; Lo-Fi's only
  // public qualities are low and normal, so keep the station-only treatment.
  return Boolean(isStationOnlyChannel(channel) && quality !== 'flac');
}

/** @deprecated Use shouldUseStationOnlyPresentation. */
export const shouldSuppressArtworkAndMetadata = shouldUseStationOnlyPresentation;

const STANDARD_CODEC_LABELS: Record<StreamQuality, string> = {
  low: 'HE-AAC v2',
  normal: 'AAC-LC',
  high: 'AAC-LC',
  flac: 'FLAC',
};

export const RADIO_CHANNELS: RadioChannel[] = [
  {
    id: 'radiotedu-main',
    name: 'RadioTEDU',
    description: 'Ana Kanal',
    copyKey: 'main',
    streamUrl: 'https://stream.radiotedu.com/radio',
    legacyStreamUrl: 'https://stream.radiotedu.com/radio',
    mountPath: '/radio',
    streams: buildQualityStreams('/radio'),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'radio-tower',
    color: '#E31E24',
    logo: MAIN_LOGO,
    artwork: MAIN_ARTWORK,
    role: 'main',
    availability: 'live',
  },
  {
    id: 'radiotedu-classic',
    name: 'Classical',
    description: 'Klasik Muzik',
    copyKey: 'classic',
    streamUrl: 'https://stream.radiotedu.com/classic',
    legacyStreamUrl: 'https://stream.radiotedu.com/classic',
    mountPath: '/classic',
    streams: buildQualityStreams('/classic', true),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'music-clef-treble',
    color: '#E5A000',
    logo: CLASSIC_LOGO,
    artwork: CLASSIC_ARTWORK,
    role: 'music',
    availability: 'live',
    mobileDataWarning: HIGH_QUALITY_MOBILE_DATA_WARNING,
  },
  {
    id: 'radiotedu-jazz',
    name: 'Jazz',
    description: 'Caz Muzik',
    copyKey: 'jazz',
    streamUrl: 'https://stream.radiotedu.com/cazz',
    legacyStreamUrl: 'https://stream.radiotedu.com/cazz',
    mountPath: '/cazz',
    streams: buildQualityStreams('/cazz', true),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'saxophone',
    color: '#9C27B0',
    logo: JAZZ_LOGO,
    artwork: JAZZ_ARTWORK,
    role: 'music',
    availability: 'live',
    mobileDataWarning: HIGH_QUALITY_MOBILE_DATA_WARNING,
  },
  {
    id: 'radiotedu-lofi',
    name: 'Lo-Fi',
    description: 'Lo-Fi Beats',
    copyKey: 'lofi',
    streamUrl: 'https://stream.radiotedu.com/lofi',
    legacyStreamUrl: 'https://stream.radiotedu.com/lofi',
    mountPath: '/lofi',
    streams: buildQualityStreams('/lofi'),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'headphones',
    color: '#00BCD4',
    logo: LOFI_LOGO,
    artwork: LOFI_ARTWORK,
    role: 'music',
    availability: 'live',
    stationOnlyMetadata: true,
    suppressArtworkAndMetadata: true,
  },
  {
    id: 'radiotedu-energize',
    name: 'Energize',
    description: 'High Energy',
    copyKey: 'energize',
    streamUrl: 'https://stream.radiotedu.com/energize',
    legacyStreamUrl: 'https://stream.radiotedu.com/energize',
    mountPath: '/energize',
    streams: buildQualityStreams('/energize'),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'lightning-bolt',
    color: '#F36F21',
    logo: ENERGIZE_LOGO,
    artwork: ENERGIZE_ARTWORK,
    role: 'music',
    availability: 'live',
  },
  {
    id: 'radiotedu-rock',
    name: 'Rock',
    description: 'Rock',
    copyKey: 'rock',
    streamUrl: 'https://stream.radiotedu.com/rock',
    legacyStreamUrl: 'https://stream.radiotedu.com/rock',
    mountPath: '/rock',
    streams: buildQualityStreams('/rock'),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'guitar-electric',
    color: '#FF6B2C',
    logo: ROCK_LOGO,
    artwork: ROCK_ARTWORK,
    role: 'music',
    availability: 'live',
  },
  {
    id: 'radiotedu-en',
    name: 'English',
    description: 'English Broadcast',
    copyKey: 'english',
    streamUrl: 'https://stream.radiotedu.com/en',
    legacyStreamUrl: 'https://stream.radiotedu.com/en',
    mountPath: '/en',
    streams: {
      normal: 'https://stream.radiotedu.com/en',
      high: 'https://stream.radiotedu.com/en',
    },
    codecLabels: {
      normal: 'MP3 192',
      high: 'MP3 192',
    },
    icon: 'translate',
    color: '#3578E5',
    logo: AI_EN_LOGO,
    artwork: AI_EN_ARTWORK,
    role: 'ai-host',
    availability: 'live',
    requiresLiveCheck: true,
  },
  {
    id: 'radiotedu-fr',
    name: 'Français',
    description: 'Diffusion française',
    copyKey: 'french',
    streamUrl: 'https://stream.radiotedu.com/fr',
    legacyStreamUrl: 'https://stream.radiotedu.com/fr',
    mountPath: '/fr',
    streams: {
      normal: 'https://stream.radiotedu.com/fr',
      high: 'https://stream.radiotedu.com/fr',
    },
    codecLabels: {
      normal: 'MP3 192',
      high: 'MP3 192',
    },
    icon: 'translate',
    color: '#6C63D9',
    logo: AI_FR_LOGO,
    artwork: AI_FR_ARTWORK,
    role: 'ai-host',
    availability: 'live',
    requiresLiveCheck: true,
  },
  {
    id: 'radiotedu-spark',
    name: 'Voting',
    description: 'Interactive voting radio',
    copyKey: 'spark',
    streamUrl: 'https://stream.radiotedu.com/spark',
    legacyStreamUrl: 'https://stream.radiotedu.com/spark',
    mountPath: '/spark',
    // Voting currently publishes one Ogg mount at the legacy /spark path.
    streams: {
      normal: 'https://stream.radiotedu.com/spark',
      high: 'https://stream.radiotedu.com/spark',
    },
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'creation',
    color: '#20D6C7',
    logo: MAIN_LOGO,
    artwork: MAIN_ARTWORK,
    role: 'music',
    availability: 'live',
    requiresLiveCheck: true,
  },
];

export function getAvailableStreamQualities(
  channel: RadioChannel,
): StreamQuality[] {
  return (['normal', 'high', 'low', 'flac'] as StreamQuality[]).filter(
    quality => Boolean(channel.streams[quality]),
  );
}

export function resolveStreamQuality(
  channel: RadioChannel,
  preferred: StreamQuality,
): StreamQuality {
  if (channel.streams[preferred]) {
    return preferred;
  }
  return getAvailableStreamQualities(channel)[0] ?? 'normal';
}

export function resolveStreamUrl(
  channel: RadioChannel,
  quality: StreamQuality,
): string {
  const resolvedQuality = resolveStreamQuality(channel, quality);
  return channel.streams[resolvedQuality] || channel.streamUrl;
}

export type StreamFallback = {
  url: string;
  quality: StreamQuality;
  isLegacy: boolean;
};

export function buildStreamFallbacks(
  channel: RadioChannel,
  quality: StreamQuality,
): StreamFallback[] {
  const resolvedQuality = resolveStreamQuality(channel, quality);
  const candidates: StreamFallback[] = [
    {
      url: resolveStreamUrl(channel, resolvedQuality),
      quality: resolvedQuality,
      isLegacy: false,
    },
  ];

  if (resolvedQuality !== 'normal') {
    candidates.push({
      url: resolveStreamUrl(channel, 'normal'),
      quality: 'normal',
      isLegacy: false,
    });
  }

  candidates.push({
    url: resolveStreamUrl(channel, 'low'),
    quality: 'low',
    isLegacy: false,
  });

  candidates.push({
    url: channel.legacyStreamUrl,
    quality: 'normal',
    isLegacy: true,
  });

  return candidates.filter(
    (candidate, index, all) =>
      candidate.url.length > 0 &&
      all.findIndex(item => item.url === candidate.url) === index,
  );
}

export function shouldWarnForMobileDataStream(
  channel: RadioChannel,
  quality: StreamQuality,
  isMobileData: boolean,
): boolean {
  return Boolean(isMobileData && quality === 'flac' && channel.mobileDataWarning);
}

export function isChannelPlayable(channel: RadioChannel): boolean {
  return channel.availability !== 'coming-soon';
}

export function buildVisibleChannels(
  checks: RadioChannelCheck[],
): RadioChannel[] {
  return checks.filter(({isAvailable}) => isAvailable).map(({channel}) => channel);
}

/** Safe initial/error fallback: stable stations only, never dead conditional mounts. */
export function channelsVisibleWithoutLiveCheck(): RadioChannel[] {
  return RADIO_CHANNELS.filter(channel => !channel.requiresLiveCheck);
}

let runtimeVisibleChannels = channelsVisibleWithoutLiveCheck();

export function setRuntimeVisibleChannels(channels: RadioChannel[]): void {
  runtimeVisibleChannels = channels.length
    ? channels
    : channelsVisibleWithoutLiveCheck();
}

export function getRuntimeVisibleChannels(): RadioChannel[] {
  return runtimeVisibleChannels;
}
