# Webserver Codex deployment prompt — RadioTEDU Study

You are deploying the RadioTEDU Study game from this archive. Read `DEPLOYMENT.md`, `SERVER_HANDOFF.md`, `SECURITY.md`, `RELEASE_TEST_REPORT.md`, and `RELEASE_MANIFEST.json` before changing the server.

## Fixed decision

Deploy the game at **`https://radiotedu.com/study/`**, not `/social/`. The Android repository fixes `STUDY_REMOTE_ROOT` to `https://radiotedu.com/study/` and opens rooms with URLs such as `https://radiotedu.com/study/?embedded=mobile&room=chim-alan`. `/social/` belongs to the separate Social WebView and must not be replaced.

## Non-destructive boundary

- Treat the existing WordPress installation, its document root, plugins, themes, uploads, `.htaccess`, configuration, cron, cache, and database as protected production data.
- Work only inside the resolved `/study/` web directory and the narrowly scoped Study API implementation. Do not overwrite the WordPress root with this archive.
- Never run `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, a database reset, a destructive ORM reset, or a broad recursive delete. Never import a database dump over production.
- If a schema addition is required, create an additive, forward-only, namespaced migration. Show its SQL and backup/rollback plan before applying it. Do not alter an existing column or table unless the operator explicitly approves that exact change.
- Back up the existing `/study/` directory, if present. Deploy to a new sibling staging directory, verify it, and use an atomic rename/symlink switch. Keep the prior release for rollback.
- Do not change global web-server or WordPress rewrite rules unless `/study/` cannot be served otherwise. Prefer a location/directory rule scoped only to `/study/`; back up and syntax-test any configuration before reload.
- Do not print, copy into source, commit, or return live credentials. Read required values from the server's existing secret manager/protected environment and keep them server-side.

## Package verification

1. Run `node scripts/verify-release-bundle.mjs .` in the extracted package and stop if it fails.
2. Verify the SHA-256 manifest entries in `RELEASE_MANIFEST.json` before building.
3. Use Node.js 22.12+ (or at least 20.19+) and run `npm ci`, `npm test`, and `npm run build`.
4. Publish the **contents** of `dist/` to `/study/`; do not publish `node_modules`, source files, test artifacts, or this handoff documentation.
5. Serve `/study/` and `/study/index.html` with `Cache-Control: no-cache`. Serve hashed `/study/assets/*` with `Cache-Control: public, max-age=31536000, immutable`.

## Existing account and secret integration

The browser bundle is intentionally secret-free. Reuse the authenticated RadioTEDU session and existing protected backend configuration for:

- database connection/credentials;
- session or JWT verification/signing keys;
- CSRF validation;
- same-origin API access policy;
- rate-limit storage;
- any RadioTEDU internal service credentials.

Do not expose any of those values to JavaScript. Before the Study module executes, render a server-owned bridge for the signed-in account:

```html
<script>
window.RadioTEDUStudyBridge = {
  apiBase: '/jukebox/api/v1',
  account: {
    id: '<server-derived-account-id>',
    displayName: '<server-escaped-display-name>',
    authenticated: true
  },
  globalPoints: 0,
  request: (path, init = {}) => fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.headers || {}),
      'X-CSRF-Token': '<server-issued-csrf-token>'
    }
  })
};
</script>
```

Account ID, display name, points, ownership, rewards, room membership, and permissions must be derived by the server. Escape embedded values for JavaScript/HTML context. If the host uses bearer authentication instead, keep token issuance short-lived and follow `SERVER_HANDOFF.md`; never persist it in the archive or built assets.

## Required same-origin API contract

The bridge base becomes `/jukebox/api/v1/study` inside the client. Implement or connect these authenticated routes using the response envelope documented in `SERVER_HANDOFF.md`:

- `GET /jukebox/api/v1/study/avatar/me`
- `POST /jukebox/api/v1/study/avatar/equip`
- `POST /jukebox/api/v1/study/avatar/purchase`
- `GET /jukebox/api/v1/study/summary`
- `POST /jukebox/api/v1/study/sessions/start`
- `POST /jukebox/api/v1/study/sessions/{id}/heartbeat`
- `POST /jukebox/api/v1/study/sessions/{id}/finish`
- `POST /jukebox/api/v1/study/instances/join`
- `GET /jukebox/api/v1/study/presence`
- `POST /jukebox/api/v1/study/presence/heartbeat`
- `GET /jukebox/api/v1/study/chat`
- `POST /jukebox/api/v1/study/chat`
- `POST /jukebox/api/v1/study/moderation/reports`
- `GET /jukebox/api/v1/gamification/events`
- `POST /jukebox/api/v1/gamification/events/{id}/register`

Enforce authentication, authorization, room-instance membership, payload schemas, idempotency, rate limits, profanity/spam policy, server timestamps, and server-authoritative Gold/rewards on every write. Never trust a client-supplied user ID, Gold balance, owned item list, reward amount, elapsed study time, or moderation authority. Ignore/report on the client is only a local UX layer; sanctions require server review.

Accept only the shipped room IDs `library`, `chim-alan`, `sports-center`, `auditorium`, and `learning-lab`; validate every node and seat against the corresponding server-side room manifest. Before the module script, render `window.RadioTEDUStudyEntry` with same-origin login, registration, account, help, and CSRF-protected logout URLs. These are navigation URLs, not secrets. Do not expose a password, cookie, bearer token, private key, database credential, or reusable CSRF token in HTML or JavaScript.

## Acceptance and rollback

- Verify PC at 16:9 and Android WebView URLs for `room=library`, `room=chim-alan`, and `room=learning-lab`.
- Verify login reuse, chat isolation, study start/heartbeat/finish, wardrobe persistence, authoritative purchases, events, presence, reports, cache headers, CSP, and no console/request errors.
- Confirm `/`, `/wp-admin/`, public WordPress pages, uploads, plugins, cron, and the separate `/social/` route still behave exactly as before.
- Run API/load checks against a staging account set before production. Do not aim the included local 60-player harness at production credentials without explicit operator approval.
- If any acceptance check fails, atomically restore the prior `/study/` release. Do not repair by resetting WordPress or the database.

At completion, report the deployed release hash, exact files/configuration changed, additive migrations (if any), tests, backup location, rollback command, and health-check results. Redact all secrets.
