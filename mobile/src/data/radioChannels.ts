// Each channel exposes two images:
//   logo    - wide banner used inside the app UI
//   artwork - image used for lock screen, notification and Android Auto /
//             CarPlay. Car systems center-CROP this to a square, so a true
//             square export (>=512x512) looks best. The URLs below are the real
//             RadioTEDU brand images (landscape ~2560x1551) and will be
//             center-cropped in the car until square versions are provided.
const MAIN_LOGO =
  'https://radiotedu.com/wp-content/uploads/2025/07/logo-02-scaled.png';
const JAZZ_LOGO =
  'https://radiotedu.com/wp-content/uploads/2025/07/tedu_jazz-scaled.png';
const LOFI_LOGO =
  'https://radiotedu.com/wp-content/uploads/2025/07/tedu_lofi-scaled.png';

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
  streamUrl: string;
  legacyStreamUrl: string;
  mountPath: string;
  streams: Partial<Record<StreamQuality, string>>;
  codecLabels?: Partial<Record<StreamQuality, string>>;
  icon: string;
  color: string;
  logo: string;
  artwork: string;
  role?: 'main' | 'music' | 'ai-host';
  availability?: RadioChannelAvailability;
  mobileDataWarning?: string;
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
  return `${STREAM_ORIGIN}/${mount}-${quality}`;
}

function buildQualityStreams(mountPath: string): Record<StreamQuality, string> {
  return {
    low: buildStreamUrl(mountPath, 'low'),
    normal: buildStreamUrl(mountPath, 'normal'),
    high: buildStreamUrl(mountPath, 'high'),
    flac: buildStreamUrl(mountPath, 'flac'),
  };
}

const STANDARD_CODEC_LABELS: Record<StreamQuality, string> = {
  low: 'AAC',
  normal: 'AAC',
  high: 'AAC',
  flac: 'FLAC',
};

