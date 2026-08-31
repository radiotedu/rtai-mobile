import fs from 'fs';
import path from 'path';
import {describe, expect, it} from '@jest/globals';

const read = (relative: string) =>
  fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

describe('arcade visual upgrade', () => {
  it('gives every bundled game a distinct visual identity', () => {
    const expected = [
      ['SnakeScreen.tsx', 'accentColor="#48E08A"', 'snakeEye'],
      ['MemoryGameScreen.tsx', 'accentColor="#A78BFA"', 'cardBack'],
      ['TetrisScreen.tsx', 'accentColor="#46C8FF"', 'sidePanel'],
      ['RhythmTapScreen.tsx', 'accentColor="#FFD54A"', 'vinylRecord'],
      ['WordGuessScreen.tsx', 'accentColor="#FF8A4C"', 'optionLetter'],
    ];

    for (const [file, accent, visualFeature] of expected) {
      const source = read(`src/screens/games/${file}`);
      expect(source).toContain(accent);
      expect(source).toContain(visualFeature);
    }
  });

  it('uses the upgraded shared arcade chrome and catalog artwork', () => {
    const chrome = read('src/screens/games/GameChrome.tsx');
    const catalog = read('src/screens/GamesScreen.tsx');
    expect(chrome).toContain('ambientOrb');
    expect(chrome).toContain('titleIcon');
    expect(chrome).toContain('scoreGlow');
    expect(catalog).toContain('getGameAccent');
    expect(catalog).toContain('gameWatermark');
    expect(catalog).toContain('gameNumber');
  });

  it('keeps directional controls cubic instead of pill-shaped', () => {
    const snake = read('src/screens/games/SnakeScreen.tsx');
    const tetris = read('src/screens/games/TetrisScreen.tsx');
    for (const source of [snake, tetris]) {
      expect(source).toContain(
        'controlButton: {width: 52, height: 52, borderRadius: 4',
      );
      expect(source).toContain('dpadTop');
      expect(source).toContain('dpadMiddle');
      expect(source).toContain('dpadBottom');
    }
  });
});
