# Signed b63037c candidate verification

September 13, 2026. This is a verified candidate, not a final release-ready declaration. The latest app source at this checkpoint is `b63037c0ada52fc0c9e2ee85306951ebf7aacff6`; a subsequent Social wording change still requires a replacement APK. Existing APKs and evidence remain preserved in the private v1.3.9 draft.

## Actual binary

- Package `com.radiotedumobile`, version `1.3.9`, versionCode `13090`, embedded clean source b63037c.
- Production certificate SHA-256 `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`.
- APK SHA-256 `14162252a654213edeefefa17d89bd30ba7e9985151845b5db775c8af1455568`.
- AAB SHA-256 `1f56c940be324540006f712aed789e1920604161cfede7a69da129a6ba803833`.
- All 26 packaged 64-bit native libraries pass 16 KB ELF checks in APK and AAB, including React Native, Hermes and FLAC. APK packaging alignment passes zipalign. GitHub asset digests match local hashes.
- Actual APK manifest contains the Google car application declaration, RadioTeduCarService and MediaLibraryService. This proves inclusion, not Android Auto projection.

## Checks passed

- [Signed build 34757210026](https://github.com/radiotedu/rtai-mobile/actions/runs/34757210026) and [exact-source CI 34757180285](https://github.com/radiotedu/rtai-mobile/actions/runs/34757180285) passed, including Android verification and iOS simulator compilation. Local source checks: 409 tests, TypeScript, changed-file lint, release version and Android audit passed.
- Installed over the production-signed c9 APK with `adb install -r`; guest consent retained. Local English Profile label is correct, with bounds 351×126 pixels at 420dpi: a 48dp-high target. Cloud Home checks enforce the translated label and at least 48dp targets.
- [Phone/tablet run 34757886300](https://github.com/radiotedu/rtai-mobile/actions/runs/34757886300) passed guest navigation, three process restarts, 130% text and orientation checks, complete player metadata/lyrics regions, native rendered audio, background pause/resume, offline recovery and 1080×1920/1080×1080 PNG saves. No app entry appeared in the crash buffer. Phone landscape, tablet portrait and local player screenshots were visually reviewed.
- [Automotive run 34757887988](https://github.com/radiotedu/rtai-mobile/actions/runs/34757887988) passed all nine catalog entries, Lo-Fi rendered audio, radio pause/resume and selected BPW podcast title/artwork/publisher with rendered audio and pause/resume. Podcast screenshot reviewed. This is a short episode test, not a full playthrough or full car lifecycle test.
- Local UI selected and played all nine stations: RadioTEDU, Classical, Jazz, Lo-Fi, Energize, Rock, English, Français and Voting. Each retained an active app AudioFlinger track for an eight-second observation, displayed the selected station and paused successfully. Separate recordings and screenshots retained at `output/b630-all-stations-20260913-135235/`; all 27 start/sustained/pause assertions passed. This does not prove physical speaker output or long-term availability.
- Terminal ZIP contents match all 19 files in the previously verified c9 package. TGZ hash remains `175e6cbff5f3b8600708098e0bbb98fa9076ac79ddce20cbeacc835b6dc3fafd`; b630 ZIP hash is `45a1d184eb7f3e0893390c99433d4ae6ac1f42b2a252ba3bfc72a628a78a7a4c`.

## Findings retained, not erased by later passes

The local station catalog briefly reported five available stations after a foreground probe; another normal foreground refresh recovered all nine, which then passed individual playback. Availability remains dependent on transient stream/header checks. The current evidence does not establish whether that transient failure arose from the emulator/network or stream service. No station definitions or stream infrastructure were changed.

Guest Social still exposes internal “server-owned” wording in b630. A source-only follow-up replaces the six localized subtitles with user-facing study/avatar descriptions; the b630 APK does not contain it.

Guest Jukebox opens in Turkish despite English app locale and displays dotted-İ `RADİOTEDU`. A fresh English browser reproduces this at the explicit `?lang=en` URL. See the [server frontend correction handoff](JUKE_CONTROLLER_LOCALE_SERVER_HANDOFF.md); do not claim an APK rebuild fixes the external page.

## Remaining completion gates

Full Android Auto projection; isolated registration/login/session refresh/logout, account/Gold consistency, Memory/Flash rewards, spending, duplicate/lost-response recovery and authenticated upgrade; actual WhatsApp/Instagram composer receipt; remaining authenticated events/games/stress coverage; iOS runtime/signing and final Play listing/declarations. The device and backend prerequisites remain in [the handoff](RELEASE_1_3_9_DEVICE_TEST_HANDOFF.md). Phone/tablet/desktop image assets are available; Auto-specific artwork still requires real projection evidence. No public GitHub release or Google Play submission has been made.
