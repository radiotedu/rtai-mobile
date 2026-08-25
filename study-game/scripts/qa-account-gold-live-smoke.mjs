import {request} from '@playwright/test';

const baseURL = process.env.RADIOTEDU_QA_ORIGIN || 'https://radiotedu.com';
const client = await request.newContext({baseURL});

const checks = [];
const check = (name, status, expected) => {
  checks.push({name, status, expected, ok: expected.includes(status)});
};

try {
  for (const [name, path, expected] of [
    ['health', '/jukebox/health', [200]],
    ['social', '/social/', [200]],
    ['focus', '/focus/', [200]],
    ['gold-admin-page', '/jukebox/gold-admin/', [200]],
    ['economy-auth-gate', '/jukebox/api/v1/economy/summary', [401]],
    ['web-session-auth-gate', '/jukebox/api/v1/auth/web/session', [401]],
    ['gold-admin-session-auth-gate', '/jukebox/api/v1/gold-admin/session', [401]],
  ]) {
    const response = await client.get(path, {failOnStatusCode: false});
    check(name, response.status(), expected);
  }

  const mutation = await client.post('/jukebox/api/v1/economy/listening/start', {
    data: {channel_id: 'radio', client_session_id: 'qa:unauthenticated'},
    failOnStatusCode: false,
  });
  check('economy-mutation-auth-gate', mutation.status(), [401]);

  const loginWithoutOrigin = await client.post('/jukebox/api/v1/auth/web/login', {
    data: {email: 'qa-invalid@example.invalid', password: 'not-a-real-password'},
    failOnStatusCode: false,
  });
  check('web-origin-gate', loginWithoutOrigin.status(), [403]);

  const accountAdminWithoutSession = await client.post('/jukebox/api/v1/gold-admin/auth/account-session', {
    headers: {Origin: 'https://radiotedu.com', 'X-RadioTEDU-CSRF': 'qa-invalid'},
    data: {},
    failOnStatusCode: false,
  });
  check('superadmin-account-auth-gate', accountAdminWithoutSession.status(), [401]);

  const preflight = await client.fetch('/jukebox/api/v1/economy/summary', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://radiotedu.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Idempotency-Key,X-RadioTEDU-CSRF',
    },
    failOnStatusCode: false,
  });
  const allowedHeaders = String(preflight.headers()['access-control-allow-headers'] || '').toLowerCase();
  checks.push({
    name: 'cors-idempotency-header',
    status: preflight.status(),
    expected: [204],
    allowedHeaders,
    ok: preflight.status() === 204 && allowedHeaders.includes('idempotency-key'),
  });
} finally {
  await client.dispose();
}

console.log(JSON.stringify({baseURL, checks, passed: checks.every((item) => item.ok)}, null, 2));
if (checks.some((item) => !item.ok)) process.exitCode = 1;
