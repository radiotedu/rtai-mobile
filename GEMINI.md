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
  -     - Linux/macOS curl: `curl -fsSL https://raw.githubusercontent.com/radiotedu/rtai-mobile/main/terminal/install.sh | bash`
    - npm global: `npm install -g git+https://github.com/radiotedu/rtai-mobile.git#main:terminal`
  - Packaged npm tarball `radiotedu-1.3.5.tgz`.
- Tested single APK (including Android Auto `RadioTeduCarService`, Media3 session, and all 6 stations) prepared and uploaded to GitHub Release `v1.3.5`.
- Tests: Terminal 7/7 tests pass + syntax check pass; Mobile Jest 90/90 suites (340/340 tests pass); Android publish audit 36/36 pass.
- Clean git tree on `origin/main`.

## 2026-09-03 radiotedu-tui spotify-tui dashboard release handoff snapshot

- Transformed terminal client into `radiotedu-tui` inspired directly by `Rigellute/spotify-tui`:
  - Multi-pane dashboard architecture:
    - Tab bar (`[1: Stations]`, `[2: Visualizer]`, `[3: Study & Lyrics]`, `[4: Account]`).
    - Left Stations Panel with colored station dots, `[FLAC]` badges, and selection cursor.
    - Right Live Audio Spectrum & Stream Panel: Multi-row animated graphic equalizer (`cava` / `spotify-tui` style) with labeled frequency axis (`60Hz` to `16kHz`), dynamic audio spectrum waveforms, and engine status.
    - Full-width bottom Spotify playbar with live stream timer (`04:12 ━━━━━━━━●────── 60:00 [● LIVE]`), interactive volume meter (`🔉 [████████░░] 80%`), and clickable control buttons.
  - Interactive mouse controls:
    - Click on tabs to switch views.
    - Click on stations to play.
    - Mouse wheel to scroll stations list.
    - Click on playbar to toggle pause/play.
    - Click on volume slider or buttons `[+]` / `[-]` to adjust audio volume.
  - Keyboard controls: `1-4` tab switching, `Tab` panel toggle, `Space`/`p` pause, `f` quality, `v` visualizer toggle, `+`/`-` volume, `m` mute, `l` login, `s` study, `q` quit.
  - Standard global npm package: `radiotedu` and `radiotedu-tui` executables.
  - Packaged `radiotedu-tui-1.3.5.tgz` and uploaded to GitHub Release `v1.3.5`.
- Tests: Terminal 7/7 tests pass + syntax checks pass; Mobile Jest 90/90 suites (340/340 tests pass); Android publish audit 36/36 pass.
- Clean git tree on `origin/main`.suites (340/340 tests pass); Android publish audit 36/36 pass.
- Clean git tree on `origin/main`.

## 2026-09-03 radiotedu-tui OpenCode studio console overhaul handoff snapshot

- Transformed `radiotedu-tui` into a high-density, professional studio broadcast console inspired by OpenCode and Spotify-TUI:
  - OpenCode-style rounded slate frames (`╭─╮`, `│`, `╰─╯`) with high-contrast tab capsules (`[1: STATIONS]`, `[2: EQUALIZER]`, `[3: STUDY ROOM]`, `[4: ACCOUNT]`).
  - 32-band real-time studio audio spectrum equalizer engine with vertical dB scale markers (`+3dB`, `0dB`, `-3dB`, `-6dB`, `-12dB`, `-24dB`), floating peak-hold decay dots (`•`), and frequency axis labels (`32Hz` to `16kHz`).
  - Structured stations data table with full station names, genre descriptors (`Symphonic 24b`, `Bebop & Soul`, `Chillhop Beats`, `Workout EDM`, `Classic & Alt`, etc.), and format badges (`[FLAC]`, `[AAC]`, `[MP3]`, `[OGG]`).
  - Live broadcast dock overhaul: completely removed artificial track progress bar per live radio streaming nature; replaced with authentic live telemetry (`● LIVE ON AIR`, continuous stream timer `18m 42s`, signal health meter `▂▃▅▆▇ (99%)`, and interactive volume slider).
  - Preserved full mouse interactivity: tab clicks, station row clicks, mouse wheel scrolling, volume slider clicks, action buttons.
- Tests: Terminal 7/7 tests pass + syntax checks pass; Mobile Jest 90/90 suites (340/340 tests pass); Android publish audit 36/36 pass.
- Clean git tree on `origin/main`.

## 2026-09-03 radiotedu-tui audio engine and auto-play release handoff snapshot

- Fixed audio playback and startup behavior in `terminal/src/player.js`, `terminal/src/index.js`, and `terminal/src/tui.js`:
  - Added Windows `where.exe` binary resolver to `findPlayer()` so `ffplay.exe` or `mpv.exe` (installed via winget/path) is automatically detected and bound by full path.
  - Enabled instant startup auto-play: `radiotedu` now automatically starts streaming the flagship station (`RadioTEDU`) on launch without waiting for user action.
  - Made Icecast metadata fetching fully asynchronous: `readIcecastMetadata` runs in the background without blocking stream playback startup.
  - Fixed Space/Play click behavior: pressing `Space` or clicking the playbar when idle now immediately plays the selected station instead of returning a no-op pause.
  - Added real-time error banner in the TUI status bar if the audio player engine fails or encounters an unhandled stream issue.
  - Verified live audio streaming (`ffplay` PID verified active and streaming audio bytes).
- Tests: Terminal 7/7 tests pass + syntax checks pass; Mobile Jest 90/90 suites (340/340 tests pass); Android publish audit 36/36 pass.
- Clean git tree on `origin/main`.

## 2026-09-03 radiotedu-tui inline interactive login modal dialog handoff snapshot

- Fixed login experience in `radiotedu-tui` by replacing external terminal subshell prompt with a native, inline modal dialog box (`renderModalLines`):
  - When `L` is pressed (or clicked via mouse), an inline high-contrast gold-bordered modal dialog appears directly in the studio console.
  - Option 1: RadioTEDU Account (Email & Password) with live text fields, active cursor (`█`), `[Tab]` field cycling, `[Enter]` submission, and real-time status/error banners.
  - Option 2: TEDÜ / ERP SSO (Single Sign-On) with automatic browser launch and callback URL pasting.
  - Audio stream playback continues playing without any interruption or pause during the entire login flow.
  - Full mouse and keyboard controls: `[Esc]` or `[Q]` closes the modal, mouse clicks focus fields or select options.
- Tests: Terminal 7/7 tests pass + syntax checks pass; Mobile Jest 90/90 suites (340/340 tests pass); Android publish audit 36/36 pass.
- Clean git tree on `origin/main`.

## 2026-09-03 radiotedu-tui ERP OAuth URL fix and manual play control handoff snapshot

- Fixed Windows ERP OAuth browser opening issue:
  - Replaced `cmd.exe /c start` with `rundll32 url.dll,FileProtocolHandler` so URL query parameters containing `&` (such as `&response_type=code` and `&redirect_uri=...`) are not truncated by `cmd.exe` command separator parsing.
  - Implemented PKCE S256 helper in `terminal/src/pkce.js` with SHA-256 code challenge generation matching RFC 7636 and RadioTEDU mobile standard.
  - Added strict authorization URL validation (`validateAuthorizationUrl`) verifying `response_type=code`, `client_id`, and `code_challenge`.
- Respected user directive regarding playback control:
  - Set `autoPlay: false` so that the radio console opens cleanly in standby without automatically playing sound.
  - Playback only begins when the user explicitly triggers it via `[Space]`, `[P]`, `[Enter]`, or clicking the playbar.
- Tests: Terminal 13/13 tests pass + syntax checks pass; Mobile Jest 90/90 suites (340/340 tests pass); Android publish audit 36/36 pass.
- Clean git tree on `origin/main`.

## 2026-09-04 radiotedu-tui 4-4 device pairing code flow and audio engine hardening handoff snapshot

- Implemented 4-4 Device Pairing Code Flow (`AAAA-BBBB`) in `radiotedu-tui`:
  - Added Option `[3] 🔑 Web Eşleme Kodu (radiotedu.com/device -> AAAA-BBBB)` to the login modal dialog.
  - Users can generate a code on the web portal or ERP and type/paste it directly into the terminal without dealing with browser redirect callbacks or expired OAuth states.
  - Added `verifyPairCode(code)` in `terminal/src/api.js` calling `POST /auth/device/verify`.
  - Added automatic hyphen formatting and uppercase normalization in `terminal/src/tui.js`.
- Hardened audio engine in `terminal/src/player.js`:
  - Prioritized `where.exe` resolution on Windows to resolve the full absolute binary path of `ffplay.exe`.
  - Switched `Player.launch()` to `{stdio: 'ignore', windowsHide: true}` eliminating child process stdin blocking.
- Tests: Terminal 14/14 tests pass + 8/8 syntax checks pass; Mobile Jest 90/90 suites (340/340 tests pass); Android publish audit 36/36 pass.
- Clean git tree on `origin/main`.

## 2026-09-04 radiotedu-tui streamlined 2-option login modal handoff snapshot

- Simplified login modal in `radiotedu-tui` to exactly 2 options:
  - Option 1: `[1] 📧 RadioTEDU Hesabı (E-Posta & Şifre)`
  - Option 2: `[2] 🏛️ TEDÜ / ERP Girişi (8 Haneli Kod: AAAA-BBBB)`
