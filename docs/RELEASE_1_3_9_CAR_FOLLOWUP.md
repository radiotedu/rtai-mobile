# 7441ad1 car verification follow-up

September 13, 2026. APK unchanged: source `7441ad1c052221363b75f9ff8855d7630addb8b2`, SHA-256 `cdc2d88d04eb18df15c373011aa6227ac0dc75062eb7fdcbc57267627da2e27a`. These results supplement the [signed candidate report](RELEASE_1_3_9_7441AD1_VERIFICATION.md); they do not certify Android Auto projection or release readiness.

## Local online Automotive checks

The existing `RadioTEDU-Automotive` AVD uses Android 35-ext15 and the `automotive_1408p_landscape_with_play` hardware profile, with a 1408×792 display. It contained RadioTEDU 1.3.6, versionCode 13060. Its original APK was backed up before an in-place `adb install -r` upgrade to the exact 1.3.9 candidate. Both APKs use production certificate SHA-256 `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`. No uninstall, wipe, emulator reset, production-data write or replacement signing key was used. Guest setup remained accepted; authenticated session/account-data retention was not tested.

With networking enabled, retained screenshots show all nine stations across successive pages, including English, French and Voting at the end. Lo-Fi rendered native audio and passed touch pause/resume. Podcast browsing selected **BPW Talks #2 – Kariyer Yolculuğu ve Girişimcilik**, preserved its title/publisher/artwork and rendered audio; media-key pause and touch resume passed. Playback continued on the car Home screen; media pause/play and returning to the car host retained the selected episode. Assertions require the app's native Media3 session and active AudioFlinger track, not HTTP status or another app's audio. Physical speaker output and full reconnect coverage are not established.

Evidence: `output/local-car-744-20260913-1631/`, including original screenshots, four recordings and separate Lo-Fi, podcast and background results. Pre-upgrade APK/configuration backup: `output/backups/automotive-launch-20260913-163107/`.

## Cloud diagnostic and display configuration

- The original online [34764519457](https://github.com/radiotedu/rtai-mobile/actions/runs/34764519457) failed visible paging, despite host logs reporting nine items. Its failure remains preserved.
- The same APK passed [cached-catalog diagnostic 34765476088](https://github.com/radiotedu/rtai-mobile/actions/runs/34765476088). Networking was paused only during cached browsing and restored before Lo-Fi/podcast playback. It passed visible nine-station browsing and native radio/podcast controls, but **does not count as a normal online browsing pass**.
- Removing the forced cloud skin without specifying a hardware profile produced a 320×640 phone-shaped display in [34766148861](https://github.com/radiotedu/rtai-mobile/actions/runs/34766148861). That environment is invalid for this car-layout test. Its screenshots and failed result remain available; it is not an app regression verdict.
- Driver `74d9a3f95a79bffb455e42272ce1c47bc0996e98` selects the SDK-listed `automotive_1408p_landscape_with_google_apis` profile and rejects captures that are not a landscape display of at least 800×480. The exact APK/source/hash pins and all nine-station, audio and control assertions remain intact. Python syntax and eight workflow tests passed. [Online run 34766510422](https://github.com/radiotedu/rtai-mobile/actions/runs/34766510422) is pending at this checkpoint.

Run 34766120811 was cancelled because it used the earlier driver commit after dispatch; no result from it is counted. Native app code was not changed or rebuilt during these environment diagnostics.

Full Android Auto projection still needs a supported phone/device setup; the phone emulator has only the incompatible/stub package. Isolated authenticated Gold/registration/account/game testing, recipient-app share receipt and the server-owned Jukebox frontend repair also remain open. See the [environment handoff](RELEASE_1_3_9_DEVICE_TEST_HANDOFF.md). The GitHub release stays a draft.
