import {describe, expect, it, jest} from '@jest/globals';

jest.mock('../src/services/gamificationService', () => ({
  startGameSession: jest.fn(),
  submitGameScore: jest.fn(),
}));

import {
  buildGameScorePayload,
  getGameResultMessage,
  prepareVerifiedGameRound,
  submitMobileGameScore,
} from '../src/screens/games/gameSession';
import {startGameSession, submitGameScore} from '../src/services/gamificationService';

describe('gameSession helpers', () => {
  it('builds the required mobile game score payload with sanitized values', () => {
    expect(
      buildGameScorePayload({
        score: 42.9,
        clientRoundId: 'round-1',
        startedAt: 1000,
        sessionId: 'session-1',
        nonce: 'nonce-1',
        now: 5600,
      }),
    ).toEqual({
      score: 42,
      client_round_id: 'round-1',
      play_duration_ms: 4600,
      submission_source: 'mobile_game',
      session_id: 'session-1',
      nonce: 'nonce-1',
    });
  });

  it('formats localized Gold result messages without hiding zero awards', () => {
    expect(getGameResultMessage(120, 8)).toBe('Score 120 · +8 Gold');
    expect(getGameResultMessage(0, 0, 'Skor')).toBe('Skor 0 · +0 Gold');
  });

  it('keeps bundled practice rounds offline and reward-free', async () => {
    jest.mocked(startGameSession).mockClear();
    jest.mocked(submitGameScore).mockClear();
    const game = {
      id: 'builtin:snake',
      slug: 'snake',
      title: 'Snake',
    };

    prepareVerifiedGameRound(game, 'practice-round');
    await expect(
      submitMobileGameScore({
        game,
        score: 250,
        clientRoundId: 'practice-round',
        startedAt: 1,
      }),
    ).resolves.toEqual({points_awarded: 0, practice: true});
    expect(startGameSession).not.toHaveBeenCalled();
    expect(submitGameScore).not.toHaveBeenCalled();
  });
});
