import {describe, expect, it, jest} from '@jest/globals';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getQueue: jest.fn(async () => []),
    reset: jest.fn(async () => undefined),
    add: jest.fn(async () => undefined),
    skip: jest.fn(async () => undefined),
    play: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({type: 'wifi', isConnected: true})),
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

import {
  buildVisibleChannels,
  buildStreamFallbacks,
  getAvailableStreamQualities,
  HIGH_QUALITY_MOBILE_DATA_WARNING,
  isChannelPlayable,
  RADIO_CHANNELS,
  resolveStreamUrl,
  shouldWarnForMobileDataStream,
  shouldUseStationOnlyPresentation,
  setRuntimeVisibleChannels,
} from '../src/data/radioChannels';
import {
  buildRadioQueue,
  buildChannelTrack,
  findChannelByQuery,
} from '../src/services/playbackQueue';
import {buildVoiceActionMap} from '../src/services/androidSystemCapabilities';

describe('radio channel catalog', () => {
  it('requires a successful live check for intermittent mounts', () => {
    expect(RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-spark')).toEqual(
      expect.objectContaining({requiresLiveCheck: true}),
    );
    expect(RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-en')?.requiresLiveCheck).toBe(true);
    expect(RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-fr')?.requiresLiveCheck).toBe(true);

    const spark = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-spark')!;
    expect(buildVisibleChannels([{channel: spark, isAvailable: false}])).toEqual([]);
    expect(buildVisibleChannels([{channel: spark, isAvailable: true}])).toEqual([
      spark,
    ]);
    expect(spark.streams.low).toBeUndefined();
  });

  it('adds Energize and Rock with their recommended normal mounts (no suffix)', () => {
    const energize = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-energize');
    const rock = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-rock');

    expect(energize).toEqual(
      expect.objectContaining({
        name: 'Energize',
        streamUrl: 'https://stream.radiotedu.com/energize',
        legacyStreamUrl: 'https://stream.radiotedu.com/energize',
        mountPath: '/energize',
        availability: 'live',
      }),
    );
    expect(rock).toEqual(
      expect.objectContaining({
        name: 'Rock',
        streamUrl: 'https://stream.radiotedu.com/rock',
        legacyStreamUrl: 'https://stream.radiotedu.com/rock',
        mountPath: '/rock',
        availability: 'live',
      }),
    );
    expect(rock?.streams.flac).toBeUndefined();
  });

  it('exposes low (HE-AAC v2) and normal (AAC-LC) mounts for public music channels and MP3 192 for AI channels', () => {
    const publicMounts = {
      'radiotedu-main': 'radio',
      'radiotedu-classic': 'classic',
      'radiotedu-jazz': 'cazz',
      'radiotedu-lofi': 'lofi',
      'radiotedu-energize': 'energize',
      'radiotedu-rock': 'rock',
    };

    for (const [id, mount] of Object.entries(publicMounts)) {
      const channel = RADIO_CHANNELS.find(item => item.id === id)!;
      expect(getAvailableStreamQualities(channel)).toEqual(
        expect.arrayContaining(['low', 'normal']),
      );
      // Normal stream has NO suffix
      expect(channel.streamUrl).toBe(
        `https://stream.radiotedu.com/${mount}`,
      );
      expect(channel.legacyStreamUrl).toBe(
        `https://stream.radiotedu.com/${mount}`,
      );
      expect(resolveStreamUrl(channel, 'low')).toBe(
        `https://stream.radiotedu.com/${mount}-low`,
      );
      expect(resolveStreamUrl(channel, 'normal')).toBe(
        `https://stream.radiotedu.com/${mount}`,
      );
      expect(channel.codecLabels?.low).toBe('HE-AAC v2');
      expect(channel.codecLabels?.normal).toBe('AAC-LC');
    }

    const en = RADIO_CHANNELS.find(c => c.id === 'radiotedu-en')!;
    const fr = RADIO_CHANNELS.find(c => c.id === 'radiotedu-fr')!;
    expect(en.streamUrl).toBe('https://stream.radiotedu.com/en');
    expect(en.codecLabels?.normal).toBe('MP3 192');
    expect(fr.streamUrl).toBe('https://stream.radiotedu.com/fr');
    expect(fr.codecLabels?.normal).toBe('MP3 192');
  });

  it('offers FLAC only on Classic and Jazz', () => {
    const flacChannels = RADIO_CHANNELS.filter(channel => channel.streams.flac);
    expect(flacChannels.map(channel => channel.id)).toEqual([
      'radiotedu-classic',
      'radiotedu-jazz',
    ]);
    expect(flacChannels.map(channel => channel.streams.flac)).toEqual([
      'https://stream.radiotedu.com/classic-flac',
      'https://stream.radiotedu.com/cazz-flac',
    ]);
    expect(flacChannels.every(channel => channel.mobileDataWarning === HIGH_QUALITY_MOBILE_DATA_WARNING)).toBe(true);
  });

  it('bundles upscaled station logos and keeps remote artwork for media surfaces', () => {
    const main = RADIO_CHANNELS.find(c => c.id === 'radiotedu-main')!;
    const jazz = RADIO_CHANNELS.find(c => c.id === 'radiotedu-jazz')!;
    const lofi = RADIO_CHANNELS.find(c => c.id === 'radiotedu-lofi')!;

    expect(main.logo).toBeTruthy();
    expect(jazz.logo).toBeTruthy();
    expect(lofi.logo).toBeTruthy();
    expect(main.artwork).toBe(
      'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu.png',
    );
    expect(jazz.artwork).toBe(
      'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu-jazz.png',
    );
    expect(lofi.artwork).toBe(
      'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu-lo-fi.png',
    );
  });

  it('keeps Lo-Fi low and normal presentation to the station logo and name only', () => {
    const lofi = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-lofi')!;

    expect(lofi.name).toBe('Lo-Fi');
    expect(lofi.stationOnlyMetadata).toBe(true);
    expect(shouldUseStationOnlyPresentation(lofi, 'low')).toBe(true);
    expect(shouldUseStationOnlyPresentation(lofi, 'normal')).toBe(true);
    expect(shouldUseStationOnlyPresentation(lofi, undefined)).toBe(true);
    expect(shouldUseStationOnlyPresentation(lofi, 'flac')).toBe(false);
    expect(buildChannelTrack(lofi, 'low')).toEqual(
      expect.objectContaining({
        title: 'Lo-Fi',
        artist: '',
        artwork: expect.anything(),
        streamQuality: 'low',
      }),
    );
    expect(buildChannelTrack(lofi, 'normal')).toEqual(
      expect.objectContaining({
        title: 'Lo-Fi',
        artist: '',
        artwork: expect.anything(),
        streamQuality: 'normal',
      }),
    );
  });

  it('falls back from the selected quality to normal, low, and the legacy mount', () => {
    const jazz = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-jazz')!;
    const fallbacks = buildStreamFallbacks(jazz, 'flac');

    expect(fallbacks.map(item => item.url)).toEqual([
      'https://stream.radiotedu.com/cazz-flac',
      'https://stream.radiotedu.com/cazz',
      'https://stream.radiotedu.com/cazz-low',
    ]);
    expect(buildChannelTrack(jazz, 'flac')).toEqual(
      expect.objectContaining({
        id: 'radiotedu-jazz',
        url: 'https://stream.radiotedu.com/cazz-flac',
        streamQuality: 'flac',
      }),
    );
  });

  it('warns only for FLAC over mobile data', () => {
    const jazz = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-jazz')!;
    const main = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-main')!;

    expect(shouldWarnForMobileDataStream(jazz, 'flac', true)).toBe(true);
    expect(shouldWarnForMobileDataStream(jazz, 'flac', false)).toBe(false);
    expect(shouldWarnForMobileDataStream(main, 'flac', true)).toBe(false);
  });

  it('matches Gemini and assistant-style voice queries to available stations', () => {
    setRuntimeVisibleChannels(RADIO_CHANNELS);
    expect(findChannelByQuery('Hey Gemini, play RadioTEDU Rock').id).toBe('radiotedu-rock');
    expect(findChannelByQuery('Hey Gemini, Radio TEDU cal').id).toBe('radiotedu-main');
    expect(findChannelByQuery('Play RadioTEDU English').id).toBe('radiotedu-en');
    expect(findChannelByQuery('Play RadioTEDU Français').id).toBe('radiotedu-fr');

    expect(findChannelByQuery('Hey Gemini, play RadioTEDU Voting').id).toBe('radiotedu-spark');
    setRuntimeVisibleChannels(
      RADIO_CHANNELS.filter(channel => !channel.requiresLiveCheck),
    );
  });

  it('documents voice action media ids for Android readiness', () => {
    expect(buildVoiceActionMap()).toEqual(
      expect.objectContaining({
        'Hey Gemini, play RadioTEDU Rock': {
          action: 'play-radio',
          mediaId: 'radiotedu-rock',
        },
      }),
    );
  });

  it('keeps only verified stations visible when stream checks fail', () => {
    const main = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-main')!;
    const rock = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-rock')!;

    expect(isChannelPlayable(rock)).toBe(true);

    expect(
      buildVisibleChannels([
        {channel: main, isAvailable: true},
        {channel: rock, isAvailable: false},
      ]).map(channel => channel.id),
    ).toEqual(['radiotedu-main']);
  });

  it('includes only runtime-visible stations in the playable TrackPlayer queue', () => {
    const stableQueue = buildRadioQueue('high');

    expect(stableQueue.map(track => track.id)).toContain('radiotedu-main');
    expect(stableQueue.map(track => track.id)).toContain('radiotedu-energize');
    expect(stableQueue.map(track => track.id)).toContain('radiotedu-rock');
    expect(stableQueue.map(track => track.id)).not.toContain('radiotedu-en');
    expect(stableQueue.map(track => track.id)).not.toContain('radiotedu-fr');
    expect(stableQueue.map(track => track.id)).not.toContain('radiotedu-spark');

    setRuntimeVisibleChannels(RADIO_CHANNELS);
    const liveQueue = buildRadioQueue('high');
    expect(liveQueue.map(track => track.id)).toEqual(
      expect.arrayContaining(['radiotedu-en', 'radiotedu-fr', 'radiotedu-spark']),
    );
    setRuntimeVisibleChannels(
      RADIO_CHANNELS.filter(channel => !channel.requiresLiveCheck),
    );
  });
});
