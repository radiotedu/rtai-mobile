const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'radiotedu-terminal-test-'));
process.env.APPDATA = tempRoot;

const {login, gamificationHome, startListening, heartbeatListening} = require('../src/api');

test.after(() => fs.rmSync(tempRoot, {recursive: true, force: true}));

test('login, Gold balance and verified listening use existing production contracts', async () => {
  const calls = [];
  const responses = [
    {data: {access_token: 'access-test', refresh_token: 'refresh-test', user: {display_name: 'Test'}}},
    {data: {points: {spendable_points: 25}}},
    {data: {session: {id: 'listen-1'}, nonce: 'nonce-1', heartbeat_after_seconds: 25}},
    {data: {session_id: 'listen-1', nonce: 'nonce-2', reward: {applied: true, awarded: 1, spendablePoints: 26}}},
  ];
  global.fetch = async (url, options = {}) => {
    calls.push({url, options});
    return {ok: true, status: 200, text: async () => JSON.stringify(responses.shift())};
  };

  assert.equal((await login('listener@example.test', 'not-a-real-password')).display_name, 'Test');
  assert.equal((await gamificationHome()).points.spendable_points, 25);
  assert.equal((await startListening('radio', 'terminal-session')).nonce, 'nonce-1');
  assert.equal((await heartbeatListening('listen-1', 'nonce-1')).nonce, 'nonce-2');

  assert.match(calls[0].url, /\/auth\/login$/);
  assert.equal(JSON.parse(calls[2].options.body).channel_id, 'radio');
  assert.deepEqual(JSON.parse(calls[3].options.body), {session_id: 'listen-1', nonce: 'nonce-1', is_playing: true});
  assert.equal(calls[1].options.headers.Authorization, 'Bearer access-test');
});