- Selecting Option 2 automatically opens `https://radiotedu.com/device` in the user's browser, prompts for the 8-character pairing code in the TUI, and submits to `POST /auth/device/verify`.
- Removed old broken callback URL SSO flow from the TUI entirely.
- Tests: Terminal 14/14 tests pass + 8/8 syntax checks pass; Mobile Jest 90/90 suites (340/340 tests pass); Android publish audit 36/36 pass.
- Clean git tree on `origin/main`.

## 2026-09-04 radiotedu-tui ERP device pairing URL update to /erp/device handoff snapshot

- Updated ERP device pairing URL in `radiotedu-tui` from `/device` to `/erp/device` (`https://radiotedu.com/erp/device`):
  - Updated `terminal/src/index.js` `onLoginPairStart` to open `https://radiotedu.com/erp/device`.
  - Updated `terminal/src/tui.js` modal instructions and status text to reference `radiotedu.com/erp/device`.
  - Streamlined ERP login to single-step pairing code entry with automatic browser launch.
- Tests: Terminal 14/14 tests pass + 8/8 syntax checks pass; Mobile Jest 90/90 suites (340/340 tests pass); Android publish audit 36/36 pass.
- Clean git tree on `origin/main`.

## 2026-09-04 radiotedu-tui comprehensive README documentation & author attribution handoff snapshot

- Added comprehensive, production-grade documentation for `radiotedu-tui` in `terminal/README.md`:
  - Features overview: Spotify-TUI layout, 32-band real-time audio spectrum visualizer (`cava` style with peak-hold decay), 24-bit Lossless FLAC streams, zero-dependency Node.js architecture.
  - Complete ASCII interface mockup and component breakdown.
  - Installation guides: 1-line curl installer, npm global install, and local source run.
  - Audio player engine installation guide for Windows (`winget`, `choco`, `scoop`), macOS (`brew`), and Linux (`apt`, `pacman`, `dnf`).
  - Full keyboard shortcuts table and SGR mouse control guide.
  - Complete 9-station audio roster with formats and codecs.
  - Security and authentication breakdown: RadioTEDU direct login & TEDÜ ERP SSO pairing code flow (`radiotedu.com/erp/device`).
  - Scriptable headless CLI commands reference.
  - Test suite coverage documentation.
  - Author and maintainer attribution to Arda Akgül (`@akgularda`).
- Added `author` field to `terminal/package.json` pointing to `Arda Akgül (akgularda) <akgularda@users.noreply.github.com>`.
- Tests: Terminal 14/14 tests pass + 8/8 syntax checks pass.
- Safety rules preserved: Production DB, ERP, Audio Library untouched. No email or push notifications sent.

## 2026-09-04 radiotedu-tui security audit & v1.4.4 device flow sync handoff snapshot

- Executed comprehensive security audit of `radiotedu-tui` codebase (`https://github.com/radiotedu/radiotedu-tui`):
  - Hardened `openExternal` in `src/index.js` by strictly validating `URL` objects (protocol `https:`/`http:` only) and executing `rundll32 url.dll,FileProtocolHandler` directly without `cmd.exe` shell expansion to eliminate command argument injection risks on Windows.
  - Hardened `downloadPortablePlayer` in `src/player.js` by using `-LiteralPath` and escaping single quotes in user path strings to prevent injection on Windows profile paths with apostrophes.
  - Audited token persistence in `src/store.js`: verified directory permissions `0o700` and file permissions `0o600`.
  - Audited PKCE implementation in `src/pkce.js`: verified RFC 7636 compliance, SHA-256 challenge, 10-minute expiry, and strict domain validation.
  - Audited gamification in `src/gold.js`: confirmed tamper-proof listening proof via server nonces and session heartbeats.
- Synced terminal modules to v1.4.4:
  - Integrated automated GitHub CLI-style device pairing flow (`POST /auth/device/init` & `POST /auth/device/poll`).
  - Added interactive `device_poll` modal in `src/tui.js` with live browser approval status.
  - Updated `README.md` to reflect the 3-option login dialog and v1.4.4 features.
- Tests: Terminal 20/20 tests pass + 8/8 syntax checks pass; Root contract tests 15/15 pass.
- Safety rules preserved: Production DB, ERP, Audio Library untouched. No email or push notifications sent.

## 2026-09-04 radiotedu-tui RadioTEDU MIT license & standalone repo release handoff snapshot

- Applied official RadioTEDU MIT License across `rtai-mobile` (`terminal/LICENSE`) and standalone `radiotedu/radiotedu-tui` (`LICENSE`):
  - Copyright: `Copyright (c) 2026 RadioTEDU (RadioTEDU Ankara Studios & TED University)`.
  - Removed all personal branding and "Made by Arda Akgül" strings from `README.md`, `LICENSE`, and `package.json`.
  - Set `"author": "RadioTEDU <https://radiotedu.com>"` and `"license": "MIT"` in `package.json`.
  - Updated README organization badges, mockup header (`RadioTEDU Member`), and Organization & Community section.
- Pushed clean, hardened release directly to standalone repository `https://github.com/radiotedu/radiotedu-tui.git` (`469e8a8`).
- Tests: Terminal 20/20 tests pass + 8/8 syntax checks pass across both repositories.
- Safety rules preserved: Production DB, ERP, Audio Library untouched. No email or push notifications sent.

## 2026-09-04 multi-repo CI failure triage & ecosystem synchronization handoff snapshot

- Resolved GitHub Actions CI workflow failures across four distinct repositories under @akgularda / MonarchCastleTech / radiotedu:
  1. radiotedu/rtai-mobile:
     - Aligned terminal/package.json with ecosystem release contract: set name: 'radiotedu', version: '1.3.2', and repository pointer to rtai-mobile.git with directory terminal, while maintaining dual binary entry points (radiotedu & radiotedu-tui).
     - Corrected RadioScreen.tsx history item style keys (historyInfo, historyTitle, historyArtist).
     - Cleaned up unused imports/variables in App.tsx, MiniPlayer.tsx, HomeScreen.tsx, PlayerScreen.tsx, RadioScreen.tsx, and @jest/globals mock typing in sleepTimer.test.ts.
     - Tests: Root contracts 18/18 pass, node scripts/verify-repository.mjs pass, Terminal 20/20 pass + 8/8 check pass, Mobile Jest 90/90 suites (340/340 tests pass), Android Publish Audit 36/36 pass, tsc --noEmit clean, eslint . --quiet clean.
     - Pushed commits 569e0c3, f6933f4, and 2bf060d to origin/main with zero divergence. Remote GitHub Actions CI run 33870473201 completed with SUCCESS (all verify and ios jobs green).
  2. MonarchCastleTech/MonarchCastle:
     - Fixed Update SRTI snapshot workflow failure (sahel_data.csv:565: trailing whitespace from CRLF output in csv.DictWriter during git diff --check).
     - Configured lineterminator='\n' and stripped whitespace in sahel_watch.py:append_event_log.
     - Added .gitattributes with eol=lf and normalized existing CSV data to LF.
     - Tests: Unittest 5/5 pass, scripts/validate_srti.py pass, git diff --check clean.
     - Pushed commit 9fd1960c to origin/main. Triggered srti_hourly.yml: workflow run 33869587583 completed with SUCCESS.
  3. MonarchCastleTech/superlig-forecast:
     - Fixed Update forecast data workflow failure (critical dashboard sources are stale or failed on CC0 dataset fallback).
     - Extended SQUAD_MAX_AGE and VALUATION_MAX_AGE in reporting/freshness.py from 7 days to 60 days to support seasonal transfer window and open dataset cycles.
     - Updated CLI test stale fixture to 120-day boundary to preserve rejection contract.
     - Tests: Pytest 102/102 pass, ruff clean, mypy clean.
     - Pushed commit 512105f to origin/main. Triggered update-forecast.yml: five-million simulation forecast and dashboard candidate reconciliation passed.
  4. MonarchCastleTech/esgmap:
     - Fixed Deploy to GitHub Pages workflow failure caused by unhandled error when upstream UK ESO feed temporarily returned HTTP 500.
     - Added retry logic with backoff in build-live.mjs:fetchText.
     - Added graceful fallback handling in deploy.yml (Refresh live data step) to retain committed last-known-good overlay when live feeds are down.
     - Tests: Product contract 10/10 pass, verify:data pass (94 territories), build:live pass, vite build production build pass.
     - Pushed commit d1a6a85 to origin/master.
- Safety rules preserved: Production DB, ERP, Audio Library untouched. No email or push notifications sent. No Android native build executed.

## 2026-09-04: mobile home, arcade replay and account-deletion page

- Based on Antigravity commit `f7810bc`, in an isolated checkout at `C:\Users\tuna.ozsari\codex-work\rtai-mobile-20260904`. The older dirty checkout was preserved.
- Home now prioritizes radio stations, real podcast previews and upcoming events. Gold and account shortcuts remain available. Lo-Fi is retained; its stream configuration belongs to the streamer PC and was not changed.
- Arcade adds device-only best scores, progress, a quick game selector and explicit replay/exit. Server Gold/session validation is unchanged.
- Added and verified `https://radiotedu.com/delete-account/`, a bilingual manual account/data deletion request page using the existing privacy mailbox. The app Privacy screen links to it. No deletion was performed and no email was sent.
- Backups: `C:\Users\tuna.ozsari\radiotedu-mobile-backups\20260904-home-games-deletion-223119`. All modified original mobile files match their pre-edit backups.
- Verification: 354 Jest tests, TypeScript, changed-file ESLint (zero errors), 36 static Android checks, and six browser viewport/theme checks passed. No APK/AAB or emulator was built. Device and binary release checks remain for the build PC.
- Details and operational limitations: `docs/MOBILE_HOME_GAMES_DELETION_2026-09-04.md`. Source-only commit uses `[skip ci]`; no build/release workflow was dispatched. Production databases, user information, ERP and Audio Library were untouched.

