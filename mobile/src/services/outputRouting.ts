import {DeviceEventEmitter, NativeModules, Platform} from 'react-native';
import {pausePlaybackByUser} from './playbackQueue';

const CastBridge = NativeModules.RadioTeduCastBridge as
  | {
      updateMedia(url: string, title: string, artist: string, artwork: string, live: boolean): void;
      showRoutePicker(): void;
    }
  | undefined;

const ContinuityBridge = NativeModules.RadioTeduContinuityBridge as
  | {
      updateMedia(mediaId: string, title: string, artist: string, playbackURL: string, positionSeconds: number): void;
      clear(): void;
    }
  | undefined;

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
    CastBridge?.updateMedia(media.url, media.title, media.artist, media.artwork, media.live);
  } else if (Platform.OS === 'ios') {
    ContinuityBridge?.updateMedia(
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
    ContinuityBridge?.clear();
  }
}

export function showCastRoutePicker(): void {
  if (Platform.OS === 'android') {
    CastBridge?.showRoutePicker();
  }
}

export function initOutputRouting(): () => void {
  if (Platform.OS !== 'android' || !CastBridge) {
    return () => {};
  }
  const subscription = DeviceEventEmitter.addListener('RadioTeduCastSessionStarted', () => {
    pausePlaybackByUser().catch(() => {});
  });
  return () => subscription.remove();
}
