# September 12 candidate a99c37e verification

Status: draft; not release-ready. App source `a99c37e58abb136e2a4e572e89505aa5f600d200`.

## Artifact

Package `com.radiotedumobile`, version `1.3.9`, phone code `13090`, clean embedded source verified directly from the APK. Established certificate SHA-256: `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`.

APK SHA-256: `3d17a72c8d753dc995e2614c4a3fab053de25c3aaead0bb1a9b70e561ef26c11`.
AAB SHA-256: `f458c9be739f6a3df0fd5b8039cbc455671ec8682c20b0d0e10461422f73ef3d`.
Uploaded assets ending `a99c37e` have matching GitHub digests. Older draft assets remain historical evidence.

All 26 APK native libraries passed 16 KB ELF alignment, including React Native, Hermes and FLAC. APK ZIP packaging alignment and AAB ELF checks passed separately. [Signed build](https://github.com/radiotedu/rtai-mobile/actions/runs/34722591025) and [CI](https://github.com/radiotedu/rtai-mobile/actions/runs/34722588503) passed, including mobile tests, TypeScript, lint, Android audit, native Android unit tests/builds and iOS simulator compilation. iOS runtime and App Store readiness remain unverified.

The new terminal ZIP's 22 extracted entries exactly match the previously tested terminal package. The TGZ is byte-identical. ZIP metadata changes its archive hash; contents are unchanged.

## Exact-APK device evidence

[Phone/tablet run 34723273219](https://github.com/radiotedu/rtai-mobile/actions/runs/34723273219) passed guest launch/navigation, three consent-preserving restarts, font/rotation captures, rendered radio audio, background pause/resume, controlled offline recovery, and native PNG exports. No app entry appeared in the Android crash buffer. Story and Square PNGs fully decode at 1080×1920 and 1080×1080 on both devices.

Visual review confirmed the phone landscape hero and controls fit; its station shelf continues below the scroll viewport. Tablet captures include actual landscape and portrait: the file named `12-landscape-requested.png` is portrait because Pixel C's natural orientation is landscape. The tablet's landscape capture temporarily shows podcast retry/loading, while the following portrait capture contains loaded episodes. Reviewed Story/Square exports show a-ha's live album artwork, matching title/artist and undistorted square imagery.

[Normal online Automotive run 34723272205](https://github.com/radiotedu/rtai-mobile/actions/runs/34723272205) passed all nine station labels through native paging, Lo-Fi rendered playback and native touch pause/resume, podcast browsing, matching BPW Talks #2 playback/artwork, media-key pause and native touch resume. Networking stayed enabled during browsing; this is not the prior offline diagnostic. Screenshots, sampled recording frames and session dumps were inspected. `RadioTeduMediaLibrary` itself was PLAYING with matching podcast metadata; the phone player was PAUSED. Catalog and controls recordings are approximately 50.2 and 40.5 seconds, respectively.

The previous car paging defect was intermittent. [Repeat online run 34723571343](https://github.com/radiotedu/rtai-mobile/actions/runs/34723571343) is pending before accepting repeatability. One passing run does not prove every car lifecycle/control case or Android Auto projection.

## Remaining gates

Full Android Auto projection requires a full Auto installation; only the stub is available locally. Isolated authenticated registration/session/account/Gold/Memory/Flash/retry and authenticated upgrade tests still require the environment described in the [device handoff](RELEASE_1_3_9_DEVICE_TEST_HANDOFF.md). Actual receipt in WhatsApp/Instagram, lyric export, remaining language/stress/device/runtime cases and store listing/declarations still need verification. Profile label changes are included but their rendered profile screen has not yet been checked on this APK.

No production balances, stations or stream infrastructure changed. No public release or Google Play submission made. Guest and Automotive evidence does not establish overall release readiness.
