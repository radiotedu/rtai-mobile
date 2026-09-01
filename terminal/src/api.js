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
  const headers = {'Accept': 'application/json', ...(options.body ? {'Content-Type': 'application/json'} : {}), ...(options.headers || {})};
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

async function startErpLogin(returnUri) {
  return request('/auth/erp-link/login/start', {method: 'POST', body: JSON.stringify({return_uri: returnUri})});
}

async function exchangeErpCode(code) {
  const session = await request('/auth/erp-link/login/exchange', {method: 'POST', body: JSON.stringify({code})});
  if (!session?.access_token || !session?.refresh_token) throw new Error('ERP login response did not contain a valid session.');
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

module.exports = {API_BASE, request, login, me, gamificationHome, startListening, heartbeatListening, logout, startErpLogin, exchangeErpCode, startStudySession, heartbeatStudySession, finishStudySession};
