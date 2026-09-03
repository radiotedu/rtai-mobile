# RadioTEDU ecosystem operating context

This file is the project handoff for Gemini/Antigravity. Add new dated notes to it instead of replacing existing context. Treat the repository and the running Windows services as separate layers: a successful source edit is not evidence that the live site changed, and a live hotfix is not complete until the matching source is committed to `main`.

## Non-negotiable safety rules

- Never delete, reset, truncate, reseed, or bulk-rewrite a production database.
- ERP is read-only unless the user explicitly authorizes a narrowly scoped write. Do not delete or edit ERP users.
- Do not change the Audio Library or its data.
- Do not send email or notifications during tests unless the user names the exact permitted recipient. Newsletter scheduling must not be tested by triggering a production send.
- Do not build Android on this machine. Source edits, Jest tests, PHP lint, static Android audits, and read-only browser checks are allowed.
- Never place passwords, tokens, private keys, SMTP credentials, database connection strings, or JWT secrets in this repository. The private desktop ecosystem guide is the only handoff that contains the three user-supplied Juke-Local kiosk credentials.
- Preserve unrelated user changes. Back up every live file before replacing it, copy only the files changed by the task, compare hashes, refresh the relevant cache, and verify the public result.
- Use `RadioTEDU` in title case and `RADIOTEDU` in all caps. Never write `RADİOTEDU`; Turkish CSS uppercasing must not alter the brand's Latin `I`.
- The playlists page is considered finished unless the user explicitly requests a playlist change.

## Repository and live locations

- Repository: `C:\RadioTEDU\work\rtai-mobile-merge-20260830`
- WordPress source overlay: `website/wordpress-overlay/wp-content/`
- Live WordPress root: `C:\inetpub\wwwroot`
- Mobile app: `mobile/`
- Study/Social client and contract tests: `study-game/`
- Desktop/terminal client: `terminal/`
- Operations scripts: `ops/`
- Read-only verification scripts: `scripts/`
- Public ecosystem guide: `docs/RadioTEDU-Ecosystem-Guide.html`
- Private operator guide: `RadioTEDU-Ekosistem-Rehberi.html` on the administrator desktop
- Backups: `C:\RadioTEDU\backups\`
- Newsletter runtime: `C:\RadioTEDU\newsletter`
- Juke-Local runtime: `C:\RadioTEDU\runtime\juke-local-service`

The Git remote is `https://github.com/radiotedu/rtai-mobile.git`. Work may occur on a Codex branch, but the requested delivery target is `origin/main`. Before reporting completion, fetch `origin/main`, confirm `HEAD...origin/main` has zero divergence after the push, and confirm a clean working tree.

## System map

```text
WordPress website + persistent web player
            |
            | REST/auth bridge
            v
RadioTEDU account, Gold, events, tickets, voting and Juke contracts
      |                 |                    |
      v                 v                    v
mobile app          Study/Social        Juke-Local service
phone/car/TV/Wear   games + avatar      device-specific kiosk + QR
      |                                      |
      v                                      v
Media3 session                         Services PC media agent
Android Auto, Assistant,             one independent queue and
Gemini and Maps media controls        playback output per device
```

ERP is an identity provider and a read-only newsletter member source. It is not the storage layer for RadioTEDU Gold, games, Social, voting, or Juke queues.

## Website structure

### WordPress theme

The theme source is `website/wordpress-overlay/wp-content/themes/radiotedu/`.

- `functions.php`: theme setup, language routing, English translation map, REST configuration, station artwork/summary helpers, asset loading, and shared URL rules.
- `assets/css/app.css`: global responsive layout, header/footer, homepage station shelf, station directory, podcast layouts, newsletter form, and persistent player presentation.
- `assets/js/app.js`: persistent audio player, metadata refresh, cover art, lyrics reader, account modal, language-aware labels, newsletter form, and safe navigation behavior.
- `footer.php`: Ankara Studios address, footer links, newsletter/persistent player integration, and the exact `RadioTEDU` brand casing.
- `archive-rt_station.php`: professional stations directory. RadioTEDU is the flagship station; other stations remain below it.
- `template-parts/card-station.php`: reusable station card used on the homepage and station archive.
- `template-parts/player.php`: bottom player markup. Playback state is kept outside page content so navigation inside radiotedu.com does not interrupt audio.

### Standalone public surfaces

- `website/standalone/teknoloji/`: Turkish technology story.
- `website/standalone/technology/`: English technology story.
- `website/standalone/rtai/`: English RTAI company-style page.
- `website/standalone/archive/`: click-to-load archive browser. Audio has no initial `src`, uses `preload="none"`, and must never be pulled into the WordPress cache.

