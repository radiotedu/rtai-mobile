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

[Automotive run 34745432673](https://github.com/radiotedu/rtai-mobile/actions/runs/34745432673) passed the driver checks for all nine stations, Lo-Fi rendered playback, touch controls and podcast playback/pause/resume. Screenshots and sampled catalog recording frames were reviewed; native session data confirms the selected BPW podcast playing with matching metadata and visible artwork. This is Automotive evidence, not full Android Auto projection.

[Phone/tablet run 34745433846](https://github.com/radiotedu/rtai-mobile/actions/runs/34745433846) failed at opening the PNG composer after both devices passed startup, guest navigation/restarts, rendered radio/background controls and offline recovery. During a station jingle, the lyrics panel disappeared between the captured coordinates and tap. The driver now retries at most three times from fresh UI trees and still requires the actual Save PNG control. [Repeat run 34745830092](https://github.com/radiotedu/rtai-mobile/actions/runs/34745830092) passed on phone and tablet, including both PNG saves and no app entry in the crash buffer. The failed run remains preserved, including its separate Pixel Launcher ANR.

All four current phone/tablet PNG exports fully decoded at their required Story/Square dimensions. Reviewed cards show CORTIS album artwork, matching displayed title/artist and undistorted proportions. Phone landscape hero and controls fit the viewport; station cards continue in the scroll area. Extracted terminal package contents exactly match the earlier verified package; no terminal source changed.

## Open release gates

Three [store image candidates](images/release-1.3.9/store/README.md) now use current APK captures with proportional scaling and Manrope typography. The cloud phone podcast screenshot caught a launcher transition; its episode UI tree alone was insufficient visual evidence. Store artwork instead uses a fresh, visually checked local capture of loaded episodes. This observation limits screenshot coverage without changing the recorded driver results.

Full Android Auto projection needs a full Auto installation; only the local stub is available. Isolated authenticated registration/session/account/Gold/Memory/Flash/retry and authenticated upgrade verification requires the environment in the [device handoff](RELEASE_1_3_9_DEVICE_TEST_HANDOFF.md). WhatsApp/Instagram receipt, remaining language/device/stress coverage and store listing/declarations remain open. No production balances or stream infrastructure changed; no public release or Google Play submission made.
