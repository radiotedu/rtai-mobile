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

test('requestPairCode and verifyPairCode use official device pairing contract', async () => {
  const {requestPairCode, verifyPairCode} = require('../src/api');
  const calls = [];
  const responses = [
    {data: {code: 'ABCD-EFGH', expires_at: '2026-09-04T07:10:00.000Z', expires_in: 600}},
    {data: {access_token: 'pair-access-token', refresh_token: 'pair-refresh-token', user: {id: 42, display_name: 'RadioTEDU Dev', email: 'dev@tedu.edu.tr'}}},
  ];
  global.fetch = async (url, options = {}) => {
    calls.push({url, options});
    return {ok: true, status: 200, text: async () => JSON.stringify(responses.shift())};
  };

  const codeRes = await requestPairCode('dev@tedu.edu.tr', 'RadioTEDU Dev');
  assert.equal(codeRes.code, 'ABCD-EFGH');
  assert.equal(codeRes.expires_in, 600);
  assert.match(calls[0].url, /\/auth\/device\/code$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), {email: 'dev@tedu.edu.tr', display_name: 'RadioTEDU Dev'});

  // Verify passing unformatted 8-character code 'abcdefgh' formats to 'ABCD-EFGH'
  const user = await verifyPairCode('abcdefgh');
  assert.equal(user.display_name, 'RadioTEDU Dev');
  assert.match(calls[1].url, /\/auth\/device\/verify$/);
  assert.deepEqual(JSON.parse(calls[1].options.body), {code: 'ABCD-EFGH'});
});

test('initDeviceAuth and pollDeviceAuth use automated web device flow contract', async () => {
  const {initDeviceAuth, pollDeviceAuth} = require('../src/api');
  const calls = [];
  const responses = [
    {data: {device_token: 'tok-12345678901234567890123456789012', user_code: 'TEST-9999', verification_url: 'https://radiotedu.com/device?code=TEST-9999', expires_in: 600, interval: 2}},
    {data: {status: 'pending', seconds_left: 598}},
    {data: {status: 'approved', access_token: 'dev-acc', refresh_token: 'dev-ref', user: {id: 'u-1', display_name: 'Listener Alex'}}},
  ];
  global.fetch = async (url, options = {}) => {
    calls.push({url, options});
    return {ok: true, status: 200, text: async () => JSON.stringify(responses.shift())};
  };

  const init = await initDeviceAuth();
  assert.equal(init.userCode, 'TEST-9999');
  assert.equal(init.verificationUrl, 'https://radiotedu.com/device?code=TEST-9999');
  assert.match(calls[0].url, /\/auth\/device\/init$/);

  const pending = await pollDeviceAuth(init.deviceToken);
  assert.equal(pending.status, 'pending');
  assert.match(calls[1].url, /\/auth\/device\/poll$/);

  const approved = await pollDeviceAuth(init.deviceToken);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.user.display_name, 'Listener Alex');
  assert.match(calls[2].url, /\/auth\/device\/poll$/);
});

