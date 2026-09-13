# Signed candidate e32e04c — verification status

Not release-ready. This candidate fixes stream recovery overriding a user pause and keeps player transport controls outside the scrolling content. Earlier artifacts and failed tests remain preserved.

## Actual binary

- Source: `e32e04c4bccc50b7333f2f55d82c5ca4fdaaeb2f`, clean embedded source verified.
- Package: `com.radiotedumobile`; version `1.3.9`; phone versionCode `13090`.
- APK SHA-256: `3694db75c2abe41ee3f430c80b50c5bcc1195ef285ac6482daf0f4043fdb17ab`.
- AAB SHA-256: `4102e01dd2275d9b4bc15a1e0f5b7af7f2e2972ea5b80ad38ea7ba891fd0e0bc`.
- Production certificate SHA-256: `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`.
- All 26 64-bit ELF libraries passed 16 KB alignment in both APK and AAB, including React Native, Hermes and FLAC. Actual APK packaging alignment passed zipalign's 16 KB check.
- [Signed build 34754270314](https://github.com/radiotedu/rtai-mobile/actions/runs/34754270314) passed. Downloaded archive digest matched GitHub; extracted files were checked against archive contents. Local files: `artifacts/release-v1.3.9-e32e04c/`.
- [Exact-source CI 34754270383](https://github.com/radiotedu/rtai-mobile/actions/runs/34754270383) passed Android verification and iOS simulator compilation. iOS runtime is not verified. Local source checks: 409 mobile tests, TypeScript, release-version validation and 36/36 Android audit checks passed; lint had 0 errors and 227 warnings.

## Local device verification

Installed with `adb install -r` over the production-signed 7df candidate, without uninstalling or clearing data. Installed base APK SHA-256 matches the value above. Guest consent survived and Home rendered. This does not prove authenticated session/data retention.

Run `output/device-e32-controls-20260913-123852/` passed radio PLAYING with an active app AudioFlinger track, control placement outside scrolling ancestors, at least 48dp touch targets, 1.3 system font setting, actual landscape 2340×1080 and portrait 1080×2340, and touch pause/resume. Both orientation screenshots were visually reviewed. Controls remain visible; landscape artwork/metadata/lyrics content still requires scrolling. No physical-speaker claim.

The preceding local run `output/device-e32-controls-20260913-123709/` passed normal-font controls but failed after Android font-setting changes recreated the activity and returned to Home. The test now explicitly reopens the player following that configuration change and retains the same placement/size assertions. This is not a claim that navigation survives font-setting changes. Original evidence is preserved.

## Broader device runs pending

- Phone/tablet: [34755099298](https://github.com/radiotedu/rtai-mobile/actions/runs/34755099298).
- Automotive: [34755081033](https://github.com/radiotedu/rtai-mobile/actions/runs/34755081033).

Both use driver commit `9751d53`, pinned to the exact APK hash/build above. Initial dispatch 34755080069 resolved the preceding driver commit and was cancelled after inspecting its head SHA; it is not current-candidate evidence.

## Terminal and open release gates

Terminal source is unchanged. Its TGZ SHA-256 is still `175e6cbff5f3b8600708098e0bbb98fa9076ac79ddce20cbeacc835b6dc3fafd`; all 19 file contents of the new ZIP match the preceding verified package. Earlier terminal tests/captures apply to identical contents; no new terminal runtime claim is made.

Full Android Auto projection remains unavailable: the fresh Play Store check still reports this emulator incompatible. Isolated registration, authentication/session refresh, Gold consistency/earning/spending/duplicate handling, authenticated upgrade, recipient-app sharing and remaining stress/store/device checks are open. The earlier intermittent cloud phone playback ERROR remains unexplained despite five passing cold-start cycles on the previous 7df APK. See the [device-test handoff](RELEASE_1_3_9_DEVICE_TEST_HANDOFF.md). No public GitHub release or Google Play submission is justified by this report.
