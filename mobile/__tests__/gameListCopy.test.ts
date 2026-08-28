import {describe, expect, it} from '@jest/globals';
import {gameListCopy} from '../src/i18n/gameListCopy';
import {screenCopy} from '../src/i18n/screenCopy';

describe('game catalog localization', () => {
  it('localizes bundled slugs instead of leaking backend language', () => {
    expect(gameListCopy('snake', 'en', {title: 'Yılan'}).title).toBe('Neon Snake');
    expect(gameListCopy('snake', 'ru', {title: 'Yılan'}).title).toBe('Неоновая змейка');
    expect(gameListCopy('memory', 'fr', {title: 'Hafıza'}).title).toBe('Mémoire');
  });

  it('keeps unknown server games available with their fallback text', () => {
    expect(gameListCopy('new-game', 'en', {title: 'Server title', description: 'Server description'})).toEqual({
      title: 'Server title',
      description: 'Server description',
    });
  });

  it('ships accurate practice and Arabic catalog copy', () => {
    expect(gameListCopy('word-guess', 'ar').description).toBe(
      'اثنا عشر تحدياً عشوائياً من مجموعة تضم 256 سؤالاً.',
    );
    expect(gameListCopy('word-guess', 'ar').description).not.toMatch(/[А-Яа-я]/);

    for (const language of ['en', 'tr', 'ru', 'ar', 'de', 'fr']) {
      expect(screenCopy(language, 'games.practiceNoRewards')).toContain('Gold');
    }
  });
});
