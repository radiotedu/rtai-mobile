# RadioTEDU mobile API and links

Last reviewed: 26 September 2026. Keep the API and embedded web services on their own routes; Study, Social, Voting, and the local Jukebox controller are separate features.

| Feature | Current URL | Mobile behavior |
|---|---|---|
| Jukebox API | `https://radiotedu.com/jukebox/api/v1` | Native account, profile, member library, and listening-reward requests |
| Study | `https://radiotedu.com/study/` | Remote-only Study WebView |
| Social | `https://radiotedu.com/social/` | Social sign-in and its web session stay inside the WebView |
| Voting | `https://radiotedu.com/vote/` | Independent voting WebView |
| Jukebox controller | `https://radiotedu.com/juke-local/controller/` | Separate QR/controller WebView |
| Events and tickets | `https://radiotedu.com/bilet` | Public event listing and ticket links |
| Account sign-in | `https://radiotedu.com/giris/` | Public account sign-in page |
| Account registration | `https://radiotedu.com/kayit/` | Public account registration page |
| Member profile | `https://radiotedu.com/profilim/` | Public member profile entry |
| Socket.IO | `https://radiotedu.com` + `/jukebox/socket.io` | Live Jukebox events |

The native client uses `https://radiotedu.com/jukebox/api/v1` as its REST base. Its Axios client attaches the stored Jukebox access token as a Bearer token and refreshes expired sessions through the API. Native login, registration, guest login, session refresh, current-user lookup, logout, and account deletion are implemented in `AuthContext`.

## Account and Gold

- `POST /auth/login`, `POST /auth/register`, and `POST /auth/guest` create native sessions; `POST /auth/refresh`, `GET /auth/me`, `POST /auth/logout`, and account lifecycle routes maintain them. Website password sign-in uses `/auth/web/login`; both login routes resolve the same RadioTEDU account and password, while the website keeps its session in HTTP-only cookies and the app stores its Bearer tokens in Keychain.
- The app reads Gold totals through `/gamification/home` and `/gamification/me`, and uses `/economy/listening/start` plus `/economy/listening/heartbeat` for server-calculated listening rewards. Requests use the shared Axios client, which sends the native Bearer token and rotates it through `/auth/refresh` when needed.
- Native Jukebox requests use the same API token. The Social WebView keeps its own same-origin, HTTP-only cookie session. The native Bearer token is not forwarded into that WebView.
- A live request without a session returns `401` on protected account, Gold, and member-library routes. That confirms the route is protected and reachable; it does not prove a signed-in production transaction succeeded.

## Member library sync

Registered accounts can use these member routes with the native Bearer token:

- `GET /profile/library` returns `favorites` and podcast `progress`.
- `PUT /profile/favorites/:kind/:contentId` saves a favorite; `DELETE` on the same path removes it. Supported kinds are `station`, `podcast_show`, and `podcast_episode`. Save fields are `title`, `subtitle`, and `artwork_url`.
- `PUT /profile/progress/:episodeId` saves `position_seconds`, `duration_seconds`, and `completed`, with optional `title`, `subtitle`, and `artwork_url`.

The mobile player syncs station favorites at account sign-in and when the app returns to the foreground. It imports existing local station favorites once, then uses the account library as the cross-device source of truth. Podcast progress resumes an unfinished episode and saves playback position periodically and when paused. Guest sessions keep using local station favorites and do not call member-library routes. Failed favorite and progress writes remain queued locally for retry.

## WebView and route notes

- Do not change the existing flow where the backend receives voting information from the Music PC. The mobile app must never connect directly to the Music PC.
- Voting and `/juke-local/controller/` remain separate WebViews and protocols. Their page caches are disabled so a visit loads the deployed website.
- The app currently points Voting to `/vote/`, matching the repository's route guide. A read-only production check on 26 September 2026 returned `404` for that URL (while `/vote` redirected to it); confirm the website route before changing the app to a guessed alternative.
- Keep the `/jukebox` REST and Socket.IO base paths unchanged unless the deployed backend route is deliberately migrated.
## Backend member-library authentication

The Social API serves the member-library routes used by both the website and native app. It accepts the website's existing session tokens and the native app's Jukebox Bearer tokens. Configure JUKEBOX_JWT_SECRET_B64 in the Social API's restricted service environment as the base64 encoding of the active Jukebox JWT_SECRET; JUKEBOX_JWT_ISSUER and JUKEBOX_JWT_AUDIENCE must match the Jukebox values. Keep these secrets out of source control.