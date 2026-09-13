# September 13 candidate verification

Draft, not release-ready. App source: `3d8770486040f08c9257bb2b33250e4db5060403`.

## Binary

- Package `com.radiotedumobile`, version `1.3.9`, phone code `13090`, clean embedded source verified from the APK.
- Established certificate SHA-256: `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`.
- APK SHA-256: `f0eeece213e6cfbf1fb4f7fafacb5df3e293aa2c34c11979549e271601d1d5e3`.
- AAB SHA-256: `2aeee977320bc28f34d887a43f1a6ceb18148b21dd8902f3bd01f5bd06972359`.
- Actual APK signature, version/source, 16 KB native ELF and ZIP packaging checks passed. AAB ELF verification passed separately.
- [Signed build](https://github.com/radiotedu/rtai-mobile/actions/runs/34744863377) and [CI](https://github.com/radiotedu/rtai-mobile/actions/runs/34744863604) passed. Local checks: 405 tests/103 suites, TypeScript, quiet lint, release-version validation and Android audit. iOS simulator compilation is not runtime/store certification.

## Lyric composer regression

The previous APK allowed incoming radio metadata to replace an open lyric card. This candidate snapshots the song for the lifetime of the composer; closing/reopening captures fresh data.

Installed over the existing app without uninstall. On the local Wi-Fi emulator, opened the lyric composer during Powerless, saved a Story PNG, kept the composer open until the actual media session changed to TEDU_1, then saved again. Both 1080×1920 PNGs fully decode and have identical SHA-256 `1d6c048dff5bf9c609981498010b319416546d63b5577f9aa65f258fbfe098ed`. Closing and reopening during Die With a Smile produced a new PNG with matching song title, artist and artwork. Its layout was visually inspected. This confirms retention across a genuine metadata transition and fresh data on reopening.

Local evidence: `output/lyrics-session-3d87704/`; approximately 190-second silent recording. Lyric text/recording remain local. Android occasionally returned null UI trees; these failed observations were retried and were not treated as clean stress results. Recipient-app delivery remains untested.

## Cloud devices

[Automotive run 34745432673](https://github.com/radiotedu/rtai-mobile/actions/runs/34745432673) passed the driver checks for all nine stations, Lo-Fi rendered playback, touch controls and podcast playback/pause/resume. Its current recordings still require visual review. Prior a99c37e car evidence does not replace this binary's evidence.

[Phone/tablet run 34745433846](https://github.com/radiotedu/rtai-mobile/actions/runs/34745433846) failed at opening the PNG composer after both devices passed startup, guest navigation/restarts, rendered radio/background controls and offline recovery. During a station jingle, the lyrics panel disappeared between the captured coordinates and tap. The driver now retries at most three times from fresh UI trees and still requires the actual Save PNG control. [Repeat run 34745830092](https://github.com/radiotedu/rtai-mobile/actions/runs/34745830092) is pending; the failed run is not an export pass. The first phone run also encountered a Pixel Launcher ANR, recorded separately from app behavior.

## Open release gates

Complete current phone/tablet export recheck and car visual review. Full Android Auto projection needs a full Auto installation; only the local stub is available. Isolated authenticated registration/session/account/Gold/Memory/Flash/retry and authenticated upgrade verification requires the environment in the [device handoff](RELEASE_1_3_9_DEVICE_TEST_HANDOFF.md). WhatsApp/Instagram receipt, remaining language/device/stress coverage and store listing/declarations remain open. No production balances or stream infrastructure changed; no public release or Google Play submission made.
