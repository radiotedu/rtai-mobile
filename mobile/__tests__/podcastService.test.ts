import {describe, expect, it, jest, beforeEach} from '@jest/globals';

import api from '../src/services/api';
import {
  fetchPodcasts,
  resolvePodcastLaunchUrl,
} from '../src/services/podcastService';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe('podcastService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The RadioTEDU RSS feeds are unreachable under tests, so fetchPodcasts
    // falls back to the backend registry that the cases below assert.
    (global as any).fetch = jest.fn(() => Promise.reject(new Error('no network')));
  });

  it('fetchPodcasts calls the shared api client and maps backend records', async () => {
    const getMock = api.get as jest.MockedFunction<
      (path: string, config?: {params?: {page?: number; per_page?: number}}) => Promise<any>
    >;
    getMock.mockResolvedValueOnce({
      data: {
        data: {
          items: [
            {
              id: 'episode-1',
              title: '',
              excerpt: '<p>Featured <strong>summary</strong></p>',
              description: '<p>Ignored backend description</p>',
              audio_url: 'https://cdn.example.com/audio-1.mp3',
              external_url: 'https://example.com/episode-1',
              image_url: 'https://cdn.example.com/image-1.jpg',
              published_at: '2026-04-01T10:00:00Z',
              feed_title: 'Main Feed',
            },
            {
              id: 'episode-2',
              title: 'Episode Two',
              description: `<div>${'a'.repeat(220)}</div>`,
              external_url: 'https://example.com/episode-2',
              published_at: '2026-04-02T10:00:00Z',
            },
          ],
          total: 42,
          total_pages: 5,
        },
      },
    });

    await expect(fetchPodcasts(3)).resolves.toEqual({
      items: [
        {
          id: 'episode-1',
          title: 'Untitled',
          date: '01.04.2026',
          description: 'Featured summary',
          audioUrl: 'https://cdn.example.com/audio-1.mp3',
          externalUrl: 'https://example.com/episode-1',
          imageUrl: 'https://cdn.example.com/image-1.jpg',
          feedTitle: 'Main Feed',
        },
        {
          id: 'episode-2',
          title: 'Episode Two',
          date: '02.04.2026',
          description: `${'a'.repeat(180)}...`,
          externalUrl: 'https://example.com/episode-2',
        },
      ],
      total: 42,
      totalPages: 5,
    });

    expect(getMock).toHaveBeenCalledWith('/podcasts', {
      params: {
        page: 3,
        per_page: 10,
      },
    });
  });

  it('resolvePodcastLaunchUrl prefers direct audio playback over external url', () => {
    expect(
      resolvePodcastLaunchUrl({
        audioUrl: 'https://cdn.example.com/audio-1.mp3',
        externalUrl: 'https://example.com/episode-1',
        url: 'https://example.com/legacy',
      }),
    ).toBe('https://cdn.example.com/audio-1.mp3');
  });

  it('fetchPodcasts maps all-series episodes from the official catalog', async () => {
    const fetchMock = (jest.fn() as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{
          id: 'show-one',
          title: 'RadioTEDU &amp; Friends',
          image: 'https://cdn.example.com/show.jpg',
        }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          pages: 1,
          items: [{
            id: 'episode-guid',
            title: 'Feed Episode',
            excerpt: '<p>Feed <strong>summary</strong></p>',
            published_at: '2026-04-01T10:00:00Z',
            url: 'https://example.com/feed-episode',
            image: 'https://cdn.example.com/episode.jpg',
            audio_url: 'https://cdn.example.com/feed.mp3',
          }],
        }),
      });
    (global as any).fetch = fetchMock;

    await expect(fetchPodcasts()).resolves.toEqual({
      items: [
        {
          id: 'episode-guid',
          title: 'Feed Episode',
          date: '01.04.2026',
          description: 'Feed summary',
          audioUrl: 'https://cdn.example.com/feed.mp3',
          externalUrl: 'https://example.com/feed-episode',
          imageUrl: 'https://cdn.example.com/episode.jpg',
          feedTitle: 'RadioTEDU & Friends',
        },
      ],
      total: 1,
      totalPages: 1,
    });
  });
});
