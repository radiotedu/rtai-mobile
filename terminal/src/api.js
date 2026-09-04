const {loadAuth, saveAuth, clearAuth} = require('./store');

const API_BASE = (process.env.RADIOTEDU_API_BASE || 'https://radiotedu.com/jukebox/api/v1').replace(/\/$/, '');
let refreshPromise = null;

function unwrap(payload) {
  return payload && payload.data !== undefined ? payload.data : payload;
}

async function refreshSession(auth) {
  if (!auth?.refresh_token) throw new Error('No refresh token available.');
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
    body: JSON.stringify({refresh_token: auth.refresh_token}),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `Session refresh failed (${response.status})`);
  const session = unwrap(payload);
  if (!session?.access_token || !session?.refresh_token) throw new Error('Session refresh response was invalid.');
  saveAuth({...auth, access_token: session.access_token, refresh_token: session.refresh_token, user: session.user || auth.user || null});
  return loadAuth();
}

async function request(path, options = {}, retried = false) {
  const auth = loadAuth();
  const headers = {'Accept': 'application/json', 'User-Agent': 'radiotedu-tui/1.3.5', ...(options.body ? {'Content-Type': 'application/json'} : {}), ...(options.headers || {})};
  if (auth?.access_token) headers.Authorization = `Bearer ${auth.access_token}`;
  const response = await fetch(`${API_BASE}${path}`, {...options, headers});
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = {raw: text}; }
  if (response.status === 401 && auth && !retried && !path.includes('/auth/refresh')) {
    try {
      refreshPromise ||= refreshSession(auth);
      await refreshPromise;
      refreshPromise = null;
      return request(path, options, true);
    } catch (error) {
      refreshPromise = null;
      clearAuth();
      throw error;
    }
  }
  if (!response.ok) {
    if (response.status === 401 && auth) clearAuth();
    throw new Error(payload?.error || payload?.message || `RadioTEDU API returned ${response.status}`);
  }
  return unwrap(payload);
}

async function login(email, password) {
  const session = await request('/auth/login', {method: 'POST', body: JSON.stringify({email, password})});
  if (!session?.access_token || !session?.refresh_token) throw new Error('Login response did not contain a valid session.');
  saveAuth({access_token: session.access_token, refresh_token: session.refresh_token, user: session.user || null});
  return session.user || await me();
}

async function me() { return request('/auth/me'); }
async function gamificationHome() { return request('/gamification/home'); }

async function startListening(channelId, clientSessionId) {
  return request('/economy/listening/start', {method: 'POST', body: JSON.stringify({channel_id: channelId, client_session_id: clientSessionId})});
}

async function heartbeatListening(sessionId, nonce) {
  return request('/economy/listening/heartbeat', {method: 'POST', body: JSON.stringify({session_id: sessionId, nonce, is_playing: true})});
}

async function logout() {
  try { await request('/auth/logout', {method: 'POST'}); } finally { clearAuth(); }
}

async function startErpLogin(returnUri, pkce) {
  return request('/auth/erp-link/login/start', {method: 'POST', body: JSON.stringify({
    return_uri: returnUri,
    ...(pkce ? {code_challenge: pkce.codeChallenge, code_challenge_method: pkce.method} : {}),
  })});
}

function validateAuthorizationUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw new Error('ERP login did not return a valid authorization URL.');
  }
  if (parsed.protocol !== 'https:') throw new Error('ERP authorize URL must use https.');
  if (parsed.hostname !== 'radiotedu.com') throw new Error('ERP authorize URL has an unexpected host.');
  if (parsed.pathname !== '/erp/oauth/authorize') throw new Error('ERP authorize URL has an unexpected path.');
  if (parsed.searchParams.get('response_type') !== 'code') {
    throw new Error('ERP authorize URL is missing response_type=code. Start login again so the TUI sends its PKCE code_challenge.');
  }
  if (!parsed.searchParams.get('client_id')) throw new Error('ERP authorize URL is missing client_id.');
  if (!parsed.searchParams.get('code_challenge')) {
    throw new Error('ERP authorize URL is missing code_challenge. Start login again so the TUI sends its PKCE code_challenge.');
  }
  return parsed.toString();
}

async function exchangeErpCode(code, codeVerifier) {
  const session = await request('/auth/erp-link/login/exchange', {method: 'POST', body: JSON.stringify({
    code,
    ...(codeVerifier ? {code_verifier: codeVerifier} : {}),
  })});
  if (!session?.access_token || !session?.refresh_token) throw new Error('ERP login response did not contain a valid session.');
  saveAuth({access_token: session.access_token, refresh_token: session.refresh_token, user: session.user || null});
  return session.user || await me();
}

async function verifyPairCode(code) {
  const normalized = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formatted = normalized.length === 8 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : code.trim();
  const session = await request('/auth/device/verify', {method: 'POST', body: JSON.stringify({
    code: formatted,
  })});
  if (!session?.access_token || !session?.refresh_token) throw new Error('Eşleme kodu doğrulanamadı veya süresi doldu.');
  saveAuth({access_token: session.access_token, refresh_token: session.refresh_token, user: session.user || null});
  return session.user || await me();
}

async function startStudySession(location, clientSessionId, targetMinutes) {
  return request('/study/sessions/start', {method: 'POST', body: JSON.stringify({location, clientSessionId, sessionType: 'study', ...(targetMinutes ? {pomodoroTargetMinutes: targetMinutes} : {})})});
}

async function heartbeatStudySession(sessionId, nonce, studiedSecondsDelta) {
  return request(`/study/sessions/${encodeURIComponent(sessionId)}/heartbeat`, {method: 'POST', body: JSON.stringify({nonce, focused: true, foreground: true, position: {x: 0, y: 0}, interaction: 'seated', studiedSecondsDelta})});
}

async function finishStudySession(sessionId, nonce) {
  return request(`/study/sessions/${encodeURIComponent(sessionId)}/finish`, {method: 'POST', body: JSON.stringify({nonce})});
}

async function requestPairCode(email, displayName = 'RadioTEDU Terminal') {
  return request('/auth/device/code', {
    method: 'POST',
    body: JSON.stringify({email, display_name: displayName}),
  });
}

module.exports = {API_BASE, request, login, me, gamificationHome, startListening, heartbeatListening, logout, startErpLogin, validateAuthorizationUrl, exchangeErpCode, requestPairCode, verifyPairCode, startStudySession, heartbeatStudySession, finishStudySession};
