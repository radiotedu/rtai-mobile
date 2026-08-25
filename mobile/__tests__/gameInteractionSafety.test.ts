import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

import {createAnswerGate} from '../src/screens/games/answerGate';

describe('native game interaction safety', () => {
  it('accepts only one quiz answer until the next question is ready', () => {
    const gate = createAnswerGate();

    expect(gate.tryEnter()).toBe(true);
    expect(gate.tryEnter()).toBe(false);

    gate.release();
    expect(gate.tryEnter()).toBe(true);
  });

  it('declares the Android vibration permission used by the bundled games', () => {
    const manifest = fs.readFileSync(
      path.join(__dirname, '../android/app/src/main/AndroidManifest.xml'),
      'utf8',
    );

    expect(manifest).toContain('android.permission.VIBRATE');
  });

  it('keeps song answers gated and scoring independent from translated feedback', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../src/screens/games/RhythmTapScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('answerGateRef.current.tryEnter()');
    expect(source).toContain('option === currentQuestion.answer');
    expect(source).toContain('nextCorrect * 160');
    expect(source).not.toContain("copy('games.correct') ===");
  });
});
