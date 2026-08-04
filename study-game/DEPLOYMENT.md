# RadioTEDU Study deployment handoff

The standalone game is built for the final public path:

`https://radiotedu.com/study/`

Mobile-app WebView packaging is intentionally deferred until this build has been deployed and verified at that URL.

## Build and publish

```sh
npm ci
npm test
npm run test:e2e
npm run build
npm run stress:players
npm run release:verify
```

Publish the **contents** of `dist/` at `/study/`. Vite uses relative asset URLs, so the same output works at that nested path without rewriting generated HTML.

Recommended HTTP behavior:

- Serve `/study/` and `/study/index.html` with `Cache-Control: no-cache`.
- Serve hashed files under `/study/assets/` with `Cache-Control: public, max-age=31536000, immutable`.
- Serve PNG room and avatar assets with a long cache lifetime; their URLs are versioned through the build manifest.
- Keep HTTPS enabled and disallow framing by unrelated origins. The later mobile integration can use the same first-party URL.

## Account transport contract

Local development uses the local adapter. A hosted production build deliberately stays locked until the first-party server provides `window.RadioTEDUStudyBridge` before the generated module script runs.

The bridge contract is:

```ts
window.RadioTEDUStudyBridge = {
  apiBase: '/jukebox/api/v1',
  account: {
    id: 'server-authenticated-user-id',
    displayName: 'Display name',
    authenticated: true,
  },
  globalPoints: 240,
  request: (input, init) => firstPartyAuthenticatedFetch(input, init),
}

window.RadioTEDUStudyEntry = {
  loginUrl: '/account/sign-in',
  registerUrl: '/account/register',
  accountUrl: '/account/',
  logoutUrl: '/account/sign-out?csrf=server-rendered-action-token',
  helpUrl: '/help/',
}
```

The authenticated request function—not a token on the public bridge—owns credentials. The game restricts its remote calls to the Study and gamification event contracts. Study time, event registration, inventory purchases, room presence, and Gold remain server-authoritative.

`RadioTEDUStudyEntry` contains navigation URLs only. The client accepts same-origin URLs and rejects cross-origin or credential-bearing values. Render a short-lived CSRF-protected logout action on the server; never place passwords, access tokens, cookies, private keys, or reusable secrets in either public object.

For the PC site, render this bridge from the signed-in RadioTEDU web session. For the later Android WebView phase, provide the same contract at document start and load `https://radiotedu.com/study/`; do not copy the game bundle into the APK.

## Pre-release checks

```sh
npm test
npm run test:e2e
npm run stress:players
npm run release:verify
```

The evidence run covers desktop Chromium and a Pixel-sized mobile viewport, including:

- authenticated desktop/mobile campus home, room discovery, and verified leaderboard presentation
- Library and Çim Alan preservation
- Sports Center, Fatma–Semih Akbil Auditorium, and the official Early Childhood Learning Lab
- consistent high overhead isometric room cameras and the animated Auditorium event screen
- keyboard movement and touch-ready controls
- events and server-awarded Gold messaging
- layered hoodie, trousers, shoes, and hat preview
- an Auditorium sit-and-study session
- every top, bottom, shoe, and hat variant on desktop and mobile
- server-authoritative Gold purchases, idempotency, balance refresh, and same-slot replacement
- 60 concurrent players, presence convergence, and simultaneous walking

Room-source provenance and transformation constraints are documented in `assets/sources/tedu-official/SOURCE_PROVENANCE.md`.

The release archive deliberately contains no live credentials, API tokens, cookies, private keys, or production `.env` files. See `SERVER_HANDOFF.md` for the server-side secret injection contract.