### WordPress plugins

- `radiotedu-content`: station, podcast, event and related content contracts.
- `radiotedu-newsletter`: consented subscribers, encrypted email storage, 30-day issue snapshots, preview/production delivery, unsubscribe and language management.
- Other production plugins are out of scope unless a task identifies them. Do not disable plugins broadly while debugging.

## Website behavior implemented in the 2026-09-01 work

### Language routing

- A Turkish browser/system opens `/` unless the user has an explicit language preference.
- English and every non-Turkish browser/system open `/en/`.
- The language toggle persists `rt_language_preference` and reloads the localized route.
- Quick navigation, primary navigation, account controls, footer, player labels, and `LIVE LYRICS` are English on English pages.

### Persistent web player

- Radio and podcast playback continues during internal navigation.
- Non-Lo-Fi stations expose Icecast metadata. Lo-Fi intentionally does not expose song metadata.
- Artwork/store links and lyrics are presentation enhancements; failure must not stop audio.
- Lyrics are a compact, roughly three-line, scrollable reader with a close control. They are not presented as synchronized when the timing source cannot prove synchronization.
- User-initiated pause/stop is respected. Network/server failure may cascade to the matching `-low` mount without overriding an intentional pause.

### Stations

- The homepage section headed `Bugün ne dinliyoruz?` / `What are we listening to today?` shows all five stations.
- At desktop width the five compact cards form one row; responsive rules use 3, 2, then 1 column without horizontal overflow.
- Each card uses a station-specific one-sentence description in Turkish and English instead of the generic live-channel sentence.
- The stations directory does not show the redundant automatic-refresh explanation. Metadata still refreshes in code.
- Footer text is exactly `RadioTEDU Ankara Stüdyoları` in Turkish and `RadioTEDU Ankara Studios` in English. The address label has `text-transform: none` so Turkish locale rules cannot render `RADİOTEDU`.

### Newsletter

- Website subscription requires explicit consent. RadioTEDU account registration offers an optional, unchecked newsletter box on web and mobile.
- ERP member export uses `BEGIN READ ONLY`. It does not update ERP.
- Each issue covers podcasts published in the previous 30 days.
- Upcoming active events within 120 days may be included when present.
- The first scheduled preview is 2026-09-29 10:00 Europe/Istanbul and goes only to `tuna.ozsari@tedu.edu.tr`.
- The first production issue is 2026-10-01 10:00 Europe/Istanbul. The issue snapshot is rebuilt at production cutoff so podcasts added after preview are included.
- The Windows task is `RadioTEDU Monthly Podcast Newsletter`, scheduled every 15 minutes from the first preview boundary. Application-level date/idempotency guards decide whether anything is sent.
- Desktop pause/resume shortcuts affect only the newsletter task.

## Mobile architecture

The React Native application is under `mobile/` and retains one account/Gold contract across phone, iOS/iPad, Android Auto, Android TV, Wear, Huawei-facing builds, WebViews, and the terminal client where supported.

- `src/context/AuthContext.tsx`: RadioTEDU and ERP session lifecycle, token persistence and account bootstrap.
- `src/services/newsletterService.ts`: consented registration handoff to the public newsletter endpoint.
- `src/services/goldListeningService.ts`: server-timed nonce and heartbeat flow. The client never awards itself Gold.
- `src/data/radioChannels.ts`: canonical station IDs, stream mounts, codec/quality variants and artwork.
- `src/services/playbackQueue.ts`: playback recovery and quality cascade. Respect explicit user stop/pause.
- `android/`: phone package, Android Auto media browser/search, Media3 session, TV and Wear packaging metadata.

Android Auto stays on current Media3. Do not regress to the former media stack. Car browsing must use packaged square icons, keep Lo-Fi track metadata hidden, respond to media search for Assistant/Gemini, and appear as a media application in Google Maps controls. This is media-session integration, not an embedded Maps screen.

Game Gold is accepted only from a valid server response while online. Direction controls are square and positioned above the phone's bottom obstruction/safe area.

## Account and Gold rules

- RadioTEDU and ERP login resolve to the same authoritative account model.
- The displayed Gold balance comes from the server; zero is a valid authoritative value.
- Awards and spending require server validation, ledger/idempotency rules and non-negative balances.
- Listening rewards use rotating one-time nonces and heartbeat proof.
- Games must not award Gold offline or by trusting a client-submitted duration/score alone.
- WebView bridges receive the smallest required auth payload and must not expose bearer tokens as reusable globals.
- `tuna.ozsari@tedu.edu.tr` is the requested administrator identity, but its password is not stored or invented in repository documentation.

