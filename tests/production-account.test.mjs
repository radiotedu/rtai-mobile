import assert from 'node:assert/strict';
import test from 'node:test';

import {verifyProductionAccount} from '../scripts/verify-production-account.mjs';

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify({data: payload}),
  };
}

function productionApiMock({accountId = 'account-1'} = {}) {
  const calls = [];
  let avatarPurchased = false;
  let lifetimePoints = 120;
  const fetchImpl = async (url, options) => {
    const {pathname, search} = new URL(url);
    const endpoint = `${pathname.replace('/jukebox/api/v1', '')}${search}`;
    calls.push({endpoint, options});
    assert.equal(options.headers.Authorization, 'Bearer test-token');

    const fixtures = {
      '/auth/me': {id: accountId},
      '/gamification/me': {account_id: accountId},
      '/gamification/games': {games: [{id: 'game-1', slug: 'snake'}]},
      '/gamification/market': {items: [{id: 'market-1'}]},
      '/gamification/events': {events: [{id: 'event-1'}]},
      '/gamification/events/my-tickets': {tickets: []},
      '/study/avatar/catalog': {items: [{itemId: 'avatar-1', slot: 'top'}]},
      '/gamification/study-room?room_id=library': {room: {id: 'library'}},
      '/gamification/study-room?room_id=chim-alan': {room: {id: 'chim-alan'}},
    };
    if (endpoint === '/gamification/home') {
      return jsonResponse({points: {lifetime_points: lifetimePoints, spendable_points: 100}});
    }
    if (endpoint === '/study/avatar/me') {
      return jsonResponse({ownedItemIds: avatarPurchased ? ['avatar-1'] : [], equipped: avatarPurchased ? {top: 'avatar-1'} : {}});
    }
    if (endpoint === '/gamification/games/game-1/start') {
      return jsonResponse({session: {id: 'game-session-1'}, nonce: 'game-nonce-1'});
    }
    if (endpoint === '/gamification/games/game-1/score') {
      lifetimePoints += 1;
      return jsonResponse({points_awarded: 1});
    }
    if (endpoint === '/study/sessions/start') return jsonResponse({session: {id: 'session-1'}, nonce: 'nonce-1'});
    if (endpoint === '/study/sessions/session-1/heartbeat') return jsonResponse({session: {id: 'session-1'}, nonce: 'nonce-2'});
    if (endpoint === '/study/sessions/session-1/finish') return jsonResponse({awarded_points: 1});
    if (endpoint === '/study/avatar/purchase') {
      avatarPurchased = true;
      return jsonResponse({ownedItemIds: ['avatar-1']});
    }
    if (endpoint === '/study/avatar/equip') return jsonResponse({equipped: {top: 'avatar-1'}});
    if (endpoint === '/gamification/market/market-1/redeem') return jsonResponse({spendable_points: 99});
    if (endpoint in fixtures) return jsonResponse(fixtures[endpoint]);
    return jsonResponse({message: `Unexpected ${endpoint}`}, 404);
  };
  return {calls, fetchImpl};
}

test('authenticated read-only smoke covers production account features', async () => {
  const mock = productionApiMock();
  const result = await verifyProductionAccount({
    expectedAccountId: 'account-1',
    fetchImpl: mock.fetchImpl,
    token: 'test-token',
  });

  assert.equal(result.mutated, false);
  assert.equal(result.checks.length, 11);
  assert.deepEqual(result.counts, {avatarItems: 1, events: 1, games: 1, market: 1, tickets: 0});
  assert.equal(mock.calls.every(call => call.options.method === 'GET'), true);
});

test('account guard stops a token for the wrong account before mutation', async () => {
  const mock = productionApiMock({accountId: 'somebody-else'});
  await assert.rejects(
    verifyProductionAccount({expectedAccountId: 'account-1', fetchImpl: mock.fetchImpl, mutate: true, token: 'test-token'}),
    /does not match/,
  );
  assert.deepEqual(mock.calls.map(call => call.endpoint), ['/auth/me']);
});

test('explicit mutation mode verifies Gold awards, spend, avatar, and Study persistence', async () => {
  const mock = productionApiMock();
  const result = await verifyProductionAccount({
    avatarItemId: 'avatar-1',
    expectedAccountId: 'account-1',
    fetchImpl: mock.fetchImpl,
    marketItemId: 'market-1',
    mutate: true,
    token: 'test-token',
  });

  assert.equal(result.mutated, true);
  assert.equal(result.checks.includes('game-score-award'), true);
  assert.equal(result.checks.includes('study-session-award'), true);
  assert.equal(result.checks.includes('avatar-purchase-equip-persistence'), true);
  assert.equal(result.checks.includes('market-gold-spend'), true);
  assert.equal(result.checks.includes('gold-persistence'), true);
  const gameStart = mock.calls.find(call => call.endpoint === '/gamification/games/game-1/start');
  const gameScore = mock.calls.find(call => call.endpoint === '/gamification/games/game-1/score');
  assert.equal(typeof JSON.parse(gameStart.options.body).client_round_id, 'string');
  assert.equal(JSON.parse(gameScore.options.body).session_id, 'game-session-1');
  assert.equal(JSON.parse(gameScore.options.body).nonce, 'game-nonce-1');
  assert.equal(mock.calls.some(call => call.endpoint === '/study/avatar/purchase'), true);
});

test('mutation refuses catalog games that the mobile UI cannot launch', async () => {
  const mock = productionApiMock();
  const fetchImpl = async (url, options) => {
    const endpoint = new URL(url).pathname.replace('/jukebox/api/v1', '');
    if (endpoint === '/gamification/games') {
      return jsonResponse({games: [{id: 'unknown-game', slug: 'not-in-mobile'}]});
    }
    return mock.fetchImpl(url, options);
  };
  await assert.rejects(
    verifyProductionAccount({expectedAccountId: 'account-1', fetchImpl, mutate: true, token: 'test-token'}),
    /playable mobile route/,
  );
});
