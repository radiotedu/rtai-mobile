# RadioTEDU Study server handoff

This package contains the production build and complete editable source for deploying the game at:

`https://radiotedu.com/study/`

## Package contents

- `dist/` — ready-to-publish static output
- `src/`, `public/`, `index.html` — editable game source and assets
- `tests/`, `e2e/`, `scripts/` — release, contract, browser, and 60-player stress verification
- `DEPLOYMENT.md` — HTTP, bridge, cache, and WebView guidance
- `WEBSERVER_CODEX_PROMPT.md` — exact `/study/` deployment prompt with WordPress, database, secret, rollback, and acceptance boundaries
- `RELEASE_MANIFEST.json` — SHA-256 and byte length for every packaged file
- `assets/sources/tedu-official/` — official source-image provenance

The archive excludes `node_modules`, Playwright output, temporary files, production `.env` files, private keys, credentials, and tokens.

## Safe credential handling

There are intentionally **no live secrets in this archive**. A static browser bundle must never contain database credentials, JWT signing secrets, API tokens, session cookies, private keys, or refresh tokens.

The RadioTEDU host must inject `window.RadioTEDUStudyBridge` before the generated module script executes. Only non-secret account display data is exposed. Authentication remains inside the server-owned request function:

```js
window.RadioTEDUStudyBridge = {
  apiBase: '/jukebox/api/v1',
  account: {
    id: authenticatedUser.id,
    displayName: authenticatedUser.displayName,
    authenticated: true,
  },
  globalPoints: authenticatedUser.spendablePoints,
  request: (input, init) => firstPartyAuthenticatedFetch(input, init),
}
```

`firstPartyAuthenticatedFetch` must use the existing RadioTEDU web session and CSRF protections. Do not serialize its session cookie, bearer token, refresh token, or server configuration into JavaScript or HTML.

The hosting environment must provide its existing private configuration for authentication, database access, CSRF/session validation, and the `/jukebox/api/v1` services. Those values stay in the server secret manager or protected environment and are not copied into this handoff.

## Required API contract

The authenticated bridge must support these same-origin contracts:

- Study profile and Gold: `GET /study/avatar/me`, `POST /study/avatar/purchase`, `POST /study/avatar/equip`
- Authenticated home: `GET /study/home` with room population, study summary, and weekly/month/all-time verified leaderboards
- Study accounting: `GET /study/summary`, session start/heartbeat/finish
- Rooms: `POST /study/instances/join`, presence read/heartbeat
- Chat: room message read/send
- Safety: `POST /study/moderation/reports` with authenticated reporter identity, current instance membership, an allowed reason, and an idempotency key
- Events: `GET /gamification/events`, event registration

Gold, ownership, event rewards, study time, seats, room assignments, reports, and sanctions are server-authoritative. Purchase responses must include the requested owned item and a non-negative integer `spendable_points` balance. Ignore lists remain private client preferences and must never be interpreted as a server sanction.

`GET /study/home` uses the standard `{ success: true, data: ... }` envelope. It must return all five room IDs exactly once and must derive ranking duration from accepted server-side study heartbeats, never client totals:

```json
{
  "activePlayers": 24,
  "summary": { "todaySeconds": 1800, "monthSeconds": 28800, "totalSeconds": 90000 },
  "rooms": [
    { "roomId": "library", "occupancy": 8, "capacity": 51, "instanceCount": 1 }
  ],
  "leaderboard": {
    "week": [{ "rank": 1, "userId": "server-user-id", "displayName": "Student", "studySeconds": 21600, "streakDays": 8 }],
    "month": [],
    "all": []
  },
  "generatedAt": "2026-08-04T12:00:00.000Z"
}
```

Return no email address, student number, IP address, authentication identifier, or private profile field. Apply the same display-name moderation policy as room presence. Cache the aggregate briefly server-side, but calculate `isCurrentUser` in the client from the authenticated public user ID.

## Security gate

Implement every invariant in `SECURITY.md` before enabling Gold rewards or public study sessions. In particular, the server must own identity, room membership, seat reservations, elapsed study time, nonce rotation, chat timestamps, rate limits, purchases, and idempotency. Client validation is defense in depth; it is not the authority for durable state.

## Deployment procedure

1. Verify `RELEASE_MANIFEST.json` before modifying the package.
2. Install Node.js 20.19 or newer and run `npm ci`.
3. Run `npm test`, `npm run test:e2e`, and `npm run release:verify`.
4. If changing source, run `npm run build` and re-run the checks.
5. Publish the **contents** of `dist/` at `/study/`.
6. Inject the authenticated bridge before `dist/index.html` loads its module script.
7. Verify the authenticated home, all three leaderboard periods, and deep-link entry into every room.
8. Run the 60-player test against a staging API with real test accounts before public launch.

The included local 60-player harness validates the exact client adapter contract with a shared simulated backend. It does not replace a load test against the deployed RadioTEDU infrastructure.
