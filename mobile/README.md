# RadioTEDU Mobile

The official **RadioTEDU** mobile app — for everyone to listen to RadioTEDU easily.

A React Native app (Android + iOS) for live radio, podcasts, the cafeteria **Jukebox** controller, games, and the listener leaderboard. Built for in-car listening with **Android Auto** (and CarPlay planned).

> Extracted from the `rtjukebox` monorepo into a standalone repository. The backend, kiosk display, and web controller live in their own repositories.

## Features

- **Live Radio** — multiple RadioTEDU channels with background playback and lock-screen controls.
- **Podcasts** — browse and listen to school podcasts.
- **Jukebox controller** — scan a cafeteria QR code to join a session and vote on the queue.
- **Android Auto** — included in the phone APK; browse and control playback from the car.
- **CarPlay** — included in the iOS target; requires Apple's approved Audio App entitlement at signing.
- **Android TV / Google TV** — remote-friendly native radio surface under the same Play listing.
- **Wear OS** — standalone native radio surface under the same Play listing.
- **Games & Leaderboard** — gamified listening.

## Tech stack

- React Native `0.76.9`, React `18.3.1`, TypeScript
- `react-native-track-player` v4 (audio + Android Auto / CarPlay)
- `@react-navigation` (bottom tabs + native stack)
- `zustand` (player state), `axios` (API), `socket.io-client` (live jukebox)

## Getting started

```bash
npm install
# iOS only:
cd ios && pod install && cd ..
```

### Run

```bash
npm start          # Metro bundler
npm run android    # build & run on Android device/emulator
npm run ios        # build & run on iOS simulator (macOS only)
```

The iOS target includes background audio, the `radiotedu://` deep-link scheme,
App Store icon assets, and HTTPS-only transport policy. Signing still requires
an Apple Developer team and a unique App Store bundle identifier.

### Quality checks

```bash
npm run lint            # ESLint
npx tsc --noEmit        # TypeScript typecheck
npm test                # Jest
```

## Startup branding

Every cold launch presents the RadioTEDU mark above the RTAI mark on the shared
`#070707` startup surface. The RTAI mark sits on a warm-white `#F7F3EA` contrast
card so its unmodified artwork remains legible against the dark background; the
card supplies the contrast instead of altering either original asset.

The original PNGs are preserved byte-for-byte in both their tracked source and
runtime locations:

- RadioTEDU: `logos/logo-radiotedu-splash.png` and
  `src/assets/images/logo-radiotedu-splash.png` — SHA-256
  `7B621E98364564A8DF162F0D49BED25EC66918A23629F74A96E1E991B599DF26`.
- RTAI: `logos/logo-rtai-splash.png` and
  `src/assets/images/logo-rtai-splash.png` — SHA-256
  `194C1771AD3905E8DC3D4601D0F6701341BDE7BE9D9A43BCB8C44DA4D246E03F`.

Both original assets are tracked and will be included in the private
`radiotedu/rtai-mobile` repository.

`src/screens/SplashScreen.tsx` owns the responsive logo stack and animation,
while `App.tsx` starts it on every cold launch. The splash remains visible for at
least 1.5 seconds and waits for its first layout plus i18n and consent-store
readiness before fading. A 5-second safety timeout releases the app even if a
readiness signal stalls.

The native launch surfaces hand off without a light flash: Android declares
`startup_background` in `android/app/src/main/res/values/colors.xml` and applies
it through `android/app/src/main/res/values/styles.xml`, while retaining disabled
preview, non-translucent, and non-floating window hardening. iOS uses the same
calibrated dark sRGB color in
`ios/RadioTEDUMobile/LaunchScreen.storyboard`, with no template copy or startup
logic.

Run the focused startup-branding contracts from this `mobile` directory:

```powershell
npm test -- --runInBand __tests__/dualLogoSplashSource.test.ts __tests__/androidThemeSource.test.ts __tests__/App.test.tsx
```

## Streaming quality

The shared radio player supports `Automatic`, `Low`, `Normal`, `High`, and
`FLAC`. `Normal` is the default/recommended setting; Automatic adapts between
Low, Normal, and High and never selects FLAC. The selected quality is persisted,
shown in the full player, and applied to in-app, Focus, notification, and car
playback paths. FLAC requires listener confirmation on cellular data.

The quality-aware mounts cover `radio`, `classic`, `lofi`, `cazz`, `energize`,
`rock`, `en`, and `fr`. Each uses `-{low|normal|high|flac}`, with the unchanged
unsuffixed mount retained as the final compatibility fallback. Spark keeps its
existing mount contract because no replacement Spark mount set was supplied.

## Project structure

```text
src/
  components/     Shared UI (MiniPlayer, GlobalHeader, AuthGuard, …)
  context/        Auth, Channel, Metadata providers
  data/           radioChannels.ts (channel catalog + artwork)
  navigation/     RootNavigator (tabs + stacks)
  screens/        Radio, Podcasts, Jukebox, Games, Profile, …
  services/       api, playbackService, playbackQueue, podcastService, …
  store/          zustand stores
  theme/          colors & styling
android/          native Android project (incl. Android Auto config)
  tv/             Android TV targeted application module
  wear/           Wear OS targeted application module
  formfactor/     Shared TV/Wear stream and playback service
ios/              native iOS project
```

## Android Auto

Channels (and podcasts) are exposed to the car via `react-native-track-player`'s media session.
See [`docs/ANDROID_AUTO.md`](docs/ANDROID_AUTO.md) for architecture, the required square artwork
assets, and the Desktop Head Unit (DHU) test checklist.

## License

See the upstream RadioTEDU project. Deployments must include a visible "RadioTEDU" reference.
