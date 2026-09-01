import fs from 'fs';
import path from 'path';
import {describe, expect, it} from '@jest/globals';
import {parseScrollableLyrics} from '../src/services/lyricsService';

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('manual lyrics reader', () => {
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
});
