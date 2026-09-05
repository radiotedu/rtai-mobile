import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import NetInfo from '@react-native-community/netinfo';
import TrackPlayer, {State} from 'react-native-track-player';
import {
  markPlaybackPaused,
  markPlaybackRequested,
  markPlaybackStopped,
  resetPlaybackIntentForTests,
} from '../src/services/playbackIntent';
import {
  recoverRadioAfterNetworkReturn,
  startNetworkPlaybackRecovery,
} from '../src/services/networkPlaybackRecovery';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {addEventListener: jest.fn(() => jest.fn())},
}));
jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getActiveTrack: jest.fn(), getPlaybackState: jest.fn(),
    load: jest.fn(), play: jest.fn(), pause: jest.fn(),
  },
  State: {Error: 'error', Buffering: 'buffering', Loading: 'loading', Playing: 'playing', Paused: 'paused'},
}));
jest.mock('../src/data/radioChannels', () => ({
  RADIO_CHANNELS: [{id: 'radiotedu-classic'}],
  resolveStreamQuality: () => 'low',
}));
jest.mock('../src/services/playbackQueue', () => ({
  buildChannelTrack: (channel: {id: string}, quality: string) => ({
    id: channel.id, url: `https://example.test/classic-${quality}`, streamQuality: quality,
  }),
  startConnectionWatchdog: jest.fn(),
}));
jest.mock('../src/utils/safeLog', () => ({logSafeError: jest.fn()}));

const track = {id: 'radiotedu-classic', url: 'https://example.test/classic-low'};
const activeTrack = jest.mocked(TrackPlayer.getActiveTrack);
const playbackState = jest.mocked(TrackPlayer.getPlaybackState);

describe('radio recovery when internet returns', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(NetInfo.addEventListener).mockReturnValue(jest.fn());
    activeTrack.mockResolvedValue(track);
    playbackState.mockResolvedValue({state: State.Error, error: {code: 'network', message: 'Offline'}});
    resetPlaybackIntentForTests();
    markPlaybackRequested();
  });

  it('reopens the same low stream after offline fallback exhaustion', async () => {
    expect(await recoverRadioAfterNetworkReturn()).toBe(true);
    expect(TrackPlayer.load).toHaveBeenCalledWith({...track, streamQuality: 'low'});
    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
  });

  it.each([markPlaybackPaused, markPlaybackStopped])('respects explicit pause/stop', async mark => {
    mark();
    expect(await recoverRadioAfterNetworkReturn()).toBe(false);
    expect(TrackPlayer.load).not.toHaveBeenCalled();
  });

  it.each([State.Playing, State.Paused] as const)('leaves healthy or paused playback unchanged', async state => {
    playbackState.mockResolvedValue({state});
    expect(await recoverRadioAfterNetworkReturn()).toBe(false);
    expect(TrackPlayer.load).not.toHaveBeenCalled();
  });

  it('does not replace a podcast with a radio station', async () => {
    activeTrack.mockResolvedValue({...track, id: 'podcast:123'});
    expect(await recoverRadioAfterNetworkReturn()).toBe(false);
    expect(TrackPlayer.load).not.toHaveBeenCalled();
  });

  it('abandons recovery if the user changes tracks during the state read', async () => {
    activeTrack.mockResolvedValueOnce(track).mockResolvedValue({...track, id: 'podcast:123'});
    expect(await recoverRadioAfterNetworkReturn()).toBe(false);
    expect(TrackPlayer.load).not.toHaveBeenCalled();
  });

  it('does not restart audio if the user pauses while a reload is pending', async () => {
    jest.mocked(TrackPlayer.load).mockImplementation(async () => {
      markPlaybackPaused();
      return undefined as never;
    });
    expect(await recoverRadioAfterNetworkReturn()).toBe(false);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('waits for an offline-to-validated-online transition and deduplicates notifications', async () => {
    const stop = startNetworkPlaybackRecovery();
    const listener = jest.mocked(NetInfo.addEventListener).mock.calls[0][0];
    await listener({isConnected: true, isInternetReachable: true} as never);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    await listener({isConnected: false, isInternetReachable: false} as never);
    await listener({isConnected: true, isInternetReachable: null} as never);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    await listener({isConnected: true, isInternetReachable: true} as never);
    await listener({isConnected: true, isInternetReachable: true} as never);
    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
    stop();
    await listener({isConnected: false, isInternetReachable: false} as never);
    await listener({isConnected: true, isInternetReachable: true} as never);
    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
  });
});
