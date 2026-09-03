const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {dataDir} = require('./store');

const PKCE_FILE = 'erp-pkce.json';
const PKCE_MAX_AGE_MS = 10 * 60 * 1000;
const PKCE_METHOD = 'S256';

function pkceFilePath() {
  return path.join(dataDir(), PKCE_FILE);
}

function isVerifier(value) {
  return typeof value === 'string' && /^[A-Za-z0-9\-._~]{43,128}$/.test(value);
}

function base64UrlEncode(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createVerifier() {
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  if (!isVerifier(verifier)) throw new Error('Secure PKCE verifier generation failed');
  return verifier;
}

function deriveS256CodeChallenge(verifier) {
  if (!isVerifier(verifier)) throw new Error('Invalid PKCE verifier');
  return base64UrlEncode(crypto.createHash('sha256').update(verifier, 'utf8').digest());
}

function readStoredPending() {
  try {
    const parsed = JSON.parse(fs.readFileSync(pkceFilePath(), 'utf8'));
    if (
      parsed
      && Object.keys(parsed).sort().join(',') === 'createdAt,verifier'
      && isVerifier(parsed.verifier)
      && Number.isSafeInteger(parsed.createdAt)
      && Number(parsed.createdAt) > 0
    ) {
      return {verifier: parsed.verifier, createdAt: Number(parsed.createdAt)};
    }
  } catch {}
  return null;
}

function beginPendingErpLoginPkce(now = Date.now()) {
  if (!Number.isSafeInteger(now) || now <= 0) throw new Error('Invalid PKCE creation time');
  const verifier = createVerifier();
  const pending = {verifier, createdAt: now};
  fs.mkdirSync(dataDir(), {recursive: true, mode: 0o700});
  fs.writeFileSync(pkceFilePath(), `${JSON.stringify(pending, null, 2)}\n`, {mode: 0o600});
  try { fs.chmodSync(pkceFilePath(), 0o600); } catch {}
  return {...pending, codeChallenge: deriveS256CodeChallenge(verifier), method: PKCE_METHOD};
}

function getPendingErpLoginPkce(now = Date.now()) {
  const pending = readStoredPending();
  if (!pending) return null;
  const age = now - pending.createdAt;
  if (age < 0 || age > PKCE_MAX_AGE_MS) {
    clearPendingErpLoginPkce(pending.verifier);
    return null;
  }
  return pending;
}

function clearPendingErpLoginPkce(expectedVerifier) {
  if (expectedVerifier) {
    const current = readStoredPending();
    if (!current || current.verifier !== expectedVerifier) return false;
  }
  try { fs.unlinkSync(pkceFilePath()); } catch {}
  return true;
}

module.exports = {
  PKCE_MAX_AGE_MS,
  PKCE_METHOD,
  isVerifier,
  deriveS256CodeChallenge,
  beginPendingErpLoginPkce,
  getPendingErpLoginPkce,
  clearPendingErpLoginPkce,
};
