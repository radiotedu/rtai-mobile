# September 12 candidate verification

Status: draft, not release-ready. Exact app source `6e1e8b59395f382df6d0345b9900b4c3b9ea84d9`. Later profile-copy changes are not included in this APK.

## Binary and source checks

- Package `com.radiotedumobile`, version 1.3.9, phone versionCode 13090; embedded source is clean and matches the commit above.
- APK SHA-256: `14411e13df60114797738aa42e989723e306bef23a19ebae785c7acde5ed6c91`.
- AAB SHA-256: `e57f320da2b83fe94d27c2c4eb369817fe98de79d059c58d69a04d5eb6f23d02`.
- Permanent certificate SHA-256: `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`.
- Actual APK ELF and ZIP 16 KB alignment passed; AAB ELF checks passed. Local hashes match GitHub's uploaded asset digests. Assets ending `6e1e8b5` identify this candidate.
- [Signed build 34608554985](https://github.com/radiotedu/rtai-mobile/actions/runs/34608554985) and [CI 34608707640](https://github.com/radiotedu/rtai-mobile/actions/runs/34608707640) passed. CI ran on a following documentation-only commit containing the same app code. Source checks: 404 tests, TypeScript, quiet lint, version validation and Android audit 36/36. iOS compilation is not iOS runtime verification.
- All ten JavaScript files in the packaged terminal match the previously tested source, ignoring line endings.

## Phone and real recap export

[Phone run 34720802751](https://github.com/radiotedu/rtai-mobile/actions/runs/34720802751) passed guest navigation, three consent-preserving restarts, large-font/rotation captures, native radio rendered audio, background media-key pause/resume, controlled offline recovery and native Story/Square saves. No app entry was found in its crash buffer. This does not prove authenticated flows or receipt in WhatsApp/Instagram.

The existing local Release139 emulator was upgraded with `adb install -r`, without wiping data. Its real 16-minute listening total survived. The recap was exported through Android's document picker, fully decoded at 1080×1920 and visually inspected: record artwork, large 16-minute total, correct favorite-station label, all-time stats and no old burgundy text paragraph. The unedited file is `docs/images/release-1.3.9/recap-story-6e1e8b5.png`; local recording is `output/recap-6e1e8b5/recap-export.mp4`. An immediate pull caught the document before writing completed; that empty file is preserved separately, and the completed PNG was pulled and verified afterward.

The local emulator suffered Android system-process/network-stack crashes and system ANR dialogs during boot, before successful installation. These were preserved in local diagnostics; Wait was selected on system dialogs. This is not a clean local stress-test pass or proof of authenticated upgrade retention. The cloud phone run is separate evidence.

## Car results and remaining defect

[Car run 34720800362](https://github.com/radiotedu/rtai-mobile/actions/runs/34720800362) reached all nine stations, Lo-Fi native playback and touch pause/resume. The selected BPW Talks episode reached the native RadioTeduMediaLibrary PLAYING state with matching episode metadata and rendered audio; the phone player was paused. Its screenshot shows correct podcast cover/title. The run then failed because UiAutomator could not obtain an idle UI tree while the podcast progress display updated. Podcast pause/resume was not completed.

The driver was changed to use session/audio/screenshot evidence during moving progress, then a media-key pause before requesting a fresh tree for touch resume. [Repeat 34721326084](https://github.com/radiotedu/rtai-mobile/actions/runs/34721326084) failed earlier during station paging, again not reaching the last three titles. The intermittent first-page reset is therefore still open: narrowing artwork notifications to affected parents has not yet proved a complete fix. Do not treat the earlier passing catalog run as proof that browsing is reliable.

Full Android Auto projection remains unverified. Android Automotive is a different test surface. Disk space has become available, but no connected physical Android Auto device was observed, and the saved Play Store setup showed Android Auto incompatible with that emulator.

## Open gates

Resolve/retest intermittent car paging and complete podcast controls; verify full Auto projection; complete isolated authenticated registration/session/Gold/game/retry and upgrade tests; verify recipient-app image receipt and lyric export; complete remaining device/runtime and store checks. See [device-test handoff](RELEASE_1_3_9_DEVICE_TEST_HANDOFF.md). The profile's misleading genre label was corrected in source in all six languages after this candidate; it requires a future build and visual verification. No production balances, stations or stream infrastructure were changed. No public release or Google Play submission was made.
