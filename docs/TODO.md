# RadioTEDU delivery TODO

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

## Release checks

- Run mobile tests, typecheck, lint, Android audit, and screenshot evidence checks before tagging.
- Publish only after the asset manifest and language-completeness checks pass.

References: [Google Play preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151) and the reviewed [store-screenshots workflow](https://github.com/LeeHueeng/store-screenshots).
