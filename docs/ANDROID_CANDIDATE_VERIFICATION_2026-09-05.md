# RadioTEDU Android candidate verification — 2026-09-05

Status: signed candidate built; **not release-ready**. No Google Play publication or public GitHub release was created. Source fixes were pushed using the authenticated GitHub account `akgularda`.

## Artifact identity

| Field | Verified value |
| --- | --- |
| APK | RadioTEDU-Mobile-v1.3.6.apk |
| Package | com.radiotedumobile |
| Version / phone versionCode | 1.3.6 / 13060 |
| APK SHA-256 | 4ef5ac29273ec0a03cb51e85d5199c14d14cc0fbda5d9e946157fadebd068b7b |
| Certificate SHA-256 | b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439 |
| Binary source commit | 68110570062c999961de02d21036f1cec809232b |
| Build source | Clean checkout; established production signing key |

Artifact and inspection JSON files are in local `artifacts/release-v1.3.6-6811057/`. Download the workflow artifact from [Android build 33918864322](https://github.com/radiotedu/rtai-mobile/actions/runs/33918864322). Access follows repository permissions and Actions artifact retention. This documentation commit does not change the binary source commit above.

## Changes and safeguards

- Fetched and preserved baseline 08a6b668192d2e9e82ce49b5e076908da05f8517. Timestamped source archives and individual file backups exist outside the checkout.
- Updated React Native/Hermes to 0.77.3, Safe Area to 5.4.0, Kotlin to 2.0.21 and NDK to r28. Rebuilt existing FLAC JNI from pinned sources without replacing the production key or using debug signing.
- Added final APK identity, ELF and ZIP alignment gates. Workflows produce unpublished candidates by default. Fixed SDK manager invocation and required FLAC preparation in Android workflows.
- Updated iOS AppDelegate dependency provider/bundle URL integration and minimum deployment target to 15.1.
- Fixed mini-player overlap on authentication screens; regression failed before the fix and passed afterward. Preserved homepage, games and every station.
- No production server build, database command, real deletion request, intentional Gold award or purchase was performed. An explicitly authorized disposable registration was created; its credentials are encrypted locally and excluded from source/artifacts.

## Checks passed

- Final Actions mobile tests: **93 suites / 358 tests**. TypeScript, lint, release-version validation, Android audits/contracts and release build gates passed.
- [Final CI 33918864729](https://github.com/radiotedu/rtai-mobile/actions/runs/33918864729): Android verification and iOS simulator native compilation both succeeded.
- Independently inspected the downloaded final APK: package, version, code, production certificate and clean-source provenance match the table above.
- All **24 arm64-v8a/x86_64 native libraries**, including React Native, Hermes and FLAC, pass ELF PT_LOAD alignment and offset checks for 16 KB pages. Final APK passes `zipalign -c -P 16 4`. AAB ELF checks also passed.
- Phone emulator production upgrade from 1.3.1/13010 to intermediate 1.3.6 preserved first-install time, disposable account session and a favorite. Updating that candidate to the final APK with `install -r` also succeeded; final startup and favorite preservation were checked.
- Successful registration through the app's API contract; live test-account refresh produced distinct rotated tokens, and consumed-token replay returned HTTP 401. Fourteen read-only account/API checks passed, including consistent Gold across account/Home/gamification/avatar responses. Observed disposable account balance: 25.
- UI sign-in succeeded on the installed production baseline, account session survived the intermediate upgrade, and UI logout worked on that candidate. Final APK login/register controls are unobstructed; registration form and empty-field validation work. Successful final-APK form submission was not separately repeated.
- Intermediate candidate radio playback showed PLAYING and advancing audio output frames. Background/screen-off playback continued. Actual notification Play/Pause controls changed playback state correctly.
- Final APK podcast list and episode playback worked: PLAYING state and advancing audio output frames. Final Classical playback worked with High Quality selected; FLAC renderer loaded. Direct attribution of those output frames to FLAC, rather than fallback, was not established.
- Actual FFmpeg decoding produced non-silent audio for main radio, Classical, Jazz, Energize, Rock, French and English streams, plus Classical/Jazz FLAC streams. HTTP status alone was not used as playback evidence.
- Account deletion page returned HTTP 200 and rendered in the emulator browser through the app's Data Privacy link. No deletion form/request was submitted.

## Unresolved or untested — publication blocked

1. **Lo-Fi external stream:** normal mount produced no decodable audio/socket read failure; low mount returned 404. Station remains present. Streamer-PC/service diagnosis is separate; infrastructure was not changed.
2. **Isolated Gold/backend contract:** GitHub backend commit 8fcb29c74382721e829dd70a27934f12ac061a69 passed its 13 existing tests and TypeScript build, but the isolated PGlite duplicate-award test credited 200 instead of 100. That source lacks the expected spending/idempotency contract; subsequent spend/reconciliation cases did not execute. Same-second refresh replay also failed in isolation. Deployed backend/source parity is unknown; live test-account replay was correctly rejected. These findings cannot be asserted as confirmed deployed vulnerabilities. Establish backend parity and fix/retest isolated earning, spending and duplicate protection before publication.
3. **Offline recovery:** final phone radio entered ERROR when connectivity was disabled and remained in that state eight seconds after restoration. Longer automatic recovery and manual retry were not completed; cause remains unconfirmed.
4. **Android Auto/Automotive:** code review and Android compile checks are insufficient to certify runtime behavior. Automotive emulator launch was blocked by insufficient host disk space during final testing. No files were deleted to free space. Final car upgrade, browsing, actual playback, FLAC behavior, voice controls and physical/projection head-unit behavior remain unverified.
5. **Remaining runtime matrix:** final-build repeated login/logout/registration completion, events interaction, games/retry and authenticated spending/earning were not completed end to end. Read-only API returned 6 games, 2 events and no market items; an empty market prevented exercising a purchase catalog. Intermediate-candidate checks are identified above and are not represented as final-binary repetitions.
6. **iOS:** simulator compilation passed; no signed iOS archive, physical-device playback/background tests, App Store signing or submission validation was completed. Code compilation does not establish iOS release readiness.
7. **Device coverage:** emulator used 4 KB pages. Binary 16 KB compliance passed, but runtime on a 16 KB device, physical Android devices, Bluetooth/call interruptions and full lifecycle stress testing remain untested.
8. Dependency audit reported 14 affected entries (7 high, 7 moderate, including overlapping build-tool dependency chains). Remediation/production reachability review remains outstanding.

Local evidence includes inspection JSON, stream decode results, account read-only results, emulator screenshots/session/audio logs and an isolated-backend report. Screenshots containing disposable account details and encrypted credentials are not included in the public source report.