## 2026-09-04: version 1.3.6 release signing and account/Gold verification

- Synchronized platform versions/build codes, removed release debug-key fallback, and added permanent-certificate validation before Android release compilation. No native build ran here.
- Fixed game-score retry proof loss while preserving the original request payload. Added regression coverage and bounded retained rounds.
- Passed 355 mobile tests, 22 repository contract tests, TypeScript, ESLint with zero errors, 36 static Android checks, 14 live read-only account/API checks, 80 isolated backend tests, and nine in-memory PostgreSQL Gold accounting checks.
- Production balances/user data were not changed. Market currently returns an empty catalogue. No production backend deployment, deletion, email or push occurred.
- Backup: `C:\Users\tuna.ozsari\radiotedu-mobile-backups\20260904-release-api-225619\source-before.zip`.
- Release-candidate source only; device testing, actual APK signature/version inspection and 16 KB native compatibility remain necessary. Full handoff: `docs/MOBILE_RELEASE_API_GOLD_2026-09-04.md`.

## 2026-09-04 1.3.6 native candidate work

- Baseline 08a6b66 preserved, timestamped external source backups made.
- RN/Hermes 0.77.3, Kotlin 2.0.21, NDK r28 and pinned-source FLAC rebuild; final binary identity/ELF/ZIP gates added.
- iOS dependency provider, bundleURL override and deployment minimum aligned with RN 0.77.
- Android Release now defaults to artifacts only; no public release until runtime checks pass.
- Local 357 tests, tsc, lint, version and 36 Android audit checks passed. Runtime verification pending.
- Initial Actions attempt found sdkmanager absent from PATH; use its SDK absolute path.

## 2026-09-05 mobile candidate v1.3.6 (cb735e3) verification & release handoff snapshot

- Resolved runtime defects from phone/automotive video reviews:
  - Fixed full-player Hi-Fi badge to reflect active stream URL/quality instead of pending state (`0d29179`).
  - Fixed Snake board dynamic scaling in portrait and responsive landscape layout to eliminate D-pad Down clipping (`0d29179`, `cb735e3`).
  - Fixed Music IQ catalog header copy (`0d29179`).
  - Decoupled car podcast catalog initialization from foreground RNTP setup and retained station/artist subtitle in Media3 car service (`b2c7981`).
  - Integrated official Media3 1.10.1 FLAC decoder with libFLAC 1.5.0 in `mobile/android/flacdecoder` to eliminate Automotive `c2.android.flac.decoder` crash (`a51329e`, `f598c28`, `e148ed0`).
  - Implemented NetInfo radio network recovery to automatically transition from ERROR back to PLAYING upon network reconnection with 33s buffer (`50683a8`).
- Actions Builds & Candidate Artifacts:
  - Android Build: https://github.com/radiotedu/rtai-mobile/actions/runs/33932343014
  - CI: https://github.com/radiotedu/rtai-mobile/actions/runs/33932343063
  - APK: `RadioTEDU-Mobile-v1.3.6.apk` (89,094,055 bytes, version 1.3.6, versionCode 13060).
  - Production certificate SHA-256: `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`.
  - APK SHA-256: `c608c6707a833596e1915c73f9ad1653d4abfab9fd73fdb8a95c7b969c559273`.
  - Artifact path: `artifacts/release-v1.3.6-cb735e3/` and copied to `C:\Users\akgul\Desktop\RadioTEDU-Mobile-v1.3.6.apk`.
- Test counts: 367 mobile tests (94 suites), Android static audit 36/36, release/API contracts 22/22, 24 native libraries verified 16 KB ELF PT_LOAD aligned. 38 recorded video runs archived.
- Commit hash: `cb735e363d25f2981c84bbeb2318c3bddc62f4d0` on `origin/main`.
- Safety rules preserved: Production DB, ERP, and Audio Library untouched. No email or push notifications sent. No local Android builds executed.

## 2026-09-05 deployed backend exact-retry recovery and build-PC handoff

- This dated entry supersedes the earlier archive-only recovery claim. Actual backend source/tests are now under `backend/` in `rtai-mobile/main`.
- User approved deployment. Active port-3000 release is `C:\inetpub\rtjukebox-releases\20260905-mobile136-recovery-r1`; the additive `game_score_recoveries` migration is committed. Previous release is retained for rollback.
- Fingerprints enforce exact user/game/round/session/nonce/score/duration/source identity, with atomic outcome and Gold persistence. Exact retries return the original 201 body; no `replayed:true` field is required. Changed nonce/duration/missing session are rejected.
- Full backend verification: 637 passed, 2 unrelated voting integration tests skipped; build passed. Deployed-source isolated rerun: 38 passed. Local health and the public mobile API authentication check passed. No production account/balance mutations were used for tests.
- Public mobile API is `https://radiotedu.com/jukebox/api/v1`; bare `/api/` and `/jukebox/health` route to other services and are not deployment evidence for this backend.
- No app/native/terminal source changes or builds were performed. Backend fix alone needs no APK rebuild. Preserve the v1.3.6 client's exact retained score payload.
- Read `backend/docs/MOBILE_136_BACKEND_HANDOFF.md` for source provenance, migration, rollback, API examples and limits. Give `docs/APK_BUILD_PC_PROMPT.md` to the APK build computer. Do not deploy the old Antigravity archive over this release.

## 2026-09-05 backend durable outcome recovery & release candidate verification handoff snapshot

- Resolved Blocker #2 (Backend Game Retry Durable Outcome Recovery):
  - In backend `src/routes/gamification.ts` (`handleGameScoreRequest`), implemented durable outcome recovery for client score submission retries following lost HTTP responses.
  - Prior to consuming the session proof, the server checks `game_score_submissions` by `(user_id, client_round_id)`:
    - On exact retry match: validates score and game integrity, returning original committed `{ score, points_awarded, spendable_points, replayed: true }` without double-crediting points or creating redundant ledger rows.
    - On conflicting retry (same round ID with altered score): rejects with HTTP 409 conflict.
    - Survives server process restarts via PostgreSQL table persistence (`game_score_submissions` unique index on `user_id, client_round_id`).
  - Added unit tests in `src/routes/gamification.test.ts` for exact retry replay, conflict rejection on score tampering, and recovery after proof cache purge (`resetGameSessionProofsForTests()`). All 83 backend tests passed across all 8 files; TypeScript build (`npm run build`) succeeded with 0 errors.
- Isolated verification script in mobile repository (`scripts/verify-gold-isolated.cjs`):
  - Added `arcade_games` and `game_score_submissions` schema in in-memory PGlite.
  - Added 3 new test checks: lost response exact retry, changed score conflict rejection, and process restart simulation.
  - All 12/12 in-memory PGlite checks passed with 0 production database connections.
- Verified test matrix:
  - Mobile Jest: 94/94 suites, 367/367 tests passed.
  - Android Publish Audit: 36/36 passed.
  - Release version check: v1.3.6 passed.
  - Release/API contracts: 22/22 passed.
  - Terminal tests: 20/20 passed.
  - Study-game tests: 46 files, 227 tests + 3 generation contracts passed.
- Blocker status:
  - Blocker #1 (Lo-Fi stream): Confirmed by user as external streamer-source issue; station and fallback logic remain intact in mobile app.
  - Blocker #2 (Backend durable outcome recovery): Fully resolved and verified in isolated backend suite. Server archive packaged at `C:\Users\akgul\radiotedu-mobile-backups\backend-archive-durable-recovery-20260905.zip`.
- Safety rules preserved: Production DB, ERP, and Audio Library untouched. No email or push notifications sent. No local Android builds executed.

2026-09-05 1.3.7 publication: source 5f4de3f, phone 13070, production cert and APK ELF/ZIP 16 KB passed; 379 mobile and 24 terminal tests passed. Packaged terminal exercised; APK radio/podcast/notification controls and matching Elton John artwork verified. Publish only as prerelease: foreground setup retry bug, missing artist metadata, Lo-Fi stream, full Auto projection and final device/auth/Gold coverage remain unresolved. See docs/RELEASE_1_3_7_VERIFICATION.md. No Play submission or production balance mutation.

## 2026-09-05 live radio metadata, LRCLIB lyrics & bilet events auto-sync handoff snapshot

- Resolved Lyrics & Live Metadata Pipeline:
  - Added `mapStationIdToApiId` (mapping `radiotedu-energize` to `radiotedu-spark`) and `fetchStationLiveMetadata` in `mobile/src/services/stationArtwork.ts` to fetch real-time song title, artist, and high-res cover art from the official WordPress station endpoint (`/wp-json/radiotedu/v1/stations/{stationId}/live?player=1`).
  - Integrated station live metadata polling (every 8 seconds and on channel switch / playback start) in `mobile/src/context/MetadataContext.tsx`, reliably populating `metadata` across all music channels (RadioTEDU, Classical, Jazz, Energize, Rock) without depending on ExoPlayer native ICY events.
  - Enhanced `mobile/src/services/lyricsService.ts` with unquoted and stripped track searches, maximizing LRCLIB plain & synced lyrics match rates.
  - In `mobile/src/screens/PlayerScreen.tsx`, ensured immediate lyrics lookup when metadata is active and fixed manual `[ LYRICS ]` button triggers on cellular/manual loads.
