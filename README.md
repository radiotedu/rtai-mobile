# RadioTEDU Mobile

Private standalone source repository for the RadioTEDU React Native mobile app and its Study web game. The app keeps Study, voting, and Jukebox controller flows separate: Study opens `radiotedu.com/study`, voting opens `radiotedu.com/vote`, and the QR/controller Jukebox opens `radiotedu.com/juke-local/controller`.

The imported mobile application retains its documented `## Startup branding` contract in `mobile/README.md`. Every cold launch shows the original RadioTEDU and RTAI assets; the RTAI artwork is placed on a contrast card without recoloring the supplied black/red logo.

## Prerequisites

- Node.js 20
- npm (from Node.js 20)
- Java 17 (Temurin is used in CI)
- Android SDK and Build Tools for local Android builds

## Install and verify Study

```powershell
Set-Location study-game
npm ci
npm test
npm run build
```

## Install and verify the mobile app

```powershell
Set-Location mobile
npm ci
npm test -- --runInBand
npx tsc --noEmit
npx eslint . --quiet
npm run package:study
npm run audit:android
```

Focused startup-branding verification:

```powershell
npm test -- --runInBand __tests__/dualLogoSplashSource.test.ts __tests__/androidThemeSource.test.ts __tests__/App.test.tsx
```

Build an Android debug APK from `mobile`:

```powershell
android/gradlew.bat assembleDebug
```

The checked-in Android debug keystore is development-only. It must never be treated as production signing material. Production-signed releases require the encrypted GitHub Actions secrets documented in [docs/GITHUB_SECRETS.md](docs/GITHUB_SECRETS.md); no production signing secret is stored in this repository.

## Operational documentation

- [API and WebView configuration](docs/API_CONFIGURATION.md)
- [GitHub signing secrets](docs/GITHUB_SECRETS.md)
- [Android release procedure](docs/RELEASE.md)
- [Source provenance and export scope](docs/SOURCE_PROVENANCE.md)

Repository boundary checks:

```powershell
node --test tests/repository-contract.test.mjs
node scripts/verify-repository.mjs
```
