import TrackPlayer, {Event} from 'react-native-track-player';
import {
  ensureBrowsableQueue,
  fallbackActiveChannelStream,
  findChannelByQuery,
  isPodcastId,
  playAdjacentQueueItem,
  playChannelById,
  playTrackById,
} from './playbackQueue';
import {resolveCurrentStreamPreferences} from './streamPreferences';

export const PlaybackService = async function () {
  // Transport controls (notification, lock screen, car, headset, Bluetooth).
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteNext, () =>
    playAdjacentQueueItem(1),
  );
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    playAdjacentQueueItem(-1),
  );

  // Android Auto / CarPlay: user tapped an item in the browse list.
  // The id is a channel id (e.g. "radiotedu-jazz") or "podcast:<id>".
  TrackPlayer.addEventListener(Event.RemotePlayId, async ({id}) => {
    try {
      if (isPodcastId(id)) {
        const streamSelection = await resolveCurrentStreamPreferences();
        await ensureBrowsableQueue(streamSelection.quality);
        await playTrackById(id);
      } else {
        await playChannelById(id);
      }
    } catch (error) {
      console.log('[Playback] RemotePlayId failed:', error);
    }
  });

  // Voice / search ("Play RadioTEDU", "put on jazz").
  TrackPlayer.addEventListener(Event.RemotePlaySearch, async ({query}) => {
    try {
      const channel = findChannelByQuery(query ?? '');
      await playChannelById(channel.id);
    } catch (error) {
      console.log('[Playback] RemotePlaySearch failed:', error);
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackError, async error => {
    try {
      const recovered = await fallbackActiveChannelStream();
      if (!recovered) {
        console.log('[Playback] No stream fallback remained:', error);
      }
    } catch (fallbackError) {
      console.log('[Playback] Stream fallback failed:', fallbackError);
    }
  });
};
