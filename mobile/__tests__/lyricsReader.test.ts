import fs from 'fs';
import path from 'path';
import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {fetchScrollableLyrics, parseScrollableLyrics} from '../src/services/lyricsService';

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('manual lyrics reader', () => {
  afterEach(() => {jest.restoreAllMocks();});

  it('rejects another artist even when the title is identical', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ok: true, json: async () => ([{
      id: 1, trackName: 'Shared title', artistName: 'Different artist', plainLyrics: 'Wrong text',
    }])} as Response);
    expect(await fetchScrollableLyrics({track: 'Shared title', artist: 'Requested artist'})).toEqual([]);
  });

  it('returns an exact matching recording', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ok: true, json: async () => ({
      trackName: 'Test song', artistName: 'Test artist', plainLyrics: 'First\nSecond',
    })} as Response);
    expect(await fetchScrollableLyrics({track: 'Test song', artist: 'Test artist'})).toEqual(['First', 'Second']);
  });

  it('searches the simplified title when broadcast metadata includes an album', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input));
      const matchingQuery = url.pathname.endsWith('/search') && url.searchParams.get('track_name') === 'Test song';
      return {ok: true, json: async () => matchingQuery ? [{
        trackName: 'Test song', artistName: 'Test artist', plainLyrics: 'Matched lyrics',
      }] : []} as Response;
    });
    expect(await fetchScrollableLyrics({track: 'Test song (Album title)', artist: 'Test artist'}))
      .toEqual(['Matched lyrics']);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('track_name=Test+song&'))).toBe(true);
  });

  it('does not start fallback searches after cancellation', async () => {
    const controller = new AbortController();
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => {
      controller.abort();
      throw new Error('Transport cancelled');
    });
    await expect(fetchScrollableLyrics({track: 'Test song', artist: 'Test artist', signal: controller.signal}))
      .rejects.toMatchObject({name: 'AbortError'});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a late response from a transport that ignores abort', async () => {
    const controller = new AbortController();
    jest.spyOn(global, 'fetch').mockResolvedValue({ok: true, json: async () => {
      controller.abort();
      return {trackName: 'Test song', artistName: 'Test artist', plainLyrics: 'Old lyrics'};
    }} as Response);
    await expect(fetchScrollableLyrics({track: 'Test song', artist: 'Test artist', signal: controller.signal}))
      .rejects.toMatchObject({name: 'AbortError'});
  });
  it('removes timestamps while preserving the full lyric order', () => {
    expect(parseScrollableLyrics('[00:01.10]First line\n[00:04.20]Second line')).toEqual([
      'First line',
      'Second line',
    ]);
  });

  it('uses an independently scrollable panel instead of timed highlighting', () => {
    const player = readSource('src/screens/PlayerScreen.tsx');
    const service = readSource('src/services/lyricsService.ts');

    expect(player).toContain('nestedScrollEnabled');
    expect(player).toContain('showsVerticalScrollIndicator');
    expect(player).toContain('lyricsScroller: {flexGrow: 0, height: 124}');
    expect(player).not.toMatch(/lyricsStartedAt|activeLyric|setInterval/);
    expect(service).toContain('candidate.plainLyrics || candidate.syncedLyrics');
    expect(service).toContain('https://lrclib.net/api/search');
  });

  it('gates automatic lyrics fetching behind wifi and exposes a manual load button on mobile data', () => {
    const player = readSource('src/screens/PlayerScreen.tsx');
    expect(player).toContain('@react-native-community/netinfo');
    expect(player).toContain("state.type === 'cellular'");
    expect(player).toContain('isCellular && manualLyricsRequestedKey !== lyricsTrackKey');
    expect(player).toContain('cellularLyricsButton');
    expect(player).toContain('LYRICS');
  });
});