## Juke-Local and voting

- Public phone controller: `https://radiotedu.com/juke-local/controller/`
- Kiosk: `https://radiotedu.com/juke-local/kiosk/`
- The old `/jukebox/kiosk/` path is not the kiosk URL.
- Every physical kiosk has a distinct device identity, QR target, queue and now-playing state.
- A phone request preserves the QR's device ID so one computer never changes another computer's playback.
- `RadioTEDU-Juke-Local` should be Running and Automatic on Services PC.
- Voting uses the shared authenticated web surface and server round result. Do not submit a vote as a health test.
- Kiosk usernames/passwords are intentionally excluded from this file. Consult the private desktop guide.

## Safe website deployment procedure

1. Confirm the intended source file in the repository.
2. Copy the current live file to a dated directory under `C:\RadioTEDU\backups\`.
3. Edit the repository source with a minimal patch.
4. Run syntax/static tests before deployment.
5. Copy only the changed source file to the equivalent path under `C:\inetpub\wwwroot`.
6. Refresh WP Fastest Cache through a temporary PHP bootstrap that calls `wpfc_clear_all_cache(true)`, then delete that temporary file immediately.
7. Compare SHA-256 hashes between repository source and live destination.
8. Use a headless browser in Turkish and English at desktop/mobile widths. Check exact copy, computed styles, JavaScript errors, visible card counts and horizontal overflow.
9. Run `git diff --check`, commit the exact files, push `HEAD:main`, fetch, then verify zero divergence and a clean tree.

Never replace the entire live theme/plugin directory for a small change.

## Current verification commands

Run from the repository root unless a command changes directory. These are non-mutating, except tests may create disposable screenshot folders when an explicit output path is used.

```powershell
# Website and repository contracts
node --test tests\technology-rtai-story.test.mjs
node --test tests\production-account.test.mjs
node scripts\verify-language-routing-readonly.mjs
node scripts\verify-registration-newsletter-readonly.mjs
node scripts\verify-stations-page-readonly.mjs --output C:\RadioTEDU\evidence\stations-page-verification
node scripts\verify-live-services.mjs

# Mobile source/contracts only. Do not run an Android build here.
Set-Location mobile
npm test -- --runInBand
node scripts\android-publish-audit.js

# Study/Social
Set-Location ..\study-game
npm test
```

Expected current baselines:

- Mobile Jest: 90/90 suites, 340/340 tests.
- Android static publish audit: 36/36.
- Study/Social: 46/46 files, 227/227 tests, plus 3/3 generation contracts.
- Production account contract harness: 4/4.
- Juke-Local, voting and Study public surfaces: HTTP 200 in the latest read-only probe.

Known live caveat on 2026-09-01: `https://stream.radiotedu.com/lofi` timed out in repeated 15-30 second probes. `https://stream.radiotedu.com/lofi-low` returned HTTP 200 with AAC bytes, so the mobile low-quality recovery path remained available. `lofi-flac` returned 404. Do not report every live stream green until the standard Lo-Fi mount passes again.

## Troubleshooting order

1. Reproduce without writing data and record the exact URL, viewport, locale and time.
2. Determine whether the failure is source, live deployment, cache, API, service, stream mount or account authorization.
3. Compare source/live hashes before changing code.
4. For website copy/style problems, inspect the DOM and computed style in both languages. CSS locale uppercasing can visually alter correct source text.
5. For account/Gold problems, verify route/auth contracts and server responses. Do not edit balances directly.
6. For Juke problems, verify service state, health, device ID, QR payload, WebSocket media-agent connection and local audio output. Do not clear all queues/devices.
7. For voting, inspect the active round read-only. Do not cast a test vote.
8. For stream failures, test the standard and matching `-low` mount separately and confirm that explicit user pause is not mistaken for a failure.
9. Roll back only the changed file/commit from the dated backup if needed.

## How to extend this handoff

Append a dated section below. State:

- user-visible outcome;
- exact source and live files changed;
- deployment/cache action;
- tests and counts;
- known limitations;
- commit hash pushed to `main`;
- whether email, notifications, ERP, databases or the Audio Library were touched.

Do not rewrite earlier evidence to make a later change appear older or more complete than it was.

## 2026-09-01 handoff snapshot