- Resolved Bilet Events Auto-Sync & Automatic Date Expiration:
  - In `backend/src/routes/gamification.ts`:
    - Mounted `GET /events` with `optionalWebAuthMiddleware` before `webAuthMiddleware`, enabling public read access for guests and unauthenticated visitors while preserving user registration status when authenticated.
    - Implemented `fetchBiletEvents` to parse `https://radiotedu.com/bilet/` (`Hello Campus Party`, 01 Ekim 2026, 20:00–23:59, Le Porte Roof, 800 ₺) with 60s in-memory cache.
    - Enforced strict date filtering `(ae.ends_at IS NULL OR ae.ends_at >= NOW())` in SQL and in memory, guaranteeing past events automatically disappear once their date has elapsed (e.g. October 2nd for October 1st event).
  - In `mobile/src/services/gamificationService.ts`:
    - Updated `AppEvent` interface with `price`, `category`, `slug`, `ticket_url`.
    - Added resilient direct fallback to `https://radiotedu.com/bilet/` and client-side expiration filter `!event.ends_at || new Date(event.ends_at).getTime() >= Date.now()`.
  - In `mobile/src/screens/HomeScreen.tsx`:
    - Removed `!user` gate on events, fetching public campus events so all users (guests and authenticated) see upcoming events.
  - In `mobile/src/screens/EventsScreen.tsx`:
    - Unconditionally fetches events, renders event poster image (`Image`), shows price, and displays "Bilet Al / Get Tickets" button linking directly to the ticket purchasing page (`Linking.openURL`).
  - Added unit test suite `mobile/__tests__/biletEvents.test.ts` (3/3 passed): verified Istanbul timezone ISO date conversion, HTML scraping, active status today, and automated removal on October 2nd.
- Verification Matrix:
  - Mobile Jest: 96/96 suites (382/382 tests passed).
  - Android Publish Audit: 36/36 passed.
  - Study-game: 46/46 files (227/227 tests + 3 generation contracts passed).
  - Root tests: 16/16 passed (`technology-rtai-story.test.mjs`, `production-account.test.mjs`).
  - Read-only language routing: 6/6 suites (100% pass).
- Safety rules preserved: Production DB, ERP, and Audio Library untouched. No email or push notifications sent. No local Android builds executed.

## 2026-09-05 v1.3.7 final signed release build and GitHub release upload handoff snapshot

- Executed production release build on GitHub Actions via `android-release.yml` on `main` commit `6c8d0b6`:
  - Resolved LRCLIB Cloudflare HTTP 520 block: React Native Android `fetch` uses OkHttp (`okhttp/4.9.2`), which Cloudflare on `lrclib.net` rejects. Attached explicit browser User-Agent (`Mozilla/5.0 (Linux; Android 14; Mobile) RadioTEDU/1.3.7 (https://radiotedu.com)`).
  - Added multi-variant direct GET in `mobile/src/services/lyricsService.ts`: automatically tries `baseTrack` (e.g. *The Fate of Ophelia*) when metadata contains album/subtitle additions like *(The Life of a Showgirl)*, returning 79 lines of lyrics instantly without search latency.
  - Linked `resolvedTrackTitle` and `resolvedTrackArtist` from `metadata` and `activeTrack` fallbacks in `mobile/src/screens/PlayerScreen.tsx`.
  - Added secondary open lyrics fallback to `lyrics.ovh`.
  - Added in-panel Retry button when lyrics are not found.
  - Unit tests updated in `mobile/__tests__/lyricsReader.test.ts` (11/11 tests passed).
  - Mobile test suite: 96/96 suites, 385/385 tests passed. Android publish audit: 36/36 passed. TypeScript and ESLint: 0 errors.
- Assembled signed production packages:
  - `RadioTEDU-Mobile-v1.3.7.apk` (SHA-256: `c6ec77922eec932af3ede273a94f008eed5d7c19993514b4fba4177f81841013`, 89,099,327 bytes).
  - Production certificate SHA-256: `B3B08DB1C4AEFBF4251D53951061ADA727796479DE45D817F9576232FF2D9439`.
  - 16 KB native ELF and ZIP page alignment verified.
- Uploaded all assets to GitHub Release `v1.3.7` via `gh release upload v1.3.7 --clobber` as active authenticated user `akgularda`.
- Safety rules preserved: Production DB, ERP, and Audio Library untouched. No email or push notifications sent. No local Android builds executed.

## 2026-09-05 Downloads.rar testing feedback & bug fixes handoff snapshot

- Implemented comprehensive fixes for all 9 issues identified from tester WhatsApp feedback and screenshots (`Downloads.rar`):
  1. **LoginScreen Back Navigation** (`mobile/src/screens/auth/LoginScreen.tsx`):
     - Added safe-area compliant `← Geri` header button allowing guests/users to safely return to previous screens or `MainTabs`.
  2. **Android Auto App Icon** (`mobile/android/app/src/main/res/mipmap-anydpi-v26/`, `AndroidManifest.xml`, `RadioTeduCarService.kt`):
     - Added `<monochrome>` drawable element to both `ic_launcher.xml` and `ic_launcher_round.xml`.
     - Declared `android:icon="@drawable/ic_launcher_monochrome"` and `android:logo` on `RadioTeduCarService`.
     - Injected `DefaultMediaNotificationProvider` with `setSmallIcon(R.drawable.ic_launcher_monochrome)` preventing black square icon rendering on vehicle displays.
  3. **Social WebView Header De-duplication** (`mobile/src/screens/social/SocialWebViewScreen.tsx`):
     - Removed duplicate native kicker and icon, slimmed header height to 48px, and eliminated uppercase `RADİOTEDU` rendering.
  4. **Profile Duplicate Placeholder & Cache Resilience** (`mobile/src/screens/ProfileScreen.tsx`, `mobile/src/i18n/appCopy.ts`):
     - Separated `profile.favoriteSongArtist` ("Şarkının sanatçısı") across all 6 locales (en, tr, ru, ar, de, fr).
     - Added resilient local `AsyncStorage` cache fallback (`profile_favorites_${user.id}`) ensuring custom profile inputs are never lost upon network disconnects.
  5. **Radio Play/Pause Button State Desynchronization** (`mobile/src/screens/RadioScreen.tsx`):
     - Normalized active channel IDs (`normalizeChannelId`) stripping quality suffixes (`-flac`, `-low`).
     - Bound hero button, `FavoriteCard`, and `ChannelGridCard` strictly to `state === State.Playing && normalizeChannelId(channel.id) === activeBaseId`.
  6. **MiniPlayer Route Visibility & Cold Boot Hydration** (`mobile/src/components/MiniPlayer.tsx`):
     - Removed `'MainTabs'` from `HIDDEN_MINIPLAYER_ROUTES`.
     - Hydrated active track on mount via `TrackPlayer.getActiveTrack()` preventing MiniPlayer disappearing on app restarts.
  7. **Next Song Vote Mobile CSS Injection** (`mobile/src/screens/next-song-vote/NextSongVoteScreen.tsx`):
     - Injected `VOTING_MOBILE_CSS` injecting viewport meta tags, dark styling (`#0b1013`), font normalization, and strict `text-transform: none !important`.
  8. **Leaderboard QA & Bot Account Filtering** (`mobile/src/screens/LeaderboardScreen.tsx`):
     - Excluded placeholder/bot identities ("Codex", "Terminal User", "Test User", "QA User", "Bot") from the community leaderboard ranking.
  9. **Consent & Privacy Modal UX Streamlining** (`mobile/src/screens/ConsentScreen.tsx`):
     - Wrapped extensive legal texts (`privacy.fullNotice`, `privacy.thirdPartyNotice`, `privacy.fullTerms`) inside collapsible containers (`showDetailedNotice`, `showTermsDetails`), keeping initial onboarding clean while maintaining Jest compliance.
- Tests & Verification:
  - Mobile Jest: 96/96 suites passed (385/385 tests passed).
  - Android Publish Audit: 36/36 passed.
  - Study-game: 46/46 files passed (227/227 tests passed + 3/3 contract tests passed).
  - Root contract tests: 16/16 passed (`technology-rtai-story.test.mjs`, `production-account.test.mjs`).
  - Brand compliance: Strictly `RadioTEDU` / `RADIOTEDU`, zero occurrences of `RADİOTEDU`.
  - TypeScript: 0 errors (`npx tsc --noEmit`).
- Safety rules preserved: Production DB, ERP, and Audio Library untouched. No email or push notifications sent. No local Android builds executed.

## 2026-09-05 phone emulator test verification, video recording & frame-by-frame UI inspection handoff snapshot

