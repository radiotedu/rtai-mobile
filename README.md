<p align="center">
  <img src="docs/images/rtai.png" width="360" alt="RTAI logo">
</p>

<p align="center">
  <img src="mobile/logos/logo-radiotedu-splash.png" width="150" alt="RadioTEDU logo">
</p>

<h1 align="center">RTAI Mobile</h1>

<p align="center">
  The RadioTEDU companion app for live listening, Android Auto, Study, voting,
  and Jukebox controller experiences.
</p>

RTAI Mobile is a standalone React Native application with a separately built
Study web game. The app keeps its interactive experiences deliberately
separated: Study opens `radiotedu.com/study`, voting opens
`radiotedu.com/vote`, and the QR/controller Jukebox opens
`radiotedu.com/juke-local/controller`.

## What is included

### Version 1.3.9 candidate

[Latest signed candidate build and artifacts](https://github.com/radiotedu/rtai-mobile/actions/runs/34600299328) · [Verification and remaining release gates](docs/RELEASE_1_3_9_27DDB0C_VERIFICATION.md)

Redesigned PNG sharing, measured mini-player positioning, Flash Memory using the existing online Gold rules, and a refreshed terminal. Production-signed APK includes Android Auto integration; full projection and Google Play readiness remain unverified. All 12 stream variants passed real audio decoding in the [September 11 service recheck](docs/RELEASE_1_3_9_RECHECK_2026_09_11.md).

[Cloud phone/tablet evidence](docs/RELEASE_1_3_9_CLOUD_DEVICE_QA.md) prompted a compact phone-landscape homepage adjustment. The newer signed `27ddb0c` APK passed recorded phone radio/background/offline checks and native Automotive cold-start playback. Wi-Fi lyrics and album art displayed during the phone run. Authenticated Gold, full car catalog coverage and Android Auto projection remain open.

<p>
  <img src="docs/images/release-1.3.9/phone-landscape-27ddb0c.png" width="620" alt="Verified compact landscape homepage in the signed 27ddb0c APK">
  <img src="docs/images/release-1.3.9/automotive-playing-27ddb0c.png" width="620" alt="Actual Android Automotive host playback; this is not Android Auto projection">
</p>

These are actual PNG exports from the signed `700fdf4` APK. The recap displays its real 16-minute total, restored after fixing a timezone-related week reset. Podcast sharing preserves the full episode title and publisher.

<p>
  <img src="docs/images/release-1.3.9/recap-story-700fdf4.png" width="230" alt="Actual Story recap PNG exported by RadioTEDU 1.3.9">
  <img src="docs/images/release-1.3.9/podcast-square-700fdf4.png" width="300" alt="Actual Square podcast PNG exported by RadioTEDU 1.3.9">
</p>

![RadioTEDU 1.3.9 terminal, actual captured session](docs/images/release-1.3.9/terminal.png)

Actual now-playing PNGs exported by the final `27ddb0c` APK:

<p>
  <img src="docs/images/release-1.3.9/now-playing-story-27ddb0c.png" width="230" alt="Native Story PNG with actual song artwork and metadata">
  <img src="docs/images/release-1.3.9/now-playing-square-27ddb0c.png" width="300" alt="Native Square PNG with undistorted artwork">
</p>

[Latest share/car recheck](docs/RELEASE_1_3_9_SHARE_EXPORT_RECHECK.md): both PNG formats passed. The earlier missing-car-stations report was a test-name mismatch; native station titles include the RadioTEDU prefix. Complete catalog/playback verification continues with the corrected driver.

### Version 1.3.8 release

[APK and terminal downloads](https://github.com/radiotedu/rtai-mobile/releases/tag/v1.3.8)

Production-signed Android with Android Auto integration included; full Auto projection and Google Play readiness remain unverified. The report records the startup retry failure and other outstanding checks.

<p>
  <img src="docs/images/release-1.3.7/phone-home.png" width="260" alt="RadioTEDU Home in the signed 1.3.7 APK">
  <img src="docs/images/release-1.3.7/phone-podcasts.png" width="260" alt="Podcast catalog and radio cover artwork in the signed 1.3.7 APK">
</p>

![RadioTEDU terminal player](docs/images/release-1.3.7/terminal.png)

[Preview images and editable HTML](docs/images/release-1.3.7/README.md) use real app captures and Manrope, with the font license included.

| Component | Responsibility |
| --- | --- |
| `mobile/` | React Native application, native Android/iOS projects, and Android Auto integration |
| `study-game/` | Vite and Phaser Study experience, avatar tooling, tests, and production build |
| `terminal/` | Keyboard/mouse terminal player and Study timer for Linux, macOS, and Windows |
| `backend/` | Deployed backend source handoff, isolated tests and recovery contracts; deploy separately from the app |
| `scripts/` | Repository-level source and boundary verification |
| `tests/` | Contracts that keep this repository standalone and reproducible |
| `docs/` | API configuration, signing, release, and source-provenance guides |

Server-side handoff instructions and guarded service/account prompts are in
[`docs/SERVER_HANDOFF.md`](docs/SERVER_HANDOFF.md).

The account, shared Gold, Voting, Social, ERP boundary, web player, and
Juke-Local/Services PC relationships are summarized in the standalone
[`RadioTEDU ecosystem guide`](docs/RadioTEDU-Ecosystem-Guide.html).

The mobile app preserves the documented startup-branding contract in
[`mobile/README.md`](mobile/README.md): every cold launch shows the original
RadioTEDU and RTAI marks, and the black/red RTAI artwork is displayed on a
contrast card without recoloring.

## Experience map

```text
RTAI Mobile
├── Radio and station discovery
├── Android Auto playback controls
├── Study ─────────────── radiotedu.com/study
├── Voting ────────────── radiotedu.com/vote
└── Jukebox controller ── radiotedu.com/juke-local/controller
```

Study is developed and tested in `study-game/`, deployed to
`radiotedu.com/study`, and loaded remotely by the app. Study, voting, and
Jukebox controller website deployments therefore do not require an app release.

The phone package contains Android Auto. The iOS package contains the CarPlay
scene. Android TV and Wear OS use small native modules with the same
`com.radiotedumobile` Play listing/package and separate device-targeted bundles,
as required by Google Play.

## Requirements

- Node.js 20 with npm
- Java 17; CI uses Temurin
- Android SDK and Android Build Tools for local Android builds
- Xcode and CocoaPods for iOS development

The package manifests accept broader Node versions in places, but Node 20 is the
repository and CI baseline.

## Quick start

Clone the canonical repository:

```powershell
git clone https://github.com/radiotedu/rtai-mobile.git
Set-Location rtai-mobile
```

### Study

```powershell
Set-Location study-game
npm ci
npm test
npm run build
```

For browser development:

```powershell
npm run dev
```

Return to the repository root before continuing:

```powershell
Set-Location ..
```

### Mobile application

```powershell
Set-Location mobile
npm ci
npm test -- --runInBand
npx tsc --noEmit
npx eslint . --quiet
npm run audit:android
```

Start Metro and launch the desired target from separate terminals:

```powershell
npm start
npm run android
```

Use `npm run android:auto` for the Android Auto build variant. For iOS setup and
native dependency notes, follow [`mobile/README.md`](mobile/README.md).

### Terminal application

The terminal client deliberately excludes JukeLocal. It supports interactive
keyboard/mouse playback, Icecast metadata, account login, and Study elapsed
minutes:

```powershell
Set-Location terminal
npm run check
npm test
npm start
```

Install `mpv` (recommended) or `ffplay` separately. See
[`terminal/README.md`](terminal/README.md) for controls, account flow, and
cross-platform configuration.

## Verification

Run focused startup-branding tests from `mobile/`:

```powershell
npm test -- --runInBand __tests__/dualLogoSplashSource.test.ts __tests__/androidThemeSource.test.ts __tests__/App.test.tsx
```

Run repository-boundary checks from the repository root:

```powershell
node --test tests/repository-contract.test.mjs
node scripts/verify-repository.mjs
```

Build a local Android debug APK from `mobile/`:

```powershell
android/gradlew.bat assembleDebug
```

The checked-in Android debug keystore is development-only. It is not production
signing material. Production releases require the encrypted GitHub Actions
secrets documented in
[`docs/GITHUB_SECRETS.md`](docs/GITHUB_SECRETS.md); no production signing secret
is stored in this repository.

## Configuration and operations

- [API and WebView configuration](docs/API_CONFIGURATION.md)
- [Infrastructure hosts, mounts, and secret status](docs/INFRASTRUCTURE_CONFIGURATION.md)
- [GitHub signing secrets](docs/GITHUB_SECRETS.md)
- [Android release procedure](docs/RELEASE.md)
- [Source provenance and export scope](docs/SOURCE_PROVENANCE.md)
- [Detailed mobile architecture and development guide](mobile/README.md)

## Security boundaries

- Never commit Android production-signing credentials.
- Treat `.env` files, API credentials, and service tokens as local secrets.
- Keep remote WebView origins restricted to the documented RadioTEDU endpoints.
- Use the repository audit and contract checks before preparing a release.

## Technical architecture

RTAI Mobile is split into two independently buildable clients. `mobile/` is the
React Native application and owns navigation, device integration, localization,
and the radio/Jukebox/VoterTAI experiences. `study-game/` is a TypeScript web
application that can be developed and deployed without rebuilding the native
shell. Neither client is an authoritative playout system: commands and shared
state are validated by the corresponding RadioTEDU backend.

```mermaid
flowchart LR
    Listener["Listener"] --> Native["React Native app\nmobile/"]
    Listener --> Study["Study web app\nstudy-game/"]
    Native --> Adapters["Platform adapters\nAndroid · Auto · TV · Wear · iOS"]
    Native --> Client["Typed client services\nauth · radio · voting · jukebox"]
    Study --> StudyClient["Study state and content services"]
    Client -->|"HTTPS / WebSocket"| APIs["RadioTEDU public APIs"]
    StudyClient -->|"HTTPS"| APIs
    APIs --> Radio["OnAir metadata and streams"]
    APIs --> Vote["VoterTAI authority"]
    APIs --> Jukebox["Jukebox authority"]
```

| Area | Responsibility | Important paths |
| --- | --- | --- |
| Native shell | Navigation, lifecycle, permissions, form-factor behavior | `mobile/App.tsx`, `mobile/src/`, `mobile/android/`, `mobile/ios/` |
| Study experience | Browser-based study game, content, and presentation | `study-game/src/`, `study-game/public/` |
| Contracts | Keeps client requests aligned with server-owned state | `mobile/src/`, `tests/` |
| Release checks | Linting, native audits, unit and end-to-end verification | `.github/`, `scripts/`, `tests/` |

The security boundary is deliberate: credentials belong in local environment
configuration, while playback, votes, and queue mutations remain server-owned.
