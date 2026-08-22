# RadioTEDU delivery TODO

Current pass: locale detection/override, French replacement, visible player/stream-quality/Jukebox/Social/Study copy, localized game catalog/playable-game labels, Lo-Fi station-only presentation, and the real-capture gate are implemented. A Windows-connected Android target is now the required capture device.

## Mobile localization — next mobile release

- Replace current Dutch locale with French; supported locales must be exactly Turkish, English, Arabic, Russian, German, and French.
- Resolve language from the phone locale on first launch. Persist an explicit choice from Settings as an override.
- Translate every visible menu, tab, header, button, alert, validation message, placeholder, accessibility label, error, and empty state. Do not leave Turkish strings in non-Turkish locales or English strings in the Turkish locale.
- Keep product names `RadioTEDU`, `Jukebox`, `Voting`, `Study`, and `Gold` unchanged where they are brands; translate surrounding copy (for example, `Oyunlar`).
- Add locale-completeness tests that compare translation keys and scan screens for user-facing hard-coded strings.
- Verify Arabic RTL after language changes and verify restart behavior on Android and iOS.

## Google Play store assets — next mobile release

- Run the signed release build on real/emulated devices and capture actual app screens. No fabricated UI, fake metadata, or unimplemented feature claims.
- Produce a reviewed 1080×1920 portrait phone set for Radio, normal/low/FLAC quality, Voting, Jukebox, Study, account/settings, and Android media controls. Use only states that are reproducible in the build.
- Add separate real captures for Wear OS, Android TV/Google TV, and Android Auto where those listings require them.
- Apply RadioTEDU visual system: black background, red signal mark, gold FLAC treatment, real station artwork, and readable localized captions.
- Export RGB PNG/JPEG assets within Play Console size/file limits; keep source captures and an evidence manifest mapping every marketing claim to a screen/build.
- Review all screenshots for privacy: no real email addresses, tokens, private account data, or unapproved analytics identifiers.
- Prepare localized store text and screenshot sets for the six supported languages.

Capture command (real device/emulator only; refuses non-1080×1920 output):

`node scripts/capture-android-store-screenshot.mjs mobile/android/app/build/outputs/apk/release/app-release.apk com.radiotedumobile/.MainActivity artifacts/store-screenshots/radio-en.png radio`

### End-to-end Android feature capture checklist

- [ ] Install current release APK on Windows-connected Android target and verify package/version.
- [ ] Create/use a disposable test account; capture account/profile/settings and consent screens without personal data.
- [ ] Capture Home, all visible radio stations, normal/low playback, FLAC on Classic and Jazz, metadata, artwork, and cellular-data warning.
- [ ] Capture Now Playing, quality menu, Android media notification/lock-screen controls, and back-swipe behavior.
- [ ] Capture Study landing/content and visible study-minute progress.
- [ ] Capture Voting, Jukebox, and Juke-local flows using reproducible states.
- [ ] Capture Games hub and each playable game state; the English Games catalog was verified on the Windows emulator, but account-gated playable states still need a disposable authenticated account.
- [ ] Verify every capture is real, readable, 1080×1920 portrait, localized, and free of private account identifiers.
- [ ] Generate evidence manifest mapping each screenshot to APK version, route, state, and feature claim.

## Release checks

- Run mobile tests, typecheck, lint, Android audit, and screenshot evidence checks before tagging.
- Publish only after the asset manifest and language-completeness checks pass.

References: [Google Play preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151) and the reviewed [store-screenshots workflow](https://github.com/LeeHueeng/store-screenshots).
