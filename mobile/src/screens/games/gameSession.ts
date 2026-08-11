import {
  ArcadeGame,
  startGameSession,
  submitGameScore,
  VerifiedGameSession,
} from '../../services/gamificationService';

const verifiedRounds = new Map<string, Promise<VerifiedGameSession>>();

export function createClientRoundId(game: ArcadeGame) {
  const roundId = `${game.slug || game.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  verifiedRounds.set(roundId, startGameSession(game.id, roundId));
  return roundId;
}

export function buildGameScorePayload(params: {
  score: number;
  clientRoundId: string;
  startedAt: number;
  sessionId: string;
  nonce: string;
  now?: number;
}) {
  return {
    score: Math.max(0, Math.floor(params.score)),
    client_round_id: params.clientRoundId,
    play_duration_ms: Math.max(0, (params.now ?? Date.now()) - params.startedAt),
    submission_source: 'mobile_game' as const,
    session_id: params.sessionId,
    nonce: params.nonce,
  };
}

export function getGameResultMessage(score: number, awardedXp: number) {
  return `${Math.max(0, Math.floor(score))} skor · +${Math.max(0, Math.floor(awardedXp))} XP`;
}

export async function submitMobileGameScore(params: {
  game: ArcadeGame;
  score: number;
  clientRoundId: string;
  startedAt: number;
}) {
  const proof = await (verifiedRounds.get(params.clientRoundId)
    ?? startGameSession(params.game.id, params.clientRoundId));
  const payload = buildGameScorePayload({
    ...params,
    sessionId: proof.session.id,
    nonce: proof.nonce,
  });
  const result = await submitGameScore(params.game.id, payload);
  verifiedRounds.delete(params.clientRoundId);
  return result;
}
