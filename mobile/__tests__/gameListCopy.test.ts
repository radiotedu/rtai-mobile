import {describe, expect, it} from '@jest/globals';
import {gameListCopy} from '../src/i18n/gameListCopy';

describe('game catalog localization', () => {
  it('localizes bundled slugs instead of leaking backend language', () => {
    expect(gameListCopy('snake', 'en', {title: 'Yılan'}).title).toBe('Snake');
    expect(gameListCopy('snake', 'ru', {title: 'Yılan'}).title).toBe('Змейка');
    expect(gameListCopy('memory', 'fr', {title: 'Hafıza'}).title).toBe('Mémoire');
  });

  it('keeps unknown server games available with their fallback text', () => {
    expect(gameListCopy('new-game', 'en', {title: 'Server title', description: 'Server description'})).toEqual({
      title: 'Server title',
      description: 'Server description',
    });
  });
});
