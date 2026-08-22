import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {Alert} from 'react-native';
import TrackPlayer from 'react-native-track-player';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {playChannelById} from '../src/services/playbackQueue';
import {resetStreamPreferencesCacheForTests} from '../src/services/streamPreferences';

jest.mock('react-native', () => ({
  Alert: {alert: jest.fn()},
}));

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  State: {
    Playing: 'playing',
    Buffering: 'buffering',
    Loading: 'loading',
    Ready: 'ready',
    None: 'none',
  },
  default: {
    getQueue: jest.fn(async () => []),
    getActiveTrack: jest.fn(async () => undefined),
    getPlaybackState: jest.fn(async () => ({state: 'none'})),
    reset: jest.fn(async () => undefined),
    add: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
    skip: jest.fn(async () => undefined),
    play: jest.fn(async () => undefined),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('FLAC cellular playback protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStreamPreferencesCacheForTests();
    (AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>)
      .mockResolvedValue(null);
    (NetInfo.fetch as jest.MockedFunction<typeof NetInfo.fetch>)
      .mockResolvedValue({type: 'cellular', isConnected: true} as never);
  });

  it('warns and respects cancellation before starting a FLAC stream', async () => {
    (Alert.alert as jest.MockedFunction<typeof Alert.alert>).mockImplementation(
      (_title, _message, buttons) => {
        buttons?.[0]?.onPress?.();
      },
    );

    await expect(
      playChannelById('radiotedu-jazz', 'flac'),
    ).resolves.toEqual({
      played: false,
      cancelled: true,
      quality: 'flac',
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'FLAC over mobile data',
      expect.stringContaining('mobile data'),
      expect.any(Array),
      expect.objectContaining({cancelable: true}),
    );
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  it('triggers 5-second watchdog fallback to low quality when normal connection stalls', async () => {
    jest.useFakeTimers();
    (AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>)
      .mockResolvedValue(JSON.stringify({quality: 'normal'}));
    (NetInfo.fetch as jest.MockedFunction<typeof NetInfo.fetch>)
      .mockResolvedValue({type: 'wifi', isConnected: true} as never);

    (TrackPlayer.getQueue as jest.MockedFunction<typeof TrackPlayer.getQueue>)
      .mockResolvedValue([{id: 'radiotedu-main', url: 'https://stream.radiotedu.com/radio'}] as any);
    (TrackPlayer.getPlaybackState as any) = jest.fn(async () => ({state: 'buffering'}));
    (TrackPlayer.getActiveTrack as any) = jest.fn(async () => ({id: 'radiotedu-main', url: 'https://stream.radiotedu.com/radio'}));

    await playChannelById('radiotedu-main', 'normal');
    expect(TrackPlayer.play).toHaveBeenCalled();

    // Advance 5 seconds asynchronously so the fallback promise resolves
    await jest.advanceTimersByTimeAsync(5000);

    expect(TrackPlayer.remove).toHaveBeenCalled();
    expect(TrackPlayer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'radiotedu-main',
        url: 'https://stream.radiotedu.com/radio-low',
        streamQuality: 'low',
      }),
      0,
    );

    jest.useRealTimers();
  });
});
