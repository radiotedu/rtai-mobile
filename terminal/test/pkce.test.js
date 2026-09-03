const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'radiotedu-pkce-test-'));
process.env.APPDATA = tempRoot;

const {
  isVerifier,
  deriveS256CodeChallenge,
  beginPendingErpLoginPkce,
  getPendingErpLoginPkce,
  clearPendingErpLoginPkce,
} = require('../src/pkce');
const {validateAuthorizationUrl} = require('../src/api');

test.after(() => fs.rmSync(tempRoot, {recursive: true, force: true}));

test('PKCE S256 challenge matches RFC 7636 vector', () => {
  assert.equal(
    deriveS256CodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  );
  assert.throws(() => deriveS256CodeChallenge('short'), /Invalid PKCE verifier/);
});

test('PKCE pending login round-trips through secure store', () => {
  const pending = beginPendingErpLoginPkce();
  assert.ok(isVerifier(pending.verifier));
  assert.equal(pending.method, 'S256');
  assert.equal(pending.codeChallenge, deriveS256CodeChallenge(pending.verifier));
  assert.deepEqual(getPendingErpLoginPkce(), {verifier: pending.verifier, createdAt: pending.createdAt});
  assert.equal(clearPendingErpLoginPkce(pending.verifier), true);
  assert.equal(getPendingErpLoginPkce(), null);
});

test('PKCE pending login expires after 10 minutes', () => {
  const pending = beginPendingErpLoginPkce(1000);
  assert.equal(getPendingErpLoginPkce(1000 + 10 * 60 * 1000 + 1), null);
  assert.equal(getPendingErpLoginPkce(), null);
  assert.ok(pending.verifier);
});

test('authorize URL validator rejects the broken client_id-only URL', () => {
  assert.throws(
    () => validateAuthorizationUrl('https://radiotedu.com/erp/oauth/authorize?client_id=019f89b5-3e0a-73e3-94b7-3c4bcc775925'),
    /response_type/,
  );
});

test('authorize URL validator accepts a complete PKCE URL', () => {
  const url = 'https://radiotedu.com/erp/oauth/authorize?response_type=code&client_id=abc&redirect_uri=radiotedu%3A%2F%2Fauth%2Ferp%2Flinked&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&state=xyz';
  assert.equal(validateAuthorizationUrl(url), url);
  assert.throws(() => validateAuthorizationUrl('http://radiotedu.com/erp/oauth/authorize'), /https/);
  assert.throws(() => validateAuthorizationUrl('https://evil.example/erp/oauth/authorize'), /host/);
});

test('startErpLogin sends PKCE challenge and exchange sends verifier', async () => {
  const {startErpLogin, exchangeErpCode} = require('../src/api');
  const bodies = [];
  global.fetch = async (url, options = {}) => {
    bodies.push({url, body: JSON.parse(options.body)});
    if (url.endsWith('/auth/erp-link/login/start')) {
      return {ok: true, status: 200, text: async () => JSON.stringify({data: {authorization_url: 'https://x'}})};
    }
    return {ok: true, status: 200, text: async () => JSON.stringify({data: {access_token: 'a', refresh_token: 'r', user: {display_name: 'T'}}})};
  };
  await startErpLogin('radiotedu://auth/erp/linked', {codeChallenge: 'CHAL', method: 'S256'});
  assert.deepEqual(bodies[0].body, {
    return_uri: 'radiotedu://auth/erp/linked',
    code_challenge: 'CHAL',
    code_challenge_method: 'S256',
  });
  await exchangeErpCode('CODE123', 'VERIFIER123');
  assert.deepEqual(bodies[1].body, {code: 'CODE123', code_verifier: 'VERIFIER123'});
});
