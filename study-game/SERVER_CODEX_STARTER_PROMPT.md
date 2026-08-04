# RadioTEDU Study — webserver Codex starter prompt

You are the deployment agent on the production web server for `radiotedu.com`. Deploy the RadioTEDU Study game from the GitHub repository `https://github.com/radiotedu/rtai-mobile.git`, branch `codex/study-world-professional`, directory `study-game/`.

Before doing anything, read these files completely:

- `study-game/DEPLOYMENT.md`
- `study-game/SERVER_HANDOFF.md`
- `study-game/SECURITY.md`
- `study-game/SECRET_REQUIREMENTS.md`
- `study-game/RELEASE_TEST_REPORT.md`
- `study-game/WEBSERVER_CODEX_PROMPT.md`

## Required result

Deploy at exactly `https://radiotedu.com/study/`. Do not deploy at `/social/`. The Android app uses `/study/` and room deep links such as `/study/?embedded=mobile&room=chim-alan`.

Build from `study-game/` with the supported Node.js version, using `npm ci`, `npm test`, and `npm run build`. Publish only the resulting `study-game/dist/` contents to the scoped `/study/` document directory. Do not publish repository metadata, source files, tests, `node_modules`, or handoff documents.

## Production safety boundary

Treat the existing WordPress installation and database as protected production data. Do not delete, replace, reset, or recursively modify the WordPress document root, `.htaccess`, `wp-config.php`, plugins, themes, uploads, cron, cache, or existing database tables. Do not run `DROP`, `TRUNCATE`, database reset commands, destructive ORM migrations, or broad recursive deletion.

Resolve the real `/study/` target first. Back up any current `/study/` release. Deploy into a new sibling release directory, test it, then switch atomically. Keep the prior release and provide the exact rollback command. Scope any web-server rule to `/study/`; back up and syntax-test configuration before reloading. Confirm `/`, `/wp-admin/`, `/social/`, uploads, plugins, and cron still work after deployment.

## Secrets and account integration

Do not expect credentials in GitHub or in this prompt. Do not print, return, commit, transmit, or place secrets in HTML, JavaScript, the built bundle, logs, shell history, or documentation. Discover the existing protected server configuration and secret manager locally. `SECRET_REQUIREMENTS.md` lists the capabilities that must be available.

Reuse the existing authenticated RadioTEDU account/session. The server must derive account ID, display name, ownership, Gold, rewards, roles, and permissions. Never accept these as authoritative client values. Supply the server-owned `window.RadioTEDUStudyBridge` and `window.RadioTEDUStudyEntry` values described in `WEBSERVER_CODEX_PROMPT.md`, with same-origin requests, server-issued CSRF protection, and secure cookies. If any required secret capability is missing, stop and report only the missing capability or variable name—never its value.

Implement or connect the authenticated same-origin Study API contract in `SERVER_HANDOFF.md`. Enforce authorization, schema validation, idempotency, room-instance membership, rate limits, server timestamps, server-authoritative study duration and rewards, chat moderation, and server-side room/node/seat validation. The client must never be able to mint Gold, purchase without server validation, impersonate another account, fake study time, or gain moderation privileges.

## Acceptance

Verify at minimum:

1. Desktop 16:9 and responsive mobile/Android WebView layouts.
2. `/study/`, `room=library`, `room=chim-alan`, and `room=learning-lab` deep links.
3. Existing login reuse, logout, authenticated home, wardrobe persistence, and account isolation.
4. Walking/pathfinding, seats, sitting, study start/heartbeat/finish, chat isolation, presence, events, leaderboards, purchases, reports, and the RadioTEDU mini-player.
5. Two simultaneous accounts cannot see or mutate each other's private state.
6. Unauthenticated, replayed, forged, cross-room, invalid-seat, spam, and reward-tampering requests are rejected.
7. A staging-only 60-player load test passes without using production user credentials.
8. CSP, secure cookie settings, cache headers, console errors, request errors, and server logs are clean.
9. Existing WordPress pages, admin, `/social/`, uploads, plugins, database data, and cron remain unchanged and healthy.

Do not claim success from a build alone. At completion, report the Git commit hash, deployed release hash, exact files/configuration changed, backup path, rollback command, tests and load results, migrations (if any), and health checks. Redact all secrets.
