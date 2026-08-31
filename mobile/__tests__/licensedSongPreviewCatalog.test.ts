import {describe, expect, it} from '@jest/globals';
import {
  LICENSED_PREVIEW_LIMIT_MS,
  resolveLicensedSongPreview,
} from '../src/services/licensedSongPreviewCatalog';

describe('licensed song previews', () => {
  it('hard-limits the commercial preview window to seven seconds', () => {
    expect(LICENSED_PREVIEW_LIMIT_MS).toBe(7_000);
  });

  it('selects the matching official Apple preview without downloading it', async () => {
    let requestedUrl = '';
    const fetcher = async (url: string) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({
        results: [
          {trackId: 1, trackName: 'Yellow Submarine', artistName: 'The Beatles', previewUrl: 'https://example.test/wrong.m4a'},
          {trackId: 2, trackName: 'Yellow', artistName: 'Coldplay', artworkUrl100: 'https://example.test/100x100bb.jpg', previewUrl: 'https://example.test/yellow.m4a'},
        ],
        }),
      };
    };

    await expect(resolveLicensedSongPreview({title: 'Yellow', artist: 'Coldplay'}, fetcher)).resolves.toEqual({
      id: 'apple-preview:2',
      title: 'Yellow',
      artist: 'Coldplay',
      artwork: 'https://example.test/600x600bb.jpg',
      url: 'https://example.test/yellow.m4a',
    });
    expect(requestedUrl).toEqual(expect.stringContaining('itunes.apple.com/search'));
  });
});