export const RADIO_CHANNELS: RadioChannel[] = [
  {
    id: 'radiotedu-main',
    name: 'RadioTEDU',
    description: 'Ana Kanal',
    streamUrl: 'https://stream.radiotedu.com/radio-normal',
    legacyStreamUrl: 'https://stream.radiotedu.com/radio',
    mountPath: '/radio',
    streams: buildQualityStreams('/radio'),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'radio-tower',
    color: '#E31E24',
    logo: MAIN_LOGO,
    artwork: MAIN_LOGO,
    role: 'main',
    availability: 'live',
    mobileDataWarning: HIGH_QUALITY_MOBILE_DATA_WARNING,
  },
  {
    id: 'radiotedu-classic',
    name: 'Classic',
    description: 'Klasik Muzik',
    streamUrl: 'https://stream.radiotedu.com/classic-normal',
    legacyStreamUrl: 'https://stream.radiotedu.com/classic',
    mountPath: '/classic',
    streams: buildQualityStreams('/classic'),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'music-clef-treble',
    color: '#E5A000',
    // TODO: no Classic-specific asset provided yet - falls back to main logo.
    logo: MAIN_LOGO,
    artwork: MAIN_LOGO,
    role: 'music',
    availability: 'live',
    mobileDataWarning: HIGH_QUALITY_MOBILE_DATA_WARNING,
  },
  {
    id: 'radiotedu-jazz',
    name: 'Jazz',
    description: 'Caz Muzik',
    streamUrl: 'https://stream.radiotedu.com/cazz-normal',
    legacyStreamUrl: 'https://stream.radiotedu.com/cazz',
    mountPath: '/cazz',
    streams: buildQualityStreams('/cazz'),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'saxophone',
    color: '#9C27B0',
    logo: JAZZ_LOGO,
    artwork: JAZZ_LOGO,
    role: 'music',
    availability: 'live',
    mobileDataWarning: HIGH_QUALITY_MOBILE_DATA_WARNING,
  },
  {
    id: 'radiotedu-lofi',
    name: 'Lo-Fi',
    description: 'Lo-Fi Beats',
    streamUrl: 'https://stream.radiotedu.com/lofi-normal',
    legacyStreamUrl: 'https://stream.radiotedu.com/lofi',
    mountPath: '/lofi',
    streams: buildQualityStreams('/lofi'),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'headphones',
    color: '#00BCD4',
    logo: LOFI_LOGO,
    artwork: LOFI_LOGO,
    role: 'music',
    availability: 'live',
    mobileDataWarning: HIGH_QUALITY_MOBILE_DATA_WARNING,
  },
  {
    id: 'radiotedu-energize',
    name: 'Energize',
    description: 'High Energy',
    streamUrl: 'https://stream.radiotedu.com/energize-normal',
    legacyStreamUrl: 'https://stream.radiotedu.com/energize',
    mountPath: '/energize',
    streams: buildQualityStreams('/energize'),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'lightning-bolt',
    color: '#F36F21',
    logo: MAIN_LOGO,
    artwork: MAIN_LOGO,
    role: 'music',
    availability: 'live',
    mobileDataWarning: HIGH_QUALITY_MOBILE_DATA_WARNING,
  },
  {
    id: 'radiotedu-spark',
    name: 'Spark',
    description: 'rtAI - Radio AI Host',
    streamUrl: 'https://stream.radiotedu.com/spark',
    legacyStreamUrl: 'https://stream.radiotedu.com/spark',
    mountPath: '/spark',
    streams: {
      low: 'https://stream.radiotedu.com/spark?q=low',
      normal: 'https://stream.radiotedu.com/spark',
      high: 'https://stream.radiotedu.com/spark?q=high',
      flac: 'https://stream.radiotedu.com/spark.flac',
    },
    codecLabels: {
      low: 'AAC',
      normal: 'AAC',
      high: 'AAC',
      flac: 'FLAC',
    },
    icon: 'creation',
    color: '#20D6C7',
    logo: MAIN_LOGO,
    artwork: MAIN_LOGO,
    role: 'ai-host',
    availability: 'live',
    mobileDataWarning: HIGH_QUALITY_MOBILE_DATA_WARNING,
  },
  {
    id: 'radiotedu-rock',
    name: 'Rock',
    description: 'Rock',
    streamUrl: 'https://stream.radiotedu.com/rock-normal',
    legacyStreamUrl: 'https://stream.radiotedu.com/rock',
    mountPath: '/rock',
    streams: buildQualityStreams('/rock'),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'guitar-electric',
    color: '#FF6B2C',
    logo: MAIN_LOGO,
    artwork: MAIN_LOGO,
    role: 'music',
    availability: 'live',
    mobileDataWarning: HIGH_QUALITY_MOBILE_DATA_WARNING,
  },
  {
    id: 'radiotedu-en',
    name: 'RadioTEDU English',
    description: 'English Broadcast',
    streamUrl: 'https://stream.radiotedu.com/en-normal',
    legacyStreamUrl: 'https://stream.radiotedu.com/en',
    mountPath: '/en',
    streams: buildQualityStreams('/en'),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'translate',
    color: '#3578E5',
    logo: MAIN_LOGO,
    artwork: MAIN_LOGO,
    role: 'music',
    availability: 'live',
    mobileDataWarning: HIGH_QUALITY_MOBILE_DATA_WARNING,
  },
  {
    id: 'radiotedu-fr',
    name: 'RadioTEDU Français',
    description: 'Diffusion française',
    streamUrl: 'https://stream.radiotedu.com/fr-normal',
    legacyStreamUrl: 'https://stream.radiotedu.com/fr',
    mountPath: '/fr',
    streams: buildQualityStreams('/fr'),
    codecLabels: STANDARD_CODEC_LABELS,
    icon: 'translate',
    color: '#6C63D9',
    logo: MAIN_LOGO,
    artwork: MAIN_LOGO,
    role: 'music',
    availability: 'live',
    mobileDataWarning: HIGH_QUALITY_MOBILE_DATA_WARNING,
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

  candidates.push(
    {
      url: resolveStreamUrl(channel, 'normal'),
      quality: 'normal',
      isLegacy: false,
    },
    {
      url: channel.legacyStreamUrl,
      quality: 'normal',
      isLegacy: true,
    },
  );

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
  return checks
    .filter(({channel, isAvailable}) => isAvailable || !isChannelPlayable(channel))
    .map(({channel}) => channel);
}
