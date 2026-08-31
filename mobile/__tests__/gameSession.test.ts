import {beforeEach, describe, expect, it, jest} from '@jest/globals';

jest.mock('../src/services/gamificationService', () => ({
  startGameSession: jest.fn(),
  submitGameScore: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {fetch: jest.fn()},
}));

import {
  buildGameScorePayload,
  getGameResultMessage,
  hasVerifiedInternet,
  prepareVerifiedGameRound,
  submitMobileGameScore,
} from '../src/screens/games/gameSession';
import {startGameSession, submitGameScore} from '../src/services/gamificationService';
import NetInfo from '@react-native-community/netinfo';

describe('gameSession helpers', () => {
  beforeEach(() => {
    jest.mocked(NetInfo.fetch).mockReset();
    jest.mocked(NetInfo.fetch).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    } as never);
  });

  it('requires an explicitly connected and internet-reachable network for Gold', () => {
    expect(hasVerifiedInternet({isConnected: true, isInternetReachable: true} as never)).toBe(true);
    expect(hasVerifiedInternet({isConnected: false, isInternetReachable: true} as never)).toBe(false);
    expect(hasVerifiedInternet({isConnected: true, isInternetReachable: false} as never)).toBe(false);
    expect(hasVerifiedInternet({isConnected: null, isInternetReachable: null} as never)).toBe(true);
  });
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

  it('submits a server-registered bundled game through the verified Gold flow', async () => {
    jest.mocked(startGameSession).mockClear();
    jest.mocked(submitGameScore).mockClear();
    const game = {
      id: 'server-game-123',
      slug: 'snake',
      title: 'Snake',
      point_rate: 10,
      daily_point_limit: 500,
      metadata: {rewards_enabled: true, awards_gold: true},
    };

    jest.mocked(startGameSession).mockResolvedValue({
      session: {
        id: 'session-1',
        game_id: game.id,
        client_round_id: 'verified-round',
        started_at: new Date(1).toISOString(),
      },
      nonce: 'nonce-1',
      minimum_play_seconds: 3,
      expires_after_seconds: 1200,
    });
    jest.mocked(submitGameScore).mockResolvedValue({
      points_awarded: 3,
      spendable_points: 23,
    } as never);

    prepareVerifiedGameRound(game, 'verified-round');
    await expect(
      submitMobileGameScore({
        game,
        score: 250,
        clientRoundId: 'verified-round',
        startedAt: 1,
      }),
    ).resolves.toEqual({points_awarded: 3, spendable_points: 23});
    expect(startGameSession).toHaveBeenCalledWith(game.id, 'verified-round');
    expect(submitGameScore).toHaveBeenCalledWith(
      game.id,
      expect.objectContaining({
        score: 250,
        client_round_id: 'verified-round',
        session_id: 'session-1',
        nonce: 'nonce-1',
      }),
    );
  });

  it('does not create or submit a Gold session while offline', async () => {
    jest.mocked(startGameSession).mockClear();
    jest.mocked(submitGameScore).mockClear();
    jest.mocked(NetInfo.fetch).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as never);
    const game = {
      id: 'server-game-offline',
      slug: 'tetris',
      title: 'Tetris',
      point_rate: 10,
      daily_point_limit: 500,
      metadata: {rewards_enabled: true, awards_gold: true},
    };

    prepareVerifiedGameRound(game, 'offline-round');
    await expect(
      submitMobileGameScore({
        game,
        score: 100,
        clientRoundId: 'offline-round',
        startedAt: 1,
      }),
    ).resolves.toEqual({points_awarded: 0, offline: true});
    expect(startGameSession).not.toHaveBeenCalled();
    expect(submitGameScore).not.toHaveBeenCalled();
  });
});
