import {
  ArcadeGame,
  startGameSession,
  submitGameScore,
  VerifiedGameSession,
} from '../../services/gamificationService';
import {isPracticeGame} from './gameRoutes';
import {notifyGoldBalanceChanged} from '../../services/goldBalanceEvents';
import {extractServerGoldBalance} from '../../services/goldListeningService';
import {Analytics} from '../../services/analyticsService';
import NetInfo, {NetInfoState} from '@react-native-community/netinfo';

const verifiedRounds = new Map<string, Promise<VerifiedGameSession | null>>();
const submittedPayloads = new Map<string, ReturnType<typeof buildGameScorePayload>>();
const MAX_RETAINED_ROUNDS = 100;

export function hasVerifiedInternet(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>) {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

async function canReachRewardServer() {
  try {
    return hasVerifiedInternet(await NetInfo.fetch());
  } catch {
    // An unavailable native signal is not proof of being offline. The server
    // remains the authority and will still verify (or reject) the session.
    return true;
  }
}

async function startOnlineVerifiedRound(game: ArcadeGame, clientRoundId: string) {
  if (!(await canReachRewardServer())) {
    return null;
  }
  return startGameSession(game.id, clientRoundId).catch(() => null);
}

export function createClientRoundId(game: ArcadeGame) {
  return `${game.slug || game.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function prepareVerifiedGameRound(game: ArcadeGame, clientRoundId: string) {
  Analytics.gameStarted(game.slug || String(game.id), isPracticeGame(game));
  if (isPracticeGame(game)) {
    return;
  }

  if (!verifiedRounds.has(clientRoundId)) {
    while (verifiedRounds.size >= MAX_RETAINED_ROUNDS) {
      const oldest = verifiedRounds.keys().next().value as string;
      verifiedRounds.delete(oldest);
      submittedPayloads.delete(oldest);
    }
    verifiedRounds.set(clientRoundId, startOnlineVerifiedRound(game, clientRoundId));
  }
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

export function getGameResultMessage(score: number, awardedGold: number, scoreLabel = 'Score') {
  return `${scoreLabel} ${Math.max(0, Math.floor(score))} · +${Math.max(0, Math.floor(awardedGold))} Gold`;
}

export async function submitMobileGameScore(params: {
  game: ArcadeGame;
  score: number;
  clientRoundId: string;
  startedAt: number;
}) {
  if (isPracticeGame(params.game)) {
    Analytics.gameCompleted(
      params.game.slug || String(params.game.id),
      params.score,
      Date.now() - params.startedAt,
      'practice',
    );
    return {points_awarded: 0, practice: true};
  }

  if (!(await canReachRewardServer())) {
    verifiedRounds.delete(params.clientRoundId);
    submittedPayloads.delete(params.clientRoundId);
    Analytics.gameCompleted(
      params.game.slug || String(params.game.id),
      params.score,
      Date.now() - params.startedAt,
      'offline',
    );
    return {points_awarded: 0, offline: true};
  }

  const proof = await verifiedRounds.get(params.clientRoundId);
  if (!proof) {
    throw new Error('Verified game session is unavailable');
  }
  const payload = submittedPayloads.get(params.clientRoundId) ?? buildGameScorePayload({
    ...params,
    sessionId: proof.session.id,
    nonce: proof.nonce,
  });
  submittedPayloads.set(params.clientRoundId, payload);
  let submitted = false;
  try {
    const result = await submitGameScore(params.game.id, payload);
    submitted = true;
    Analytics.gameCompleted(
      params.game.slug || String(params.game.id),
      params.score,
      payload.play_duration_ms,
      'verified',
    );
    const balance = extractServerGoldBalance(result);
    if (balance !== null) {
      notifyGoldBalanceChanged(balance);
    }
    const reward = result as {
      points_awarded?: unknown;
      pointsAwarded?: unknown;
      amount?: unknown;
    };
    const awarded = Number(
      reward.points_awarded ?? reward.pointsAwarded ?? reward.amount ?? 0,
    );
    if (Number.isFinite(awarded) && awarded > 0) {
      Analytics.goldEarned('game', awarded);
    }
    return result;
  } finally {
    // A transient failure must leave the original proof and exact payload
    // available to the result screen's Retry action. Do not start a new round.
    if (submitted) {
      verifiedRounds.delete(params.clientRoundId);
      submittedPayloads.delete(params.clientRoundId);
    }
  }
}