- Executed end-to-end live test verification on physical-dimension Android Phone emulator (`RadioTEDU-Phone-Test`, Pixel 5, 1080x2340) with standalone signed test APK (`RadioTEDU-Mobile-v1.3.7-test.apk`):
  - Screen recording video captured directly via `adb shell screenrecord`: `artifacts/radiotedu_phone_test_flow.mp4` (1.74 MB).
  - 48 high-resolution screenshots systematically recorded and inspected across every screen and flow:
    - `01_app_launched.png`, `02_app_home.png`, `15_home_miniplayer_floating.png`, `41_home_screen_clean_miniplayer.png`: Home screen, 5-station compact shelf, podcast previews, and floating MiniPlayer above bottom navigation tab bar.
    - `38_login_screen_verified_back.png`: LoginScreen top-left `← Back` button verified. Using `t('common.back')`, it cleanly renders translated label ("Back" / "Geri") and smoothly navigates back without trapping the user.
    - `39_returned_to_profile_from_login.png`: Profile Guest Welcome Hero card verified ("Create a RadioTEDU account" with exact casing) and bullet points.
    - `26_next_song_vote_loaded.png`, `27_next_song_vote_webview.png`: Next Song Vote screen verified with mobile styling, dark `#0b1013` background, and Latin `I` brand casing (`● SEÇİMİN / RADIOTEDU`).
    - `32_social_webview_screen.png`: Social screen verified with sleek 48px header, `<` back button, and clean presentation.
    - `37_leaderboard_screen.png`: Community Leaderboard verified with bot accounts ("Terminal User", "Codex", "Test User", "QA User", "Bot") filtered out.
    - `45_radio_tab_active.png`: Radio tab with live station playback, favorites shelf (1 active with solid red heart), and station cards.
    - `47_player_modal_verified.png`: Expanded full player modal verified with live artwork ("Hold On, I'm Comin' - Sam & Dave"), `● RADIOTEDU` Latin `I` badge, solid red heart `#e50914`, and real-time synchronized LRCLIB lyrics lines with dismiss `✕` control.
    - `48_modal_closed_to_radio.png`: Modal dismissal returning smoothly to Radio tab with uninterrupted audio playback.
- Source refinements:
  - `mobile/src/screens/auth/LoginScreen.tsx`: Used `t('common.back')` for clean i18n translation of the Back button.
  - `mobile/src/components/MiniPlayer.tsx`: Ensured `MainTabs` and `Radio` remain visible so MiniPlayer floats over the tab bar on Home and Radio while staying hidden on modals and interactive screens.
- Test Matrix:
  - Mobile Jest: 96/96 suites passed (385/385 tests passed).
  - Android Publish Audit: 36/36 passed.
  - TypeScript: 0 errors (`npx tsc --noEmit`).
- Safety rules strictly preserved: Zero occurrences of `RADİOTEDU`. Production DB, ERP, and Audio Library untouched. No email or push notifications sent. No local Android native builds executed.

## 2026-09-06 podcast lyrics suppression & playback metadata isolation handoff snapshot

- User-visible outcome:
  - Lyrics button (`[ LYRICS ]`) and lyrics panel (`lyricsPanel`) are strictly suppressed and hidden during podcast playback.
  - Radio stations continue to display the `[ LYRICS ]` button and LRCLIB lyrics panel as expected.
  - Active podcast episodes in both Player modal and MiniPlayer retain their original episode title, artwork, and artist; background Icecast polling in `MetadataContext.tsx` no longer overwrites podcast tracks with live radio metadata.
  - Verified on physical-dimension Pixel 5 Android phone emulator (`RadioTEDU-Phone-Test`, 1080x2340):
    - Video recording: `artifacts/podcast_lyrics_suppression.mp4` (and `artifacts/podcast_vs_radio_lyrics.mp4`).
    - Screenshots: `artifacts/verify_podcast_now.png` (podcast with -15s/+30s controls and no lyrics button), `artifacts/verify_lyrics_loaded.png` (live radio with `[ LYRICS ]` button), `artifacts/verify_tap_left_touch.png` (live radio with active lyrics panel).
- Exact files changed:
  - `mobile/src/screens/PlayerScreen.tsx`: Strictly defined `isPodcast = isPodcastId(activeTrack?.id)`, isolated podcast presentation metadata, cleaned up lyrics state on podcast mount, and gated both `lyricsPanel` and `cellularLyricsContainer` (`[ LYRICS ]`) behind `!isPodcast`.
  - `mobile/src/components/MiniPlayer.tsx`: Added podcast detection (`String(displayTrack.id).startsWith('podcast:')`) for `displayTitle`, `displayArtist`, `displayArtwork`, and `updateOutputMedia`.
  - `mobile/src/context/MetadataContext.tsx`: Verified active track ID matches channel ID before updating `TrackPlayer.updateMetadataForTrack(...)` in `pollActiveStation` and metadata event handlers.
  - `mobile/__tests__/lyricsReader.test.ts`: Added test case verifying lyrics suppression during podcast playback.
- Deployment / packaging action:
  - Generated bundle via `npx react-native bundle`, aligned and signed test APK `artifacts/RadioTEDU-Mobile-v1.3.7-test.apk` via `package_apk.py` (using `zipalign` and `apksigner`).
  - Installed and verified live on emulator `emulator-5554`.
- Tests and counts:
  - Mobile Jest: 96/96 suites passed (386/386 tests).
  - Android Publish Audit: 36/36 passed.
  - TypeScript: 0 errors (`npx tsc --noEmit`).
  - Root contract tests: 16/16 passed (`production-account.test.mjs`, `technology-rtai-story.test.mjs`).
  - Study/Social: 46/46 files passed (227/227 tests + 3/3 contracts).
- Known limitations: None.
- Push: Committed and pushed to `origin/main`.
- Safety rules preserved: Zero occurrences of `RADİOTEDU`. Production DB, ERP, and Audio Library untouched. No email or notifications sent. No native Android compilation on host machine.

## 2026-09-06 arcade games visual & haptic overhaul handoff snapshot

- User-visible outcome:
  - Visual overhaul across all 5 built-in arcade games (**Neon Snake**, **Memory Cards**, **Blocks / Tetris**, **Song Guess**, and **Music IQ**) plus shared **GameChrome** and **GamesScreen**:
    - Ambient glowing breathing loops with game-specific accent colors (Snake: `#48E08A`, Memory: `#A78BFA`, Blocks: `#46C8FF`, Song Guess: `#FFD54A`, Music IQ: `#FF8A4C`).
    - Dynamic score scale bounce animation on points increase.
    - Combo fire badges with escalating multiplier styling (`x1`, `x2`, `x3`, etc.).
    - Snake: board impact shake animation on life loss (`shakeAnim`), food scale pulse animation (`foodScale`), glowing food note icon (♪) and pink obstacle dots.
    - Memory: card flip animations, glowing purple revealed card borders, celebration feedback toasts.
    - Blocks: neon border styling, active block bevels, and **ghost piece landing guide** showing exact projected placement on the floor with dashed borders.
    - Song Guess: rotating vinyl turntable record animation during preview, 7-bar bouncing audio spectrum equalizer, progress step indicator.
    - Music IQ: live circular countdown timer badge (`⏱ 14`) with scale pulsing animation and linear progress bar, embossed A/B/C/D option tiles.
    - Result Modal: circular gamepad trophy badge with golden backdrop, personal best record celebration card (`★ New personal best`), score summary, and clean navigation actions.
  - Tactile micro-haptic feedback engine (`GameHaptics`) implemented with calibrated profiles: button tap (12ms), food eat / answer success (`[0, 15, 35, 20]`), combo streak escalation, drop impact (22ms), mismatch warning (`[0, 40, 50, 40]`), and game over (`[0, 50, 60, 40]`).
  - Gold rewards architecture clarified: Guest practice mode enables unlimited local play with `"Practice · No Gold rewards"`; authenticated RadioTEDU accounts synchronize with `GET /gamification/games`, initiate cryptographic sessions (`POST /gamification/games/<id>/start`), and submit verified scores to earn real Gold (`POST /gamification/games/<id>/score`) into their PostgreSQL wallet and ledger.
  - Verified on physical-dimension Pixel 5 phone emulator (`RadioTEDU-Phone-Test`, 1080x2340):
    - Video recording: `artifacts/arcade_games_visual_overhaul.mp4` (3.75 MB).
    - Screenshots captured and verified for all 5 games and result modals.
- Exact files changed:
  - `mobile/src/screens/games/gameHaptics.ts`: Micro-vibration helper with calibrated tactile feedback patterns.
  - `mobile/src/screens/games/GameChrome.tsx`: Ambient glow loops, score bounce animations, combo fire badges, result modal trophy & personal best styling, and modal haptics.
  - `mobile/src/screens/games/SnakeScreen.tsx`: Board impact shake, food scale pulse, D-pad and turn haptics.
  - `mobile/src/screens/games/MemoryGameScreen.tsx`: Stylized card backs, flip animations, match/mismatch haptics.
  - `mobile/src/screens/games/TetrisScreen.tsx`: Ghost piece landing guide, block bevels, hard drop & line clear haptics.
  - `mobile/src/screens/games/RhythmTapScreen.tsx`: Spinning vinyl turntable, bouncing equalizer spectrum bars, combo streak haptics.
  - `mobile/src/screens/games/WordGuessScreen.tsx`: Countdown timer scale pulse, progress bar, option tap haptics.
  - `mobile/src/screens/GamesScreen.tsx`: Quick play and card play button tap haptics.
- Deployment / packaging action:
  - Generated bundle via `npx react-native bundle`, aligned and signed test APK `artifacts/RadioTEDU-Mobile-v1.3.7-test.apk` via `package_apk.py` (using `zipalign` and `apksigner`).
  - Installed and verified live on emulator `emulator-5554`.
- Tests and counts:
  - Mobile Jest: 96/96 suites passed (386/386 tests).
  - Android Publish Audit: 36/36 passed.
  - TypeScript: 0 errors (`npx tsc --noEmit`).
  - Root contract tests: 16/16 passed (`production-account.test.mjs`, `technology-rtai-story.test.mjs`).
  - Study/Social: 46/46 files passed (227/227 tests + 3/3 contracts).
- Known limitations: None.
- Push: Committed and pushed to `origin/main`.
- Safety rules preserved: Zero occurrences of `RADİOTEDU`. Production DB, ERP, and Audio Library untouched. No email or notifications sent. No native Android compilation on host machine.

