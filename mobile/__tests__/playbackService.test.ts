import {beforeEach, describe, expect, it, jest} from '@jest/globals';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
    getQueue: jest.fn(),
    pause: jest.fn(),
    play: jest.fn(),
    stop: jest.fn(),
  },
  Event: {
    RemotePlay: 'remote-play',
    RemotePause: 'remote-pause',
    RemoteStop: 'remote-stop',
    RemoteNext: 'remote-next',
    RemotePrevious: 'remote-previous',
    RemotePlayId: 'remote-play-id',
    RemotePlaySearch: 'remote-play-search',
    PlaybackError: 'playback-error',
  },
}));

jest.mock('../src/services/playbackQueue', () => ({
  ensureBrowsableQueue: jest.fn(),
  fallbackActiveChannelStream: jest.fn(),
  findChannelByQuery: jest.fn(),
  getLatestCachedPodcastId: jest.fn(),
  isPodcastId: (id: string) => id.startsWith('podcast:'),
  playAdjacentQueueItem: jest.fn(),
  playChannelById: jest.fn(),
  playTrackById: jest.fn(),
  pausePlaybackByUser: jest.fn(),
  rebuildBrowsableQueue: jest.fn(),
  resumePlaybackByUser: jest.fn(),
  setCachedPodcasts: jest.fn(),
  stopPlaybackByUser: jest.fn(),
}));

jest.mock('../src/services/podcastService', () => ({
  fetchPodcasts: jest.fn(),
}));

jest.mock('../src/services/streamPreferences', () => ({
  resolveCurrentStreamPreferences: jest.fn(),
}));

jest.mock('../src/utils/safeLog', () => ({
  logSafeError: jest.fn(),
}));

import TrackPlayer from 'react-native-track-player';
import {
  findChannelByQuery,
  getLatestCachedPodcastId,
  playChannelById,
  playTrackById,
  rebuildBrowsableQueue,
  setCachedPodcasts,
} from '../src/services/playbackQueue';
import {fetchPodcasts} from '../src/services/podcastService';
import {
  handleRemotePlaySearch,
  isLatestPodcastVoiceQuery,
} from '../src/services/playbackService';
import {resolveCurrentStreamPreferences} from '../src/services/streamPreferences';

const getQueue = TrackPlayer.getQueue as jest.MockedFunction<typeof TrackPlayer.getQueue>;
const findChannel = findChannelByQuery as jest.MockedFunction<typeof findChannelByQuery>;
const latestCachedId = getLatestCachedPodcastId as jest.MockedFunction<
  typeof getLatestCachedPodcastId
>;
const playChannel = playChannelById as jest.MockedFunction<typeof playChannelById>;
const playTrack = playTrackById as jest.MockedFunction<typeof playTrackById>;
const rebuildQueue = rebuildBrowsableQueue as jest.MockedFunction<typeof rebuildBrowsableQueue>;
const cachePodcasts = setCachedPodcasts as jest.MockedFunction<typeof setCachedPodcasts>;
const fetchLatestPodcasts = fetchPodcasts as jest.MockedFunction<typeof fetchPodcasts>;
const resolvePreferences = resolveCurrentStreamPreferences as jest.MockedFunction<
  typeof resolveCurrentStreamPreferences
>;

describe('PlaybackService remote voice search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolvePreferences.mockResolvedValue({quality: 'normal', preference: 'normal'} as never);
    playTrack.mockResolvedValue(true);
    playChannel.mockResolvedValue({played: true, cancelled: false, quality: 'normal'});
  });

  it('recognizes branded latest-podcast phrases in all supported languages', () => {
    for (const phrase of [
      'Play the latest RadioTEDU podcast',
      'En son RadioTEDU podcast',
      'Последний RadioTEDU подкаст',
      'أحدث RadioTEDU بودكاست',
      'Neuester RadioTEDU Podcast',
      'Dernier podcast RadioTEDU',
    ]) {
      expect(isLatestPodcastVoiceQuery(phrase)).toBe(true);
    }
    expect(isLatestPodcastVoiceQuery('Play RadioTEDU Jazz')).toBe(false);
  });

  it('plays the newest cached podcast and never falls through to radio', async () => {
    latestCachedId.mockReturnValue('podcast:newest');
    getQueue.mockResolvedValue([
      {id: 'radiotedu-main'},
      {id: 'podcast:newest'},
      {id: 'podcast:older'},
    ] as never);

    await handleRemotePlaySearch('Play the latest RadioTEDU podcast');

    expect(playTrack).toHaveBeenCalledWith('podcast:newest');
    expect(findChannel).not.toHaveBeenCalled();
    expect(playChannel).not.toHaveBeenCalled();
  });

  it('rebuilds once when the cached newest episode is absent from the queue', async () => {
    latestCachedId.mockReturnValue('podcast:newest');
    getQueue
      .mockResolvedValueOnce([{id: 'radiotedu-main'}] as never)
      .mockResolvedValueOnce([{id: 'podcast:newest'}] as never);

    await handleRemotePlaySearch('newest RadioTEDU episode');

    expect(rebuildQueue).toHaveBeenCalledWith('normal');
    expect(playTrack).toHaveBeenCalledWith('podcast:newest');
    expect(playChannel).not.toHaveBeenCalled();
  });

  it('loads the newest podcast on a cold voice-service start', async () => {
    latestCachedId
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('podcast:newest');
    getQueue
      .mockResolvedValueOnce([{id: 'radiotedu-main'}] as never)
      .mockResolvedValueOnce([{id: 'podcast:newest'}] as never);
    fetchLatestPodcasts.mockResolvedValue({
      items: [{id: 'newest', audioUrl: 'https://cdn.example/newest.mp3'}],
      total: 1,
      totalPages: 1,
    } as never);

    await handleRemotePlaySearch('Play the latest RadioTEDU podcast');

    expect(fetchLatestPodcasts).toHaveBeenCalledWith(1);
    expect(cachePodcasts).toHaveBeenCalledWith([
      {id: 'newest', audioUrl: 'https://cdn.example/newest.mp3'},
    ]);
    expect(rebuildQueue).toHaveBeenCalledWith('normal');
    expect(playTrack).toHaveBeenCalledWith('podcast:newest');
    expect(playChannel).not.toHaveBeenCalled();
  });

  it('preserves exact Jazz, Lo-Fi, and main-radio routing', async () => {
    for (const [query, id] of [
      ['Play RadioTEDU Jazz', 'radiotedu-jazz'],
      ['Play RadioTEDU Lo-Fi', 'radiotedu-lofi'],
      ['Play RadioTEDU', 'radiotedu-main'],
    ]) {
      findChannel.mockReturnValueOnce({id} as never);
      await handleRemotePlaySearch(query);
      expect(playChannel).toHaveBeenLastCalledWith(id);
    }
    expect(playTrack).not.toHaveBeenCalled();
  });
});
