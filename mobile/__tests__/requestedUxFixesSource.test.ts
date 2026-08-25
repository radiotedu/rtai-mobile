import fs from 'fs';
import path from 'path';
import {describe, expect, it} from '@jest/globals';

const root = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('requested playback and navigation fixes', () => {
  it('offers podcast rewind and forward controls in player and notifications', () => {
    const player = read('src/screens/PlayerScreen.tsx');
    const app = read('App.tsx');
    expect(player).toContain('seekPodcastBy(-15)');
    expect(player).toContain('seekPodcastBy(30)');
    expect(app).toContain('Capability.JumpBackward');
    expect(app).toContain('Capability.JumpForward');
  });

  it('presents FLAC as High Quality while retaining codec detail', () => {
    const player = read('src/screens/PlayerScreen.tsx');
    const copy = read('src/i18n/appCopy.ts');
    expect(player).toContain("labelKey: 'player.highQuality'");
    expect(copy).toContain("'player.highQuality': 'High Quality'");
    expect(copy).toContain("'player.flacCodecDescription': 'FLAC");
  });

  it('packages the preferred native FLAC renderer', () => {
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('kotlinaudio-v2.1.0-radiotedu.aar');
    expect(gradle).toContain('exoplayer-flac-2.19.0-radiotedu.aar');
  });

  it('replaces Rhythm Tap with the visual song quiz', () => {
    const game = read('src/screens/games/RhythmTapScreen.tsx');
    expect(game).toContain('getSongGuessQuestions');
    expect(game).toContain('vinylRecord');
    expect(game).not.toContain('setInterval');
  });
});