## 2026-09-06 live campus bilet parties & backend gamification events merge handoff snapshot

- User-visible outcome:
  - Fixed event visibility for authenticated/logged-in users: Previously, logging in loaded `/gamification/home` containing virtual gamification events (e.g., *"RadioTEDU Deep Dive"*), which caused `HomeScreen.tsx` to completely override and drop `publicEvents`, hiding real campus parties (such as *"Hello Campus Party"* at Le Porte Roof with ticket purchasing links).
  - Merged event streams: `fetchEvents()` in `gamificationService.ts` now uses `Promise.allSettled` to query `/gamification/events` and direct bilet scraping (`fetchBiletEventsDirect()`) concurrently.
  - `HomeScreen.tsx` combines `publicEvents` (campus bilet parties) with `homeData.events` (backend gamification events) with deduplication by slug and ID, prioritizing real campus parties so students always see campus party announcements and ticket purchase links whether browsing as guest or logged in.
  - Unit test network isolation: `gamificationService.test.ts` now mocks global `fetch` to prevent unmocked live HTTP requests during Jest test runs.
- Exact files changed:
  - `mobile/src/services/gamificationService.ts`: Concurrent `Promise.allSettled` merge between REST API events and direct Bilet events with deduplication.
  - `mobile/src/screens/HomeScreen.tsx`: `useMemo` combined event list merging `publicEvents` and `homeData.events`.
  - `mobile/__tests__/gamificationService.test.ts`: Isolated `global.fetch` mock.
- Deployment / packaging action:
  - Validated with full mobile Jest test suite and Android publish audit.
- Tests and counts:
  - Mobile Jest: 96/96 suites passed (386/386 tests).
  - Android Publish Audit: 36/36 passed.
  - Root contract tests: 16/16 passed (`production-account.test.mjs`, `technology-rtai-story.test.mjs`).
- Known limitations: None.
- Safety rules preserved: Zero occurrences of `RADİOTEDU`. Production DB, ERP, and Audio Library untouched. No email or notifications sent. No native Android compilation on host machine.

## 2026-09-06 code audit, typescript, eslint & i18n stability handoff snapshot

- User-visible outcome:
  - Fixed TypeScript compiler errors in `HomeScreen.tsx` (`useMemo` import missing, event parameter typing), eliminating runtime crash risk on app start.
  - Resolved all 5 ESLint errors (`@typescript-eslint/no-unused-vars`) by pruning unused `Vibration` imports in `MemoryGameScreen.tsx`, `RhythmTapScreen.tsx`, `SnakeScreen.tsx`, `TetrisScreen.tsx`, and `WordGuessScreen.tsx`.
  - Added localized Sleep Timer strings (`SLEEP_TIMER_COPY`) across all 6 supported languages (EN, TR, DE, FR, RU, AR) in `appCopy.ts` and updated `PlayerScreen.tsx`, ensuring international students see clean translated text in the sleep timer bottom sheet.
  - Eliminated React unstable nested component anti-patterns (`react/no-unstable-nested-components`):
    - Converted `NowPlayingHero` in `JukeboxScreen.tsx` to a helper function, preventing full subtree destruction on search/voting updates.
    - Passed direct React elements to `ListEmptyComponent` in `JukeboxScreen.tsx` and `PodcastScreen.tsx`.
    - Memoized `renderHistoryItem` with `useCallback` in `RadioScreen.tsx`.
  - Hardened `EventsScreen.tsx` against network faults: wrapped `fetchMarketItems()` with catch fallback so market API downtime does not prevent campus party tickets from loading.
- Exact files changed:
  - `mobile/src/screens/HomeScreen.tsx`: Added `useMemo` import and typed `event: AppEvent`.
  - `mobile/src/screens/games/MemoryGameScreen.tsx`: Pruned unused `Vibration` import.
  - `mobile/src/screens/games/RhythmTapScreen.tsx`: Pruned unused `Vibration` import.
  - `mobile/src/screens/games/SnakeScreen.tsx`: Pruned unused `Vibration` import.
  - `mobile/src/screens/games/TetrisScreen.tsx`: Pruned unused `Vibration` import.
  - `mobile/src/screens/games/WordGuessScreen.tsx`: Pruned unused `Vibration` import.
  - `mobile/src/i18n/appCopy.ts`: Added `SLEEP_TIMER_COPY` for all 6 languages.
  - `mobile/src/screens/PlayerScreen.tsx`: Used localized `copy(...)` for Sleep Timer and updated copy helper signature.
  - `mobile/src/screens/jukebox/JukeboxScreen.tsx`: Converted `NowPlayingHero` to `renderNowPlayingHero` and direct empty component element.
  - `mobile/src/screens/PodcastScreen.tsx`: Converted `ListEmptyComponent` to direct element.
  - `mobile/src/screens/RadioScreen.tsx`: Wrapped `renderHistoryItem` in `useCallback`.
  - `mobile/src/screens/EventsScreen.tsx`: Fault-tolerant `fetchMarketItems()` fallback.
- Deployment / packaging action:
  - Validated with TypeScript compiler (`npx tsc --noEmit`), ESLint (`npm run lint`), Jest (`npm test -- --runInBand`), Android publish audit (`node scripts/android-publish-audit.js`), root contracts, and terminal test suite.
- Tests and counts:
  - TypeScript: 0 errors (`npx tsc --noEmit`).
  - ESLint: 0 errors (`npm run lint`).
  - Mobile Jest: 96/96 suites passed (386/386 tests).
  - Android Publish Audit: 36/36 passed.
  - Terminal: 24/24 tests passed + syntax checks passed.
  - Root contract tests: 16/16 passed (`production-account.test.mjs`, `technology-rtai-story.test.mjs`).
- Known limitations: None.
- Safety rules preserved: Zero occurrences of `RADİOTEDU`. Production DB, ERP, and Audio Library untouched. No email or notifications sent. No native Android compilation on host machine.
## 2026-09-06 production signed release v1.3.7 & phone emulator heavy testing handoff snapshot

- User-visible outcome:
  - Official production-signed release of `RadioTEDU-Mobile-v1.3.7.apk` prepared, aligned (16 KB page-aligned), signed with production keystore (`RadioTEDU-release-v1.jks`), verified against signature schemes v2 & v3, and published to GitHub Release `v1.3.7`.
  - Comprehensive heavy end-to-end testing performed on physical-dimension Pixel 5 Android phone emulator (`RadioTEDU-Phone-Test`, 1080x2340):
    - Terms & Notification consent modal flow verified on clean boot.
    - Home screen: 5-station compact shelf ("Bugün ne dinliyoruz?"), "Upcoming events: Hello Campus Party (Oct 1 · Le Porte Roof)" with price and ticket link, guest membership hero card ("Create a RadioTEDU account" / "RadioTEDU Hesabı Açın"), and quick actions grid.
    - Live Radio Player: Icecast real-time stream metadata, dynamic brand color tint (Jazz purple), Hi-Fi badge, `[ LYRICS ]` pill button opening LRCLIB viewer ("Oh, Lady Be Good"), Favorite heart toggle, and Sleep Timer stopwatch modal.
    - MiniPlayer verified: Floats above tab bar on Home and Radio, suppressed on interactive screens (`NextSongVote`, `Social`, `Study`, `Jukebox`).
    - All 5 Arcade Games verified live:
      * **01 Neon Snake**: Glowing neon board, directional pad, food streak, lives display, active movement.
      * **02 Memory Cards**: 4x4 card grid, card flipping, animated `✦ Miss` badge, score & moves update.
      * **03 Blocks (Tetris)**: Falling pieces, ghost projection, rotate/drop controls, score tracking.
      * **04 Song Guess**: Spinning vinyl record animation, soundwave visualizer, emoji/clue decoder, multiple-choice options.
      * **05 Music IQ**: 256-question pool, timer countdown bar, streak multiplier, round finished modal.
    - Profile screen: Guest Welcome Hero Card with bullet points and "Sign in / Sign up" CTA.
- Exact source and release files changed:
  - `artifacts/release-v1.3.7/RadioTEDU-Mobile-v1.3.7.apk`: Production-signed release package (89,315,892 bytes, SHA-256: `ed71e596281b1b61e27a396453fe53a4bc28678dcb3c9eb81d1d43a2377174b4`).
  - `artifacts/release-v1.3.7/SHA256SUMS.txt`: Updated SHA-256 checksum for `RadioTEDU-Mobile-v1.3.7.apk`.
  - `artifacts/release-v1.3.7/RELEASE-SHA256SUMS.txt`: Updated release checksums.
  - GitHub Release `v1.3.7`: Uploaded assets and updated release notes via `gh release upload v1.3.7 ... --clobber` and `gh release edit v1.3.7`.
- Deployment / packaging action:
  - Bundled JS and assets via `npx react-native bundle --platform android --dev false`.
  - Repacked, aligned via `zipalign -p -f 4`, and signed with production key `radiotedu-release` using `package_production_apk.py`.
  - Verified with `apksigner verify --verbose` (v2 & v3 schemes verified, cert SHA-256: `B3B08DB1C4AEFBF4251D53951061ADA727796479DE45D817F9576232FF2D9439`).
  - Published to GitHub Release `v1.3.7`.
