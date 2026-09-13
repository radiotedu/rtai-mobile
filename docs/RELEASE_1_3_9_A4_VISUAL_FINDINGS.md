# a4cff9a candidate: visual verification rejected

September 13, 2026. Do not publish this candidate as final. Source `a4cff9af3ea1f09c2fd6d7e7e13df0bd17dea5b9` was built by Actions run [34759314978](https://github.com/radiotedu/rtai-mobile/actions/runs/34759314978).

The actual APK is `com.radiotedumobile`, version 1.3.9, versionCode 13090, clean embedded a4 source. SHA-256: `6090addacdb89687c8f8b4b5665ed5c88a2a76a356e0ea14e7d3a1c1a69ffd2d`. Production certificate: `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`. APK/AAB each passed all 26 native ELF alignment checks; APK zipalign passed 16 KB packaging. AAB SHA-256: `cec9db19f5a5e582c580705399b0b53d9459f0b6f633349f8e4a9ef11a96c56b`.

Exact-source CI [34759299351](https://github.com/radiotedu/rtai-mobile/actions/runs/34759299351) passed, including iOS simulator compilation. Phone/tablet automation [34759971520](https://github.com/radiotedu/rtai-mobile/actions/runs/34759971520) and Automotive automation [34759972537](https://github.com/radiotedu/rtai-mobile/actions/runs/34759972537) passed with driver `2713559f51c1a2389bf7567b0bf25386cd7c952e`. These automated results do not override the visual rejection below, and Automotive is not full Android Auto projection.

## Visual findings

The landscape metadata layout exposes station, song and artist, but the newly added bundled image underlay has an independent sizing defect. React Native supplies intrinsic dimensions for bundled images; absolute positioning alone does not override them. In the local landscape capture, the oversized fallback extends behind artist text and transport controls. Lo-Fi also displayed a blank artwork tile despite the packaged source image being present and nonuniform. Explicit dimensions are now applied to both image layers in source `5f53a61fe7c318530ad58591479e1ffe74576939`; replacement build [34760546289](https://github.com/radiotedu/rtai-mobile/actions/runs/34760546289) still needs artifact and visual verification.

Evidence retained locally:

- `output/device-a4-controls-20260913-144008/05-player-landscape-verified.png`: oversized underlay visible behind text. The helper's metadata/target assertions pass but do not check this overlap.
- `output/a4-stations-social-20260913-143327/13-station-3-playing.png`: blank Lo-Fi tile; image-variance assertion correctly stops the run. Main, Classical and Jazz passed short rendered-audio and nonblank-art checks before this failure.
- `output/a4-lofi-recheck.png`: blank tile persists on a later capture.
- Earlier station-run failures are retained: ambiguous RadioTEDU text selected the current player header instead of the station card, then retries encountered the still-open player. The helper now explicitly selects a card containing its station name and Listen action and establishes a fresh process/navigation state. No app safeguard was weakened.

The six-language Social wording correction is present; English UI XML confirms the new subtitle and guest login requirement. One early screenshot captured wallpaper before the later UI dump, so that image is not evidence of the rendered Social page. A fresh visual capture remains necessary.

All 19 files in the terminal ZIP match the previously tested b630 package; TGZ hash is unchanged. The replacement source passed 409 tests in 103 suites, TypeScript, changed-file lint (zero errors, existing warnings), release-version validation and Android static audit.

Full Android Auto projection, isolated authenticated Gold/account/game testing and the server-owned Jukebox locale/branding correction remain open. See [device prerequisites](RELEASE_1_3_9_DEVICE_TEST_HANDOFF.md) and [server correction handoff](JUKE_CONTROLLER_LOCALE_SERVER_HANDOFF.md). No public release or Play submission is authorized by these partial results.
