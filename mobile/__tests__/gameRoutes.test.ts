import {describe, expect, it} from '@jest/globals';

import {BUILTIN_GAMES, getGameRouteForSlug, isPracticeGame} from '../src/screens/games/gameRoutes';

describe('game route mapping', () => {
  it('maps backend game slugs to native game screens', () => {
    expect(getGameRouteForSlug('snake')).toBe('SnakeGame');
    expect(getGameRouteForSlug('memory')).toBe('MemoryGame');
    expect(getGameRouteForSlug('tetris')).toBe('TetrisGame');
    expect(getGameRouteForSlug('rhythm-tap')).toBe('RhythmTapGame');
    expect(getGameRouteForSlug('word-guess')).toBe('WordGuessGame');
  });

  it('rejects unknown slugs instead of submitting demo scores', () => {
    expect(getGameRouteForSlug(undefined)).toBeNull();
    expect(getGameRouteForSlug('demo')).toBeNull();
  });

  it('enables verified rewards when bundled routes receive server ids', () => {
    expect(isPracticeGame({id: 'builtin:snake'})).toBe(true);
    for (const game of BUILTIN_GAMES) {
      expect(isPracticeGame({id: `game-${game.slug}`, slug: game.slug})).toBe(false);
    }
    expect(isPracticeGame({id: 'game-123', slug: 'server-only-game'})).toBe(false);
    expect(BUILTIN_GAMES.every(game => game.daily_point_limit === 0)).toBe(true);
  });
});