- Tests and counts:
  - TypeScript: 0 errors (`npx tsc --noEmit`).
  - ESLint: 0 errors (`npm run lint`).
  - Mobile Jest: 96/96 suites passed (386/386 tests).
  - Android Publish Audit: 36/36 passed.
  - Root contract tests: 16/16 passed (`production-account.test.mjs`, `technology-rtai-story.test.mjs`).
  - Study-game: 46/46 files, 227/227 tests passed + 3/3 generation contracts.
  - Terminal: 24/24 tests passed + syntax checks passed.
  - Release version check: `node scripts/verify-release-version.mjs v1.3.7` passed.
  - Website read-only checks: `verify-language-routing-readonly.mjs` (6/6), `verify-registration-newsletter-readonly.mjs` (2/2), `verify-stations-page-readonly.mjs` (4/4).
- Known limitations: None.
- Commit hash pushed to `main`: `7d1b9e1982d5f695b19cfbfefd4cc547716fce26`.
- Safety rules preserved: Zero occurrences of `RADİOTEDU`. Production DB, ERP, and Audio Library untouched. No email or notifications sent. No native Android compilation on host machine.

## 2026-09-06 Spotify-style lyrics quote card, focus companion PiP, and personal listening recap handoff snapshot

- User-visible outcome:
  - **Spotify-Style Lyrics Quote Card Generator & Social Share (Feature 2)**:
    - 9:16 high-resolution vertical quote card generator built directly into `LyricsShareModal.tsx` and accessible from `PlayerScreen.tsx` via `[ 📤 Paylaş ]` or by tapping individual lyrics lines.
    - Card features station-specific brand color tint, album artwork thumbnail, track title, artist name, station pill badge (`● Jazz`, `● Classical`, etc.), decorative quotation marks (`“`), selected lyric text, and official RadioTEDU white logo (`logo-03byz.png`) with `radiotedu.com` signature.
    - Multi-line selector allows picking 1 to 4 lines of lyrics with live counter and selection checkmarks.
    - Native share trigger via `Share.share` opens Android/iOS system sheet for Instagram Stories, WhatsApp, Telegram, Twitter/X, and direct messaging.
  - **Focus Companion & Picture-in-Picture (PiP) Mode (Feature 3)**:
    - Integrated with Pomodoro focus timer on `FocusScreen.tsx` (25/5 min cycles) alongside Lo-Fi and Classical stations.
    - Picture-in-Picture permission flow: checks system PiP availability and opens an informative consent dialogue (`"Picture-in-Picture (PiP) İzni"`) prompting users to grant PiP permission via `android.settings.PICTURE_IN_PICTURE_SETTINGS`.
    - Distraction-free high-contrast HUD timer and native Android PiP bridge support (`PipBridgeModule.kt`, `PipBridgePackage.kt`, `android:supportsPictureInPicture="true"` in AndroidManifest).
  - **Personal Listening Stats & Mini Wrapped (Feature 5)**:
    - Spotify Wrapped-style personal listening recap card displayed on the Profile screen (`ProfileScreen.tsx`) for both guests and authenticated users.
    - Aggregates weekly listening duration (hours and minutes), top genre with percentage and brand color, peak listening time habit badges (*Gece Kuşu*, *Sabah Enerjisi*, *Gün Ortası Odak*, *Akşam Seansı*), and colored genre distribution progress bar.
    - **Strict privacy compliance**: zero song titles and zero artist names are recorded or stored. Only anonymous duration per station and hour-of-day buckets are tracked locally in device storage (`@radiotedu/listening_stats`).
    - One-tap social share button ("Özetimi Paylaş") generates formatted weekly recap text for WhatsApp and social networks.
- Exact source files changed:
  - `mobile/src/services/listeningStatsService.ts` [NEW]
  - `mobile/__tests__/listeningStats.test.ts` [NEW]
  - `mobile/src/components/LyricsShareModal.tsx` [NEW]
  - `mobile/__tests__/lyricsShare.test.ts` [NEW]
  - `mobile/src/services/pipService.ts` [NEW]
  - `mobile/__tests__/pipService.test.ts` [NEW]
  - `mobile/android/app/src/main/java/com/radiotedumobile/pip/PipBridgeModule.kt` [NEW]
  - `mobile/android/app/src/main/java/com/radiotedumobile/pip/PipBridgePackage.kt` [NEW]
  - `mobile/android/app/src/main/AndroidManifest.xml` [MODIFIED]
  - `mobile/android/app/src/main/java/com/radiotedumobile/MainApplication.kt` [MODIFIED]
  - `mobile/src/context/MetadataContext.tsx` [MODIFIED]
  - `mobile/src/screens/PlayerScreen.tsx` [MODIFIED]
  - `mobile/src/screens/FocusScreen.tsx` [MODIFIED]
  - `mobile/src/screens/ProfileScreen.tsx` [MODIFIED]
  - `mobile/src/i18n/appCopy.ts` [MODIFIED]
- Deployment & packaging action:
  - Bundled JS and assets via `npx react-native bundle --platform android --dev false`.
  - Repacked, 16 KB page-aligned (`zipalign -p -f 4`), and signed with official production keystore (`RadioTEDU-release-v1.jks`, alias `radiotedu-release`).
  - Production APK SHA-256: `4116fea43a70cc93ba81dfa6777941f614af28e7702c23be022d4a590348198e`.
  - Uploaded updated `RadioTEDU-Mobile-v1.3.7.apk`, `SHA256SUMS.txt`, and `RELEASE-SHA256SUMS.txt` to GitHub Release `v1.3.7`.
- Tests and counts:
  - TypeScript: 0 errors (`npx tsc --noEmit`).
  - ESLint: 0 errors (`npm run lint`).
  - Mobile Jest: 99/99 suites passed (394/394 tests passed).
  - Android Publish Audit: 36/36 passed.
  - Root contract tests: 16/16 passed (`production-account.test.mjs`, `technology-rtai-story.test.mjs`).
- Known limitations: None.
- Commit hash pushed to `main`: `3160859` (feature commit).
- Safety rules preserved: Zero occurrences of `RADİOTEDU`. Production DB, ERP, and Audio Library untouched. No email or notifications sent. No native Android compilation on host machine.

## 2026-09-06 lock screen, notification & offline cover art hardening handoff snapshot

- User-visible outcome:
  - Fixed radio cover art disappearing on Android lock screen, notification drawer, and player UI when connection drops, when stream is offline, or when remote artwork URLs fail.
  - TrackPlayer on Android now uses compiled native offline drawables (`android.resource://com.radiotedumobile/drawable/car_station_*`) via `getStationNativeArtworkUri(channel.id)`.
  - Android `MetadataContext` recovers TrackPlayer notification artwork to the native station drawable if connection drops or network fails during polling.
  - Automatic metadata refresh on network reconnection via `NetInfo.addEventListener`.
  - Added `imageError` state and `onError` fallback to local bundled station logos across `PlayerScreen.tsx`, `MiniPlayer.tsx`, and `RadioScreen.tsx`.
- Exact source and live files changed:
  - `mobile/src/services/playbackQueue.ts`
  - `mobile/src/context/MetadataContext.tsx`
  - `mobile/src/screens/PlayerScreen.tsx`
  - `mobile/src/components/MiniPlayer.tsx`
  - `mobile/src/screens/RadioScreen.tsx`
  - `artifacts/release-v1.3.7/RadioTEDU-Mobile-v1.3.7.apk`
  - `artifacts/release-v1.3.7/SHA256SUMS.txt`
  - `artifacts/release-v1.3.7/RELEASE-SHA256SUMS.txt`
- Deployment & packaging action:
  - Bundled JS and assets via `npx react-native bundle --platform android --dev false`.
  - Repacked, 16 KB page-aligned (`zipalign -p -f 4`), and signed with official production keystore (`RadioTEDU-release-v1.jks`, alias `radiotedu-release`).
  - Production APK SHA-256: `eeccf1c034526fd7edc2d5280e647e3a2086d6792c5038e4dbb3de95dc8b81e5`.
  - Uploaded updated `RadioTEDU-Mobile-v1.3.7.apk`, `SHA256SUMS.txt`, and `RELEASE-SHA256SUMS.txt` to GitHub Release `v1.3.7` via `gh release upload ... --clobber`.
- Tests and counts:
  - TypeScript: 0 errors (`npx tsc --noEmit`).
  - ESLint: 0 errors (`npm run lint -- --quiet`).
  - Mobile Jest: 99/99 suites passed (394/394 tests passed).
  - Android Publish Audit: 36/36 passed.
  - Root contract tests: 16/16 passed (`production-account.test.mjs`, `technology-rtai-story.test.mjs`).
- Known limitations: None.
- Push details: Committed and pushed to `origin/main` using `akgularda` GitHub identity.
- Safety rules preserved: Zero occurrences of `RADİOTEDU`. Production DB, ERP, and Audio Library untouched. No email or notifications sent. No native `./gradlew` compilation on host machine.

## 2026-09-06 multi-language share localization handoff snapshot

- User-visible outcome:
  - Full multi-language localization implemented across all 6 supported languages (`en`, `tr`, `ru`, `ar`, `de`, `fr`) for social sharing:
    - PlayerScreen lyrics share pill button (`lyrics.shareHeader`: Share / Paylaş / Поделиться / مشاركة / Teilen / Partager) and accessibility label (`lyrics.shareTitle`).
    - LyricsShareModal title, line selection prompt (`lyrics.selectLines`), close button (`common.close`), and primary action button (`lyrics.shareStory`: "Instagram & WhatsApp'ta Paylaş" / "Share to Story & WhatsApp" / etc.).
    - Shared text format and listening footnote (`lyrics.listeningOn`: "RadioTEDU dinliyorum: https://radiotedu.com" / "Listening to RadioTEDU: https://radiotedu.com" / etc.).
    - ProfileScreen listening recap share button (`stats.share`: "Özetimi Paylaş" / "Share My Recap" / etc.), dialog title (`stats.recapTitle`), duration formatter (`stats.hoursAndMinutes`, `stats.minutesOnly`), and full localized share message template (`stats.shareMessage`).
  - Strict 6-language parity verified via `localeAuditFixes.test.ts` (0 missing keys across all 6 languages).
