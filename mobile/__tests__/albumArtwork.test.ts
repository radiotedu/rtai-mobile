import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {fetchAlbumArtwork} from '../src/utils/api';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('album artwork enrichment', () => {
  it('returns a larger Apple artwork URL for a successful match', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        resultCount: 1,
        results: [{artworkUrl100: 'https://example.test/100x100bb.jpg'}],
      }),
    })) as unknown as typeof fetch;

    await expect(fetchAlbumArtwork('Artist Song')).resolves.toBe(
      'https://example.test/600x600bb.jpg',
    );
  });

  it('aborts artwork lookup instead of delaying live metadata indefinitely', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((_url: RequestInfo | URL, options?: RequestInit) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        );
      }),
    ) as unknown as typeof fetch;

    const result = fetchAlbumArtwork('Artist Song', 25);
    jest.advanceTimersByTime(25);

    await expect(result).resolves.toBeNull();
  });
});
