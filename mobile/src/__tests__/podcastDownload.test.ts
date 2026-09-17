import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DOWNLOADS_STORAGE_KEY,
  clearAllDownloads,
  deleteDownloadedPodcast,
  downloadPodcast,
  getAllDownloadedPodcasts,
  getDownloadStatus,
  getDownloadedPodcastPath,
  initPodcastDownloadService,
  isPodcastDownloaded,
  resetPodcastDownloadServiceForTests,
  subscribeToDownloads,
} from '../services/podcastDownloadService';
import type {Podcast} from '../services/podcastService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockPodcast: Podcast = {
  id: 'pod-edu-1',
  title: 'TEDÜ Eğitimde Yenilikler',
  date: '2026-09-10',
  audioUrl: 'https://radiotedu.com/podcasts/edu1.mp3',
  description: 'Eğitim vizyonu ve inovasyonlar.',
  feedTitle: 'Doç. Dr. Ankara',
};

describe('Podcast Download & Offline Storage Service', () => {
  beforeEach(async () => {
    resetPodcastDownloadServiceForTests();
    (AsyncStorage.getItem as jest.Mock).mockReset();
    (AsyncStorage.setItem as jest.Mock).mockReset();
  });

  it('initializes from AsyncStorage when cached downloads exist', async () => {
    const cachedItem = {
      id: 'pod-cached',
      title: 'Geçmiş Bölüm',
      author: 'TEDÜ',
      description: 'Test',
      originalAudioUrl: 'https://example.com/audio.mp3',
      localFilePath: '/data/podcasts/test.mp3',
      fileSizeBytes: 15000000,
      durationSeconds: 900,
      downloadedAt: '2026-09-12T10:00:00Z',
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify([cachedItem]),
    );

    await initPodcastDownloadService();
    expect(isPodcastDownloaded('pod-cached')).toBe(true);
    expect(getDownloadedPodcastPath('pod-cached')).toBe('/data/podcasts/test.mp3');
    expect(getAllDownloadedPodcasts().length).toBe(1);
  });

  it('downloads a podcast episode, tracks progress, and saves to storage', async () => {
    const progressSpy = jest.fn();
    const listenerSpy = jest.fn();
    const unsubscribe = subscribeToDownloads(listenerSpy);

    expect(isPodcastDownloaded(mockPodcast.id)).toBe(false);
    expect(getDownloadStatus(mockPodcast.id)).toBe('idle');

    const item = await downloadPodcast(mockPodcast, progressSpy);

    expect(item.id).toBe(mockPodcast.id);
    expect(item.localFilePath).toContain('podcast_pod-edu-1.mp3');
    expect(isPodcastDownloaded(mockPodcast.id)).toBe(true);
    expect(getDownloadStatus(mockPodcast.id)).toBe('downloaded');
    expect(progressSpy).toHaveBeenCalled();
    expect(listenerSpy).toHaveBeenCalled();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      DOWNLOADS_STORAGE_KEY,
      expect.stringContaining(mockPodcast.id),
    );

    unsubscribe();
  });

  it('deletes a downloaded podcast and updates storage', async () => {
    await downloadPodcast(mockPodcast);
    expect(isPodcastDownloaded(mockPodcast.id)).toBe(true);

    const deleted = await deleteDownloadedPodcast(mockPodcast.id);
    expect(deleted).toBe(true);
    expect(isPodcastDownloaded(mockPodcast.id)).toBe(false);
    expect(getDownloadedPodcastPath(mockPodcast.id)).toBeNull();

    // Deleting non-existent returns false
    const deletedAgain = await deleteDownloadedPodcast(mockPodcast.id);
    expect(deletedAgain).toBe(false);
  });

  it('clears all downloads', async () => {
    await downloadPodcast(mockPodcast);
    expect(getAllDownloadedPodcasts().length).toBe(1);

    await clearAllDownloads();
    expect(getAllDownloadedPodcasts().length).toBe(0);
    expect(isPodcastDownloaded(mockPodcast.id)).toBe(false);
  });
});
