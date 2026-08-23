import NetInfo from '@react-native-community/netinfo';
import TrackPlayer, {State} from 'react-native-track-player';
import {RADIO_CHANNELS, StreamQuality} from '../data/radioChannels';
import {
  automaticQualityForNetwork,
  isCellularNetwork,
  loadStreamPreferences,
  StreamNetworkSnapshot,
} from './streamPreferences';
import {
  playChannelById,
  playTrackById,
  replaceChannelTrack,
} from './playbackQueue';

let started = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let warnedCellularFlacKey = '';

async function applyNetworkChange(network: StreamNetworkSnapshot) {
  const track = await TrackPlayer.getActiveTrack();
  const channel = RADIO_CHANNELS.find(item => item.id === String(track?.id ?? ''));
  if (!channel) {
    return;
  }

  const {state} = await TrackPlayer.getPlaybackState();
  if (
    state !== State.Playing &&
    state !== State.Buffering &&
    state !== State.Loading
  ) {
    return;
  }

  const preferences = await loadStreamPreferences();
  const trackUrl = String(track?.url ?? '');
  const currentQuality: StreamQuality = trackUrl.includes('-flac')
    ? 'flac'
    : trackUrl.includes('-low')
      ? 'low'
      : 'normal';

  if (
    preferences.quality === 'flac' &&
    currentQuality === 'flac' &&
    isCellularNetwork(network)
  ) {
    const warningKey = `${channel.id}:${String(network.type)}`;
    if (warningKey === warnedCellularFlacKey) {
      return;
    }
    warnedCellularFlacKey = warningKey;
    await TrackPlayer.pause();
    await playChannelById(channel.id);
    return;
  }

  if (!isCellularNetwork(network)) {
    warnedCellularFlacKey = '';
  }

  if (preferences.quality !== 'automatic') {
    return;
  }

  const nextQuality = automaticQualityForNetwork(network);
  if (currentQuality === nextQuality) {
    return;
  }

  await replaceChannelTrack(channel, nextQuality);
  await playTrackById(channel.id);
}

export function startStreamQualityController(): () => void {
  if (started) {
    return () => {};
  }
  started = true;

  const unsubscribe = NetInfo.addEventListener(network => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      applyNetworkChange(network as StreamNetworkSnapshot).catch(() => {});
    }, 1_500);
  });

  return () => {
    unsubscribe();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    warnedCellularFlacKey = '';
    started = false;
  };
}

export function resetStreamQualityControllerForTests(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  warnedCellularFlacKey = '';
  started = false;
}
