import {describe, expect, it} from '@jest/globals';

import {getWordGuessQuestions} from '../src/i18n/gameQuestions';

describe('music guessing catalog', () => {
  it('ships 256 valid questions and localizes their prompts', () => {
    const english = getWordGuessQuestions('en');
    const turkish = getWordGuessQuestions('tr');
    expect(english).toHaveLength(256);
    expect(turkish).toHaveLength(256);
    for (const question of english) {
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
      expect(question.options).toContain(question.answer);
    }
    expect(turkish[0].prompt).not.toBe(english[0].prompt);
  });
});
