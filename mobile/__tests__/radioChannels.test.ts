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
} from '../src/data/radioChannels';
import {
  buildRadioQueue,
  buildChannelTrack,
  findChannelByQuery,
} from '../src/services/playbackQueue';
import {buildVoiceActionMap} from '../src/services/androidSystemCapabilities';

describe('radio channel catalog', () => {
  it('adds Spark as rtAI with /spark and FLAC metadata', () => {
    const spark = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-spark');

    expect(spark).toEqual(
      expect.objectContaining({
        name: 'Spark',
        description: 'rtAI - Radio AI Host',
        mountPath: '/spark',
        role: 'ai-host',
        availability: 'live',
        mobileDataWarning: HIGH_QUALITY_MOBILE_DATA_WARNING,
      }),
    );
    expect(spark?.streams.flac).toBe('https://stream.radiotedu.com/spark.flac');
    expect(spark?.codecLabels?.flac).toBe('FLAC');
    expect(getAvailableStreamQualities(spark!)).toContain('flac');
  });

  it('adds Energize and Rock with their recommended normal mounts', () => {
    const energize = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-energize');
    const rock = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-rock');

    expect(energize).toEqual(
      expect.objectContaining({
        name: 'Energize',
        streamUrl: 'https://stream.radiotedu.com/energize-normal',
        legacyStreamUrl: 'https://stream.radiotedu.com/energize',
        mountPath: '/energize',
        availability: 'live',
      }),
    );
    expect(rock).toEqual(
      expect.objectContaining({
        name: 'Rock',
        streamUrl: 'https://stream.radiotedu.com/rock-normal',
        legacyStreamUrl: 'https://stream.radiotedu.com/rock',
        mountPath: '/rock',
        availability: 'live',
        mobileDataWarning: HIGH_QUALITY_MOBILE_DATA_WARNING,
      }),
    );
    expect(rock?.streams.flac).toBe('https://stream.radiotedu.com/rock-flac');
    expect(rock?.codecLabels?.flac).toBe('FLAC');
  });

  it('exposes low, normal, high and FLAC for every public RadioTEDU channel', () => {
    const publicMounts = {
      'radiotedu-main': 'radio',
      'radiotedu-classic': 'classic',
      'radiotedu-jazz': 'cazz',
      'radiotedu-lofi': 'lofi',
      'radiotedu-energize': 'energize',
      'radiotedu-rock': 'rock',
      'radiotedu-en': 'en',
      'radiotedu-fr': 'fr',
    };

    for (const [id, mount] of Object.entries(publicMounts)) {
      const channel = RADIO_CHANNELS.find(item => item.id === id)!;
      expect(getAvailableStreamQualities(channel)).toEqual(
        expect.arrayContaining(['low', 'normal', 'high', 'flac']),
      );
      expect(channel.streamUrl).toBe(
        `https://stream.radiotedu.com/${mount}-normal`,
      );
      expect(channel.legacyStreamUrl).toBe(
        `https://stream.radiotedu.com/${mount}`,
      );
      expect(resolveStreamUrl(channel, 'low')).toBe(
        `https://stream.radiotedu.com/${mount}-low`,
      );
      expect(resolveStreamUrl(channel, 'high')).toBe(
        `https://stream.radiotedu.com/${mount}-high`,
      );
      expect(resolveStreamUrl(channel, 'flac')).toBe(
        `https://stream.radiotedu.com/${mount}-flac`,
      );
    }
  });

  it('falls back from the selected quality to normal and the unchanged legacy mount', () => {
    const english = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-en')!;
    const fallbacks = buildStreamFallbacks(english, 'high');

    expect(fallbacks.map(item => item.url)).toEqual([
      'https://stream.radiotedu.com/en-high',
      'https://stream.radiotedu.com/en-normal',
      'https://stream.radiotedu.com/en',
    ]);
    expect(buildChannelTrack(english, 'flac')).toEqual(
      expect.objectContaining({
        id: 'radiotedu-en',
        url: 'https://stream.radiotedu.com/en-flac',
        streamQuality: 'flac',
      }),
    );
  });

  it('warns only for FLAC over mobile data', () => {
    const main = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-main')!;

    expect(shouldWarnForMobileDataStream(main, 'flac', true)).toBe(true);
    expect(shouldWarnForMobileDataStream(main, 'flac', false)).toBe(false);
    expect(shouldWarnForMobileDataStream(main, 'high', true)).toBe(false);
  });

  it('matches Gemini and assistant-style voice queries to Spark and Rock', () => {
    expect(findChannelByQuery('Hey Gemini, play Spark on RadioTEDU').id).toBe('radiotedu-spark');
    expect(findChannelByQuery('Hey Gemini, play RadioTEDU Rock').id).toBe('radiotedu-rock');
    expect(findChannelByQuery('Play RadioTEDU English').id).toBe('radiotedu-en');
    expect(findChannelByQuery('Play RadioTEDU Français').id).toBe('radiotedu-fr');
    expect(findChannelByQuery('Hey Gemini, Radio TEDU cal').id).toBe('radiotedu-main');
  });

  it('documents voice action media ids for Android readiness', () => {
    expect(buildVoiceActionMap()).toEqual(
      expect.objectContaining({
        'Hey Gemini, play Spark on RadioTEDU': {
          action: 'play-radio',
          mediaId: 'radiotedu-spark',
        },
        'Hey Gemini, play RadioTEDU Rock': {
          action: 'play-radio',
          mediaId: 'radiotedu-rock',
        },
      }),
    );
  });

  it('keeps live Spark and Rock playable even when stream checks fail', () => {
    const main = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-main')!;
    const spark = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-spark')!;
    const rock = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-rock')!;

    expect(isChannelPlayable(spark)).toBe(true);
    expect(isChannelPlayable(rock)).toBe(true);

    expect(
      buildVisibleChannels([
        {channel: main, isAvailable: true},
        {channel: spark, isAvailable: false},
        {channel: rock, isAvailable: false},
      ]).map(channel => channel.id),
    ).toEqual(['radiotedu-main']);
  });

  it('includes Spark and Rock in the playable TrackPlayer queue', () => {
    const queue = buildRadioQueue('high');

    expect(queue.map(track => track.id)).toContain('radiotedu-main');
    expect(queue.map(track => track.id)).toContain('radiotedu-spark');
    expect(queue.map(track => track.id)).toContain('radiotedu-energize');
    expect(queue.map(track => track.id)).toContain('radiotedu-rock');
    expect(queue.map(track => track.id)).toContain('radiotedu-en');
    expect(queue.map(track => track.id)).toContain('radiotedu-fr');
  });
});
