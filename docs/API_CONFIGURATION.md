# API and WebView Configuration

The mobile app communicates with RadioTEDU web services only. Study, voting, and the local Jukebox controller are independent features and must not be merged into a single route or protocol.

| Feature | URL | Mobile behavior |
|---|---|---|
| API | `https://radiotedu.com/jukebox/api/v1` | Authenticated REST base |
| Study | `https://radiotedu.com/study/` | Remote Study WebView with packaged fallback |
| Voting | `https://radiotedu.com/vote/` | Independent voting WebView; backend-facing only |
| Jukebox | `https://radiotedu.com/juke-local/controller/` | Independent QR/controller WebView |
| Socket.IO | `https://radiotedu.com` + `/jukebox/socket.io` | Backend live voting events |

The stored mobile access token remains the authentication source for protected REST requests. Public display routes may load without a token, while account-restricted actions can still require a registered, non-guest account.

> Do not change the structure where the backend gets information from the Music PC when voting if that communication already works. Change only the backend/mobile-app communication. The mobile app must never connect directly to the Music PC.

In particular:

- `/vote/` is the voting WebView and talks to the backend.
- `/juke-local/controller/` is the separate Jukebox QR/controller WebView.
- The mobile app must not create local voting rounds, fake candidates, fallback votes, or a direct Music PC connection.
- Keep the production `/jukebox` REST and Socket.IO base paths unchanged.