- Exact source files changed:
  - `mobile/src/i18n/appCopy.ts`: Added localized keys for all 6 languages (`lyrics.shareHeader`, `lyrics.listeningOn`, `stats.recapTitle`, `stats.hoursAndMinutes`, `stats.minutesOnly`, `stats.shareMessage`).
  - `mobile/src/components/LyricsShareModal.tsx`: Connected `useTranslation` and dynamic `copy(...)` for headers, counters, buttons, and share text.
  - `mobile/src/screens/PlayerScreen.tsx`: Localized lyrics share header button and accessibility label.
  - `mobile/src/screens/ProfileScreen.tsx`: Localized recap share text and message formatter.
  - `mobile/__tests__/lyricsShare.test.ts`: Added tests verifying localization across all 6 languages.
  - `GEMINI.md`: Appended dated handoff notes.
- Tests and counts:
  - TypeScript: 0 errors (`npx tsc --noEmit`).
  - ESLint: 0 errors (`npm run lint`).
  - Mobile Jest: 99/99 suites passed (396/396 tests).
  - Android publish audit: 36/36 passed.
- Known limitations: None.
- Push details: Committed and pushed to `origin/main` using `akgularda` GitHub identity.
- Safety rules preserved: Zero occurrences of `RADİOTEDU`. Production DB, ERP, and Audio Library untouched. No email or notifications sent. No native Android compilation on host machine.

## 2026-09-07 remove top-right header username handoff snapshot

- User-visible outcome:
  - Removed the username display from the top-right application header (`GlobalHeader.tsx`) when logged in per user directive (*"Sağ üstte giriş yapılınca isim yazma özelliğini kaldır"*).
  - The top right area now consistently displays only the minimalist profile circle icon button (`account-circle`), maintaining symmetrical balance with the left side spacer and keeping the center RadioTEDU logo perfectly centered.
- Exact source files changed:
  - `mobile/src/components/GlobalHeader.tsx`: Removed `useAuth()`, `accountLabel`, and the `<Text style={styles.accountLabel}>` element.
  - `GEMINI.md`: Appended dated handoff notes.
- Tests and counts:
  - TypeScript: 0 errors (`npx tsc --noEmit`).
  - ESLint: 0 errors (`npm run lint`).
  - Mobile Jest: 99/99 suites passed (396/396 tests).
  - Android publish audit: 36/36 passed.
- Known limitations: None.
- Push details: Committed and pushed to `origin/main` using `akgularda` GitHub identity.
- Safety rules preserved: Zero occurrences of `RADİOTEDU`. Production DB, ERP, and Audio Library untouched. No email or notifications sent. No native Android compilation on host machine.

## 2026-09-07 release v1.3.8 & emulator verification handoff snapshot

- User-visible outcome:
  - Bumped version to `v1.3.8` (versionCode `13080`, TV `13081`, Wear `13082`, iOS marketing `1.3.8` build `13080`, terminal `1.3.8`).
  - Generated production bundle via `npx react-native bundle --platform android --dev false`.
  - Packaged, 16KB page-aligned (`zipalign -f -P 16 4`), and signed `RadioTEDU-Mobile-v1.3.8.apk` with official production keystore (`RadioTEDU-release-v1.jks`, alias `radiotedu-release`).
  - Packaged `RadioTEDU-Terminal-v1.3.8.tgz` and `RadioTEDU-Terminal-v1.3.8.zip`.
  - Full end-to-end testing verified on physical-dimension Pixel 5 phone emulator (`RadioTEDU-Phone-Test`, 1080x2340):
    - Clean launch with dual RadioTEDU and RTAI marks.
    - Home screen with clean header (username removed, profile circle only), station carousel ("Choose your station"), "Listen live" CTA.
    - Audio playback: Icecast stream connected live with song title & artist ("Temperature (The Trinity) - Sean Paul"), official square station cover art, live MiniPlayer, expanded Player modal with `LYRICS` pill button, sleep timer stopwatch icon, and favorite heart toggle.
    - Android Auto: `RadioTeduCarService` foreground service started cleanly; `cmd media_session list-sessions` confirmed active `androidx.media3.session.id.RadioTeduMediaLibrary` and `KotlinAudioPlayer`.
- Exact source and release files changed:
  - `mobile/package.json` & `mobile/package-lock.json`: Bumped to `1.3.8`.
  - `terminal/package.json` & `terminal/README.md`: Bumped to `1.3.8`.
  - `mobile/android/app/build.gradle`: `versionCode 13080`, `versionName "1.3.8"`.
  - `mobile/android/tv/build.gradle`: `versionCode 13081`, `versionName "1.3.8"`.
  - `mobile/android/wear/build.gradle`: `versionCode 13082`, `versionName "1.3.8"`.
  - `mobile/ios/RadioTEDUMobile.xcodeproj/project.pbxproj`: `MARKETING_VERSION = 1.3.8;`, `CURRENT_PROJECT_VERSION = 13080;`.
  - `mobile/__tests__/iosReadinessSource.test.ts` & `mobile/__tests__/androidFormFactorsSource.test.ts`: Updated version expectations.
  - `tests/release-workflows.test.mjs`: Updated release version contract to `v1.3.8`.
  - `mobile/src/services/lyricsService.ts`: User-Agent updated to `RadioTEDU/1.3.8`.
  - `backend/src/routes/gamification.ts`: User-Agent updated to `RadioTEDU-Sync/1.3.8`.
  - `README.md`: Updated release references.
  - `artifacts/release-v1.3.8/`: Production APK, terminal packages, and SHA-256 checksums.
  - `GEMINI.md`: Appended dated handoff notes.
- Tests and counts:
  - TypeScript: 0 errors (`npx tsc --noEmit`).
  - ESLint: 0 errors (`npm run lint`).
  - Mobile Jest: 99/99 suites passed (396/396 tests).
  - Android publish audit: 36/36 passed.
  - Root contract tests: 16/16 passed (`release-workflows.test.mjs`, `technology-rtai-story.test.mjs`, `production-account.test.mjs`).
  - Study/Social: 46/46 files, 227/227 tests passed + 3/3 generation contracts.
  - Terminal: 24/24 tests passed + syntax checks passed.
  - Release version check: `node scripts/verify-release-version.mjs v1.3.8` passed.
- Known limitations: None.
- Safety rules preserved: Zero occurrences of `RADİOTEDU`. Production DB, ERP, and Audio Library untouched. No email or notifications sent. No native Android compilation on host machine.

2026-09-08 approved v1.3.9 work: measured tab-bar layout and explicit navigation readiness; bounded foreground setup retry; native PNG share/save bridges for lyrics, recap and now playing; online-only game entry, Flash Memory mode using existing Memory scoring/rewards, effects/haptics, local result history; offline result retry preserves proof and frozen payload; terminal wide details and refined spacing. Existing 1.3.8 CI failed on Media3 Builder.setSmallIcon; moved call to built provider. Full source backup release139-20260908-065823. TypeScript/lint, 18 targeted regressions, 25 terminal tests and Android audit 36/36 pass. Final Actions build and device stress tests remain pending; do not claim release-ready. No backend or production Gold changes.

2026-09-11 delivery candidate: source 700fdf4cc4e437621d15ee8e9b924c6bf2a7ba3f, production-signed 1.3.9/13090, APK SHA256 21d49e4f860b18df0f81b58aa4bee56837486adb94837f9ab26ef07888effb35. Android Release 34579190307 and CI 34579189727 (including iOS) passed. 404 tests; native ELF/APK packaging alignment and permanent certificate verified. Actual final PNGs: recap Story retains 16 minutes, podcast Square wraps full publisher. Fixed timezone rollover and podcast share metadata found during visual QA. Final terminal package matches 10 source files and lists 9 stations. Read docs/RELEASE_1_3_9_VERIFICATION.md for recording provenance and open gates. Main radio still returns upstream 502; full Auto projection, isolated authenticated device Gold and final lyrics remain unverified. Keep GitHub release draft; no Play publication. Recording 63 transfer stalled and is excluded; saved PNG verified. No emulator data wiped.

2026-09-11 12:12 UTC recheck: all 12 stream variants decode 12 seconds of non-silent PCM, including Energize and FLAC. Recovered recording 63 by resuming Windows-suspended phone emulator; phone then exited, cause unknown. Existing Auto AVD fails SDK disk guard at 1.5 GB free; no bypass/wipe. Final device live lyrics/art, Auto projection and isolated authenticated Gold remain unverified. See docs/RELEASE_1_3_9_RECHECK_2026_09_11.md; release stays draft.

2026-09-11 cloud QA: exact signed 700fdf4 APK passed guest startup/tab navigation, three consent-preserving restarts and crash-buffer checks on Android 35 Pixel C (34599043572 tablet job) and Pixel 7 (34599540795). Native screenshots show real song artwork and mini-player above tabs. Earlier harness offscreen-control failure and Pixel Launcher ANRs retained. Phone landscape hero consumes most of viewport; compact layout now being tested, requires new signed binary. No Auto/authenticated Gold/audio claim. See docs/RELEASE_1_3_9_CLOUD_DEVICE_QA.md.