- Monthly newsletter scheduling, event inclusion and optional account-registration consent were implemented and pushed in `c3774d6`.
- Compact five-station homepage shelf and redundant station refresh-copy removal were pushed in `eb75464`.
- Station-specific Turkish/English summaries were pushed in `555502e`.
- Footer brand casing protection was pushed in `152a680`.
- The playlist presentation was not changed during these fixes.
- No Android build was performed.
- No email/notification was sent during these changes.
- ERP and the Audio Library were not modified.

## 2026-09-02 mobile UX handoff snapshot

- Jingle detection without iTunes fetch and stale artwork clearing were implemented in `MetadataContext.tsx` & `streamMetadata.ts`.
- MiniPlayer full hitbox and dynamic stack/tab bottom positioning were implemented in `MiniPlayer.tsx`.
- PlayerScreen station branding, clean live pulse bar, and Sleep Timer modal were implemented in `PlayerScreen.tsx` & `sleepTimer.ts`.
- Audio focus ducking and auto-resume on interruption were implemented in `playbackService.ts`.
- Smooth volume ramp on channel switches was implemented in `playbackQueue.ts`.
- Music-first Home Screen with 5-station shelf (*"Bugün ne dinliyoruz?"*) was implemented in `HomeScreen.tsx`.
- Guest profile welcome hero card was implemented in `ProfileScreen.tsx`.
- Bottom list clearances were updated in `FocusScreen.tsx` & `LeaderboardScreen.tsx`.
- Tests: Mobile Jest 90/90 suites (338/338 tests), Android publish audit 36/36, Study/Social 46/46 files (227/227 tests), Root 15/15.
- Jukebox & Market screens were preserved without modifications.
- No email/notification was sent during these changes.
- ERP and the Audio Library were not modified.

## 2026-09-02 Phase 2 favorites, lyrics, navigation & notification handoff snapshot

- Two-way real-time favorites synchronization across PlayerScreen modal and RadioScreen favorites shelf via subscriber pattern in `radioFavorites.ts`.
- MiniPlayer suppression on interactive screens (`NextSongVote`, `Social`, `Study`, `LibraryStudyWeb`, `StudyRoom`, `AvatarCloset`) in `MiniPlayer.tsx`.
- Smart network-aware lyrics policy: Automatic LRCLIB lyrics on Wi-Fi; on-demand manual load button with no background data fetch on cellular mobile data in `PlayerScreen.tsx` & `appCopy.ts`.
- Dynamic platform media notification capabilities: Live Radio presents station previous/next controls with jump symbols removed; Podcasts present -15s / +30s jump controls in `playbackQueue.ts` & `playbackService.ts`.
- Verified on live Android tablet emulator (`RadioTEDU-Tablet-Test`), including screenshots of favorited state, shelf sync, and interactive Jukebox WebView.
- Tests: Mobile Jest 90/90 suites (340/340 tests), Android publish audit 36/36, Study/Social 46/46 files (227/227 tests + 3/3 generation contracts), Language routing 6/6 suites (100% pass), Registration newsletter 2/2 suites (100% pass), Stations page 4/4 suites (100% pass), Root contracts 15/15 pass.
- Commit hash pushed to `origin/main`: `0aa7062`.
- No Android build performed. No email or push notifications sent. Production DB and Audio Library untouched.

## 2026-09-03 phone verification & frame-by-frame video analysis handoff snapshot

- Executed full test verification exclusively on physical-dimension Android Phone emulator (Pixel 5, 1080x2340), strictly adhering to user directive (*"tablet değil, telefon testi yap."*).
- Screen recording videos captured and extracted frame-by-frame:
  - `phone_flow1_player_lyrics.mp4`: Live radio playback, minimalist `[ LYRICS ]` pill button, non-blocking LRCLIB query state, dismiss `✕` control, and Sleep Timer bottom sheet options (15m, 30m, 45m, 60m).
  - `phone_flow2_favorites.mp4`: Real-time two-way favorites synchronization between RadioScreen list card, Favorites shelf (updating from 0 to 1 active with solid red heart), and Player modal (solid red heart `#e50914`).
  - `phone_flow3_miniplayer_clean.mp4`: MiniPlayer behavior verified — active and floating above tab bar on Home and Radio tabs; completely suppressed (hidden) on interactive screens (`NextSongVote`, `Social`, `Study`, `Jukebox`).
  - `FocusScreen.tsx` bottom list clearance verified above MiniPlayer with no overlap.
  - `ProfileScreen.tsx` Guest Welcome Hero Card verified with bullet points for Gold, Badges, and Campus Tickets.
