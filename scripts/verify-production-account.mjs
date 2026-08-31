import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const DEFAULT_API_BASE = 'https://radiotedu.com/jukebox/api/v1';
const PLAYABLE_GAME_SLUGS = new Set(['snake', 'memory', 'tetris', 'rhythm-tap', 'word-guess']);

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is not an object.`);
  return value;
}

function arrayField(value, field, label) {
  if (Array.isArray(value)) return value;
  const rows = assertRecord(value, label)[field];
  if (!Array.isArray(rows)) throw new Error(`${label}.${field} is not an array.`);
  return rows;
}

function numberField(value, field, label) {
  const number = Number(assertRecord(value, label)[field]);
  if (!Number.isFinite(number)) throw new Error(`${label}.${field} is not numeric.`);
  return number;
}

export async function apiRequest(pathname, {
  apiBase = DEFAULT_API_BASE,
  body,
  fetchImpl = fetch,
  method = body === undefined ? 'GET' : 'POST',
  timeoutMs = 15_000,
  token,
} = {}) {
  if (!token) throw new Error('RADIOTEDU_E2E_ACCESS_TOKEN is required.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${apiBase.replace(/\/$/, '')}${pathname}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : {'Content-Type': 'application/json'}),
      },
      method,
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(`${pathname} returned non-JSON HTTP ${response.status}.`);
    }
    if (!response.ok) {
      const message = typeof payload?.message === 'string' ? `: ${payload.message.slice(0, 160)}` : '';
      throw new Error(`${pathname} returned HTTP ${response.status}${message}`);
    }
    return payload?.data ?? payload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyProductionAccount({
  apiBase = DEFAULT_API_BASE,
  avatarItemId,
  expectedAccountId,
  fetchImpl = fetch,
  marketItemId,
  mutate = false,
  token,
} = {}) {
  if (!expectedAccountId) throw new Error('RADIOTEDU_E2E_ACCOUNT_ID is required.');
  const request = (pathname, options = {}) => apiRequest(pathname, {apiBase, fetchImpl, token, ...options});

  const account = assertRecord(await request('/auth/me'), 'auth.me');
  if (String(account.id) !== String(expectedAccountId)) {
    throw new Error('Authenticated account does not match RADIOTEDU_E2E_ACCOUNT_ID.');
  }

  const [gamification, home, gamesPayload, marketPayload, eventsPayload, ticketsPayload, avatarCatalogPayload, avatar, library, chim] =
    await Promise.all([
      request('/gamification/me'),
      request('/gamification/home'),
      request('/gamification/games'),
      request('/gamification/market'),
      request('/gamification/events'),
      request('/gamification/events/my-tickets'),
      request('/study/avatar/catalog'),
      request('/study/avatar/me'),
      request('/gamification/study-room?room_id=library'),
      request('/gamification/study-room?room_id=chim-alan'),
    ]);

  const points = assertRecord(assertRecord(home, 'gamification.home').points, 'gamification.home.points');
  numberField(points, 'lifetime_points', 'gamification.home.points');
  numberField(points, 'spendable_points', 'gamification.home.points');
  assertRecord(gamification, 'gamification.me');
  const games = arrayField(gamesPayload, 'games', 'gamification.games');
  const market = arrayField(marketPayload, 'items', 'gamification.market');
  const events = arrayField(eventsPayload, 'events', 'gamification.events');
  const tickets = arrayField(ticketsPayload, 'tickets', 'gamification.tickets');
  const avatarCatalog = arrayField(avatarCatalogPayload, 'items', 'study.avatar.catalog');
  assertRecord(avatar, 'study.avatar.me');
  assertRecord(library, 'study.room.library');
  assertRecord(chim, 'study.room.chim-alan');

  const checks = [
    'authentication', 'gold-profile', 'gold-home', 'games', 'market', 'events',
    'tickets', 'avatar-catalog', 'avatar-profile', 'library-presence', 'chim-presence',
  ];

  if (mutate) {
    const game = games.find(candidate =>
      typeof candidate?.id === 'string' && PLAYABLE_GAME_SLUGS.has(String(candidate?.slug ?? '').toLowerCase()),
    );
    if (!game) throw new Error('No production game maps to a playable mobile route.');
    const clientRoundId = `e2e-${randomUUID()}`;
    const gameStarted = assertRecord(await request(`/gamification/games/${encodeURIComponent(game.id)}/start`, {
      body: {
        client_round_id: clientRoundId,
        submission_source: 'mobile_game',
      },
    }), 'gamification.game.start');
    const gameSession = assertRecord(gameStarted.session, 'gamification.game.start.session');
    if (typeof gameSession.id !== 'string' || typeof gameStarted.nonce !== 'string') {
      throw new Error('Game start did not return a session id and nonce.');
    }
    const minimumPlaySeconds = Number(gameStarted.minimum_play_seconds ?? 0);
    if (!Number.isFinite(minimumPlaySeconds) || minimumPlaySeconds < 0 || minimumPlaySeconds > 120) {
      throw new Error('Game start returned an invalid minimum play duration.');
    }
    const verifiedPlayDurationMs = Math.max(10_000, Math.ceil(minimumPlaySeconds + 1) * 1_000);
    if (minimumPlaySeconds > 0) {
      await new Promise(resolve => setTimeout(resolve, verifiedPlayDurationMs));
    }
    const gameResult = assertRecord(await request(`/gamification/games/${encodeURIComponent(game.id)}/score`, {
      body: {
        score: 1,
        client_round_id: clientRoundId,
        play_duration_ms: verifiedPlayDurationMs,
        submission_source: 'mobile_game',
        session_id: gameSession.id,
        nonce: gameStarted.nonce,
      },
    }), 'gamification.game.score');
    const awardedGold = numberField(gameResult, 'points_awarded', 'gamification.game.score');
    if (awardedGold <= 0) throw new Error('Production game awarded no Gold.');
    const afterGame = assertRecord(await request('/gamification/home'), 'gamification.home.after-game');
    const afterGamePoints = assertRecord(afterGame.points, 'gamification.home.after-game.points');
    const beforeLifetime = numberField(points, 'lifetime_points', 'gamification.home.points');
    const afterLifetime = numberField(afterGamePoints, 'lifetime_points', 'gamification.home.after-game.points');
    if (afterLifetime < beforeLifetime + awardedGold) {
      throw new Error('Game Gold did not persist in the account balance.');
    }
    checks.push('game-score-award');

    const started = assertRecord(await request('/study/sessions/start', {
      body: {location: 'library', clientSessionId: `e2e-${randomUUID()}`, sessionType: 'study'},
    }), 'study.session.start');
    const session = assertRecord(started.session, 'study.session.start.session');
    if (typeof session.id !== 'string' || typeof started.nonce !== 'string') {
      throw new Error('Study start did not return a session id and nonce.');
    }
    const heartbeat = assertRecord(await request(`/study/sessions/${encodeURIComponent(session.id)}/heartbeat`, {
      body: {
        nonce: started.nonce,
        focused: true,
        foreground: true,
        position: {x: 0, y: 0},
        interaction: 'idle',
      },
    }), 'study.session.heartbeat');
    if (typeof heartbeat.nonce !== 'string') throw new Error('Study heartbeat did not rotate the nonce.');
    await request(`/study/sessions/${encodeURIComponent(session.id)}/finish`, {body: {nonce: heartbeat.nonce}});
    checks.push('study-session-award');

    if (avatarItemId) {
      const item = avatarCatalog.find(candidate => candidate?.itemId === avatarItemId);
      if (!item || typeof item.slot !== 'string') throw new Error('Configured E2E avatar item is absent from the catalog.');
      const before = assertRecord(await request('/study/avatar/me'), 'study.avatar.before');
      const owned = Array.isArray(before.ownedItemIds) && before.ownedItemIds.includes(avatarItemId);
      if (!owned) await request('/study/avatar/purchase', {body: {itemId: avatarItemId}});
      await request('/study/avatar/equip', {body: {slot: item.slot, itemId: avatarItemId}});
      const after = assertRecord(await request('/study/avatar/me'), 'study.avatar.after');
      if (!Array.isArray(after.ownedItemIds) || !after.ownedItemIds.includes(avatarItemId)) {
        throw new Error('Avatar purchase did not persist ownership.');
      }
      if (assertRecord(after.equipped ?? {}, 'study.avatar.after.equipped')[item.slot] !== avatarItemId) {
        throw new Error('Avatar equip did not persist.');
      }
      checks.push('avatar-purchase-equip-persistence');
    }

    if (marketItemId) {
      const item = market.find(candidate => String(candidate?.id) === String(marketItemId));
      if (!item) throw new Error('Configured E2E market item is absent from the market.');
      const redeemed = await request(`/gamification/market/${encodeURIComponent(marketItemId)}/redeem`, {
        body: {idempotency_key: `e2e-${randomUUID()}`},
      });
      numberField(redeemed, 'spendable_points', 'gamification.market.redeem');
      checks.push('market-gold-spend');
    }

    const after = assertRecord(await request('/gamification/home'), 'gamification.home.after');
    numberField(assertRecord(after.points, 'gamification.home.after.points'), 'spendable_points', 'gamification.home.after.points');
    checks.push('gold-persistence');
  }

  return {
    checks,
    counts: {avatarItems: avatarCatalog.length, events: events.length, games: games.length, market: market.length, tickets: tickets.length},
    mutated: mutate,
  };
}

const scriptPath = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? '') === scriptPath) {
  const result = await verifyProductionAccount({
    avatarItemId: process.env.RADIOTEDU_E2E_AVATAR_ITEM_ID,
    expectedAccountId: process.env.RADIOTEDU_E2E_ACCOUNT_ID,
    marketItemId: process.env.RADIOTEDU_E2E_MARKET_ITEM_ID,
    mutate: process.env.RADIOTEDU_E2E_MUTATE === 'true',
    token: process.env.RADIOTEDU_E2E_ACCESS_TOKEN,
  });
  console.log(`PASS | production account | ${result.checks.length} checks | mutate=${result.mutated}`);
  console.log(`INFO | catalog counts | games=${result.counts.games} market=${result.counts.market} events=${result.counts.events} avatar=${result.counts.avatarItems} tickets=${result.counts.tickets}`);
}
