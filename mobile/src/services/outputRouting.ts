import {DeviceEventEmitter, NativeModules, Platform} from 'react-native';

function getCastBridge() {
  return NativeModules.RadioTeduCastBridge as
    | {
        updateMedia(url: string, title: string, artist: string, artwork: string, live: boolean): void;
        showRoutePicker(): void;
      }
    | undefined;
}

function getContinuityBridge() {
  return NativeModules.RadioTeduContinuityBridge as
    | {
        updateMedia(mediaId: string, title: string, artist: string, playbackURL: string, positionSeconds: number): void;
        clear(): void;
      }
    | undefined;
}

export type OutputMedia = {
  id: string;
  url: string;
  title: string;
  artist: string;
  artwork: string;
  live: boolean;
  positionSeconds: number;
};

export function updateOutputMedia(media: OutputMedia): void {
  if (!media.url.startsWith('http')) {
    return;
  }
  if (Platform.OS === 'android') {
    getCastBridge()?.updateMedia(media.url, media.title, media.artist, media.artwork, media.live);
  } else if (Platform.OS === 'ios') {
    getContinuityBridge()?.updateMedia(
      media.id,
      media.title,
      media.artist,
      media.url,
      Math.max(0, Math.floor(media.positionSeconds)),
    );
  }
}

export function clearOutputMedia(): void {
  if (Platform.OS === 'ios') {
    getContinuityBridge()?.clear();
  }
}

let isCasting = false;
const routingListeners = new Set<(connected: boolean) => void>();

export function isCastActive(): boolean {
  return isCasting;
}

export function subscribeToCastState(callback: (connected: boolean) => void): () => void {
  routingListeners.add(callback);
  callback(isCasting);
  return () => {
    routingListeners.delete(callback);
  };
}

export function setMockCastActive(active: boolean): void {
  isCasting = active;
  routingListeners.forEach(l => l(isCasting));
}

export function showCastRoutePicker(): void {
  if (Platform.OS === 'android') {
    getCastBridge()?.showRoutePicker();
  }
}

export function initOutputRouting(): () => void {
  const bridge = getCastBridge();
  if (Platform.OS !== 'android' || !bridge) {
    return () => {};
  }
  const startSub = DeviceEventEmitter.addListener('RadioTeduCastSessionStarted', () => {
    isCasting = true;
    routingListeners.forEach(l => l(true));
    try {
      const {pausePlaybackByUser} = require('./playbackQueue');
      pausePlaybackByUser().catch(() => {});
    } catch {
      // ignore
    }
  });
  const endSub = DeviceEventEmitter.addListener('RadioTeduCastSessionEnded', () => {
    isCasting = false;
    routingListeners.forEach(l => l(false));
  });
  return () => {
    startSub.remove();
    endSub.remove();
  };
}