- Source fixes:
  - `mobile/src/screens/PlayerScreen.tsx`: Restored `isLive` and `isFlacActive` definitions to fix Player modal runtime crash.
  - `mobile/src/screens/jukebox/JukeLocalWebViewScreen.tsx` & `mobile/src/screens/social/SocialWebViewScreen.tsx`: Added `androidLayerType="software"` to prevent Chromium renderer process crash on swiftshader indirect GPU emulators.
- Tests: Mobile Jest 90/90 suites (340/340 tests passed), Android static publish audit 36/36 passed.
- Commit hash pushed to `origin/main`: `5288302` (and previous `fedb5e4`).
- Safety rules preserved: Production DB, ERP, and Audio Library untouched. No email or push notifications sent.




## 2026-09-03 station identification & profile guest title handoff snapshot

- Updated Guest Hero Card title in `mobile/src/screens/ProfileScreen.tsx` from "RadioTEDU Topluluğuna Katılın" to "RadioTEDU Hesabı Açın" per user directive.
- Hardened station identification & theming in `mobile/src/screens/PlayerScreen.tsx`:
  - `currentChannel` now searches canonical `RADIO_CHANNELS` as primary/fallback source, guaranteeing that all 6 stations (RadioTEDU, Classical, Jazz, Lo-Fi, Energize, Rock) reliably display their official station name, color-coded tag badge, and custom logo even under transient stream check conditions.
  - `stationTagText` adopts the channel's designated brand color (`currentChannel.color`), dynamically tinting station tag badges (Gold for Classical, Purple for Jazz, Cyan for Lo-Fi, Neon Yellow for Energize, Orange for Rock).
  - Station skip cycling (`goToOffset`) iterates over all 6 canonical stations (`RADIO_CHANNELS.filter(c => !c.requiresLiveCheck)`).
- Sequentially tested all 6 stations on Pixel 5 phone emulator and captured verification screenshots of each station player modal:
  - Station 1: `RadioTEDU` (`artifacts/station_1_radiotedu.png`)
  - Station 2: `Classical` (`artifacts/station_2_classical.png`)
  - Station 3: `Jazz` (`artifacts/station_3_jazz.png`)
  - Station 4: `Lo-Fi` (`artifacts/station_4_lofi.png`)
  - Station 5: `Energize` (`artifacts/station_5_energize.png`)
  - Station 6: `Rock` (`artifacts/station_6_rock.png`)
  - Profile verified: `RadioTEDU Hesabı Açın` (`artifacts/s_profile_opened.png`)
- Confirmed station naming visibility: Every station explicitly displays its name in 3 distinct places: Top bar (`RadioTEDU · <Station>`), Station tag badge (`● <Station>`), and official station logo/title.
- Tests: Mobile Jest 90/90 suites (340/340 tests passed), Android publish audit 36/36 passed.
- Pushed to `origin/main` in commit `7716c17`.

## 2026-09-03 terminal v1.3.5 & mobile v1.3.5 release handoff snapshot

- Terminal upgraded to v1.3.5 with Spotify CLI / OpenCode-inspired TUI:
  - Rich ANSI color palette with per-station brand colors (RadioTEDU red, Classical gold, Jazz purple, Lo-Fi cyan, Energize yellow, Rock orange).
  - Animated live visualizer (` ▂▃▅▆▇▆▅▃ `) and pulsing `● LIVE` indicator.
  - Interactive mouse control: mouse wheel navigation, station click-to-play, Now Playing pause toggle, and clickable control action buttons (`[Space]`, `[F]`, `[A]`, `[S]`, `[L]`, `[X]`, `[Q]`).
  - Integrated login flow supporting both RadioTEDU Account (email/password) and TEDÜ ERP SSO browser authentication.
  - Created cross-platform installer scripts:
    - Linux/macOS curl: `curl -fsSL https://raw.githubusercontent.com/radiotedu/rtai-mobile/main/terminal/install.sh | bash`
    - Windows PowerShell: `irm https://raw.githubusercontent.com/radiotedu/rtai-mobile/main/terminal/install.ps1 | iex`
    - npm global: `npm install -g git+https://github.com/radiotedu/rtai-mobile.git#main:terminal`
  - Packaged npm tarball `radiotedu-1.3.5.tgz`.
- Tested single APK (including Android Auto `RadioTeduCarService`, Media3 session, and all 6 stations) prepared and uploaded to GitHub Release `v1.3.5`.
- Tests: Terminal 7/7 tests pass + syntax check pass; Mobile Jest 90/90 suites (340/340 tests pass); Android publish audit 36/36 pass.
- Clean git tree on `origin/main`.
