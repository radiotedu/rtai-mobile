import NetInfo from '@react-native-community/netinfo';
import TrackPlayer, {State} from 'react-native-track-player';
import {RADIO_CHANNELS, resolveStreamQuality} from '../data/radioChannels';
import {shouldAutoRecoverPlayback} from './playbackIntent';
import {buildChannelTrack, startConnectionWatchdog} from './playbackQueue';
import {logSafeError} from '../utils/safeLog';

export async function recoverRadioAfterNetworkReturn(): Promise<boolean> {
  if (!shouldAutoRecoverPlayback()) {
    return false;
  }
  const [track, playback] = await Promise.all([
    TrackPlayer.getActiveTrack(),
    TrackPlayer.getPlaybackState(),
  ]);
  if (![State.Error, State.Buffering, State.Loading].includes(playback.state)) {
    return false;
  }
  const channel = RADIO_CHANNELS.find(item => item.id === track?.id);
  if (!channel) {
    return false;
  }
  const current = await TrackPlayer.getActiveTrack();
  if (!shouldAutoRecoverPlayback() || current?.id !== track?.id || current?.url !== track?.url) {
    return false;
  }
  // Restart the same station safely even if its fallback list was exhausted
  // offline. Never re-enter FLAC automatically on a newly metered connection.
  const quality = resolveStreamQuality(channel, 'low');
  await TrackPlayer.load(buildChannelTrack(channel, quality));
  if (!shouldAutoRecoverPlayback()) {
    await TrackPlayer.pause();
    return false;
  }
  if ((await TrackPlayer.getActiveTrack())?.id !== channel.id || !shouldAutoRecoverPlayback()) {
    return false;
  }
  await TrackPlayer.play();
  startConnectionWatchdog(channel, quality);
  return true;
}

export function startNetworkPlaybackRecovery(): () => void {
  let disconnected = false;
  let recovering = false;
  let disposed = false;
  const unsubscribe = NetInfo.addEventListener(async network => {
    if (disposed) {
      return;
    }
    if (network.isConnected === false || network.isInternetReachable === false) {
      disconnected = true;
      return;
    }
    if (!disconnected || recovering || network.isConnected !== true || network.isInternetReachable !== true) {
      return;
    }
    disconnected = false;
    recovering = true;
    try {
      await recoverRadioAfterNetworkReturn();
    } catch (error) {
      logSafeError('playback.networkReturn', error);
    } finally {
      recovering = false;
    }
  });
  return () => {
    disposed = true;
    unsubscribe();
  };
}
