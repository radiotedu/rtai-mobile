# RadioTEDU 1.3.9 landscape candidate — verified September 11, 2026

Status: **candidate; not release-ready**. This supplements earlier reports without replacing their evidence. No Google Play submission or public 1.3.9 release was made.

## Actual binary

- Source: `27ddb0cf440d590d7cf2c786e13ba42895b2f0c2` (clean embedded provenance).
- Package: `com.radiotedumobile`; version `1.3.9`; phone versionCode `13090`.
- APK SHA-256: `c46f4d298d7e1c139441010b65fb0199a867286924b73c4713916a917ae23874`.
- Permanent signing certificate SHA-256: `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`.
- APK ELF and ZIP packaging 16 KB alignment passed; AAB native compatibility passed. Inspection covers the actual packaged React Native, Hermes and FLAC libraries.
- [Signed build 34600299328](https://github.com/radiotedu/rtai-mobile/actions/runs/34600299328) and [CI 34600298989](https://github.com/radiotedu/rtai-mobile/actions/runs/34600298989) passed, including iOS simulator compilation. Compilation does not establish iOS runtime or App Store readiness.

## Changes and checks

The only app changes since the previously tested sharing candidate are a compact header and side-by-side homepage hero for short landscape windows. The portrait and tablet layouts retain their prior design. All 404 mobile tests, TypeScript, targeted lint, release-version validation and Android audit (36/36) passed before the signed build.

[Phone run 34601661867](https://github.com/radiotedu/rtai-mobile/actions/runs/34601661867) installed the exact verified APK and passed guest navigation, three process restarts with consent retained, font-scale and rotation captures, and the app crash-buffer check. The emulator's Pixel Launcher ANR was captured and its hung system launcher closed; no RadioTEDU crash was dismissed.

Visual inspection confirms the landscape hero and its Listen live button now fit together above the station section. The final phone APK displays real album artwork and Wi-Fi lyrics. Lyrics availability was verified for the song playing during the run, not every song or provider result. Lyric PNG export and recipient-app receipt remain unverified.

The phone's own media session reached PLAYING with an active AudioFlinger client track, remained active in the background, accepted media-key pause/resume, and returned to rendered playback after disabling and restoring Wi-Fi/mobile data. The offline screenshot shows the retry state. These are rendered-audio and media-key checks, not physical-speaker listening or notification-button touch coverage. Earlier candidate recordings cover notification-button interactions.

[Automotive run 34601664826](https://github.com/radiotedu/rtai-mobile/actions/runs/34601664826) passed against the same APK: the native car host browsed Live Radio and started RadioTEDU with a PLAYING session and active rendered audio. Screenshots show album artwork, title/artist and transport controls. This exercises the cold-start main-station fallback; the full catalog after phone initialization was not tested. **Android Automotive is not Android Auto projection.**

The first Automotive attempt launched the default local-media application because the test used an incorrect intent extra. It also captured a display warning before PNG bytes. The driver now uses the documented media-service component extra and an explicit physical display ID. Failed evidence is retained; no app change was needed for that harness failure.

The packaged terminal reports 1.3.9, lists all nine stations including Lo-Fi, and all ten JavaScript files match the previously tested terminal source. Its source was unchanged by the landscape adjustment.

## Remaining release gates

- Full Android Auto projection and full initialized car catalog/playback coverage.
- Final authenticated registration/login/refresh/logout, account retention on production upgrade, Memory/Flash completion, Gold earning/spending/duplicate recovery through an isolated HTTP backend. No production balances were changed.
- Lyric PNG export and WhatsApp/Instagram receipt; complete events/games/account/offline stress coverage.
- Broader tablet, large-font, non-English and iOS runtime coverage. Earlier signed-candidate tablet evidence remains scoped to its recorded flows.
- Store listing, promotional asset/declaration review and Play Console checks. No Play publication authorized or performed.

Local Android Auto remains blocked by insufficient C: free space; the SDK guard was not bypassed. Earlier files, backups, candidates and user data were preserved. New candidate assets carry the `27ddb0c` suffix so earlier draft artifacts remain distinguishable.
