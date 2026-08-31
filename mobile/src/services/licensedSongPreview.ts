import TrackPlayer, {State, Track} from 'react-native-track-player';
import {
  LICENSED_PREVIEW_LIMIT_MS,
  resolveLicensedSongPreview,
} from './licensedSongPreviewCatalog';

export type LicensedPreviewSession = Readonly<{
  finished: Promise<void>;
  stop: () => Promise<void>;
}>;

type PlaybackSnapshot = Readonly<{
  queue: Track[];
  activeIndex: number | undefined;
  position: number;
  state: State;
}>;

let activeSession: LicensedPreviewSession | null = null;

async function capturePlayback(): Promise<PlaybackSnapshot> {
  const [queue, activeIndex, progress, playback] = await Promise.all([
    TrackPlayer.getQueue(),
    TrackPlayer.getActiveTrackIndex(),
    TrackPlayer.getProgress(),
    TrackPlayer.getPlaybackState(),
  ]);
  return {
    queue,
    activeIndex,
    position: progress.position,
    state: playback.state,
  };
}

async function restorePlayback(snapshot: PlaybackSnapshot): Promise<void> {
  await TrackPlayer.pause().catch(() => {});
  await TrackPlayer.reset();
  if (snapshot.queue.length === 0) {
    return;
  }
  await TrackPlayer.add(snapshot.queue);
  if (snapshot.activeIndex !== undefined && snapshot.activeIndex < snapshot.queue.length) {
    await TrackPlayer.skip(snapshot.activeIndex);
    if (snapshot.position > 0 && Number.isFinite(snapshot.position)) {
      await TrackPlayer.seekTo(snapshot.position);
    }
  }
  if (snapshot.state === State.Playing || snapshot.state === State.Buffering) {
    await TrackPlayer.play();
  }
}

export async function startLicensedSongPreview(input: Readonly<{
  title: string;
  artist: string;
}>): Promise<LicensedPreviewSession> {
  if (activeSession) {
    await activeSession.stop();
  }
  const preview = await resolveLicensedSongPreview(input);
  if (!preview) {
    throw new Error('LICENSED_PREVIEW_UNAVAILABLE');
  }

  const snapshot = await capturePlayback();
  await TrackPlayer.pause().catch(() => {});
  await TrackPlayer.reset();
  await TrackPlayer.add({
    id: preview.id,
    url: preview.url,
    title: preview.title,
    artist: preview.artist,
    artwork: preview.artwork,
    duration: LICENSED_PREVIEW_LIMIT_MS / 1_000,
    isLiveStream: false,
  });
  await TrackPlayer.play();

  let completed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resolveFinished: () => void = () => {};
  const finished = new Promise<void>(resolve => {
    resolveFinished = resolve;
  });
  const stop = async () => {
    if (completed) {
      return;
    }
    completed = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    await restorePlayback(snapshot);
    if (activeSession?.finished === finished) {
      activeSession = null;
    }
    resolveFinished();
  };
  timer = setTimeout(() => {
    void stop();
  }, LICENSED_PREVIEW_LIMIT_MS);
  activeSession = {finished, stop};
  return activeSession;
}

export async function stopLicensedSongPreview(): Promise<void> {
  await activeSession?.stop();
}
