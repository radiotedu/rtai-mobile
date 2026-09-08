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
  it('retains the original online round and score across an offline result retry', async () => {
    const game = {id: 'online-memory', slug: 'memory', title: 'Memory', daily_point_limit: 20};
    jest.mocked(startGameSession).mockResolvedValue({session: {id: 'proof-offline', game_id: game.id,
      client_round_id: 'interrupted-round', started_at: new Date().toISOString()},
      nonce: 'nonce-offline', minimum_play_seconds: 3, expires_after_seconds: 1200});
    await prepareVerifiedGameRound(game, 'interrupted-round');
    jest.mocked(submitGameScore).mockClear();
    jest.mocked(NetInfo.fetch).mockResolvedValue({isConnected: false, isInternetReachable: false} as never);
    const params = {game, score: 300, clientRoundId: 'interrupted-round', startedAt: Date.now() - 5000};
    await expect(submitMobileGameScore(params)).rejects.toThrow('Offline');
    expect(submitGameScore).not.toHaveBeenCalled();
    jest.mocked(NetInfo.fetch).mockResolvedValue({isConnected: true, isInternetReachable: true} as never);
    jest.mocked(submitGameScore).mockResolvedValue({points_awarded: 2} as never);
    await submitMobileGameScore({...params, score: 900});
    expect(submitGameScore).toHaveBeenCalledWith(game.id, expect.objectContaining({
      score: 300, session_id: 'proof-offline', nonce: 'nonce-offline', client_round_id: 'interrupted-round',
    }));
  });
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

  it('retries a failed submission with the same proof and frozen score payload', async () => {
    jest.mocked(startGameSession).mockClear();
    jest.mocked(submitGameScore).mockReset();
    const game = {id: 'retry-game', slug: 'snake', title: 'Snake'};
    jest.mocked(startGameSession).mockResolvedValue({
      session: {id: 'retry-proof', game_id: game.id, client_round_id: 'retry-round', started_at: new Date(1).toISOString()},
      nonce: 'retry-nonce', minimum_play_seconds: 3, expires_after_seconds: 1200,
    });
    jest.mocked(submitGameScore).mockRejectedValueOnce(new Error('temporary network failure'));
    prepareVerifiedGameRound(game, 'retry-round');
    const submission = {game, score: 250, clientRoundId: 'retry-round', startedAt: 1};
    await expect(submitMobileGameScore(submission)).rejects.toThrow('temporary network failure');
    const originalPayload = jest.mocked(submitGameScore).mock.calls[0][1];
    jest.mocked(submitGameScore).mockResolvedValueOnce({points_awarded: 3, spendable_points: 23} as never);
    await expect(submitMobileGameScore({...submission, score: 999})).resolves.toEqual({points_awarded: 3, spendable_points: 23});
    expect(startGameSession).toHaveBeenCalledTimes(1);
    expect(jest.mocked(submitGameScore).mock.calls[1][1]).toEqual(originalPayload);
    await expect(submitMobileGameScore(submission)).rejects.toThrow('Verified game session is unavailable');
    expect(submitGameScore).toHaveBeenCalledTimes(2);
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
    ).rejects.toThrow('Offline');
    expect(startGameSession).not.toHaveBeenCalled();
    expect(submitGameScore).not.toHaveBeenCalled();
  });
});
