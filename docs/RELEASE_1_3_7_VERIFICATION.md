# RadioTEDU 1.3.7 verification — 5 September 2026

**Prerelease for testing, not certified ready for Google Play.** Requested publication includes known failures and incomplete device coverage. No production balances, stream infrastructure or station catalog were changed. No Play submission occurred.

## Exact artifacts

- Source/tag target: `5f4de3f58bd934bc9f40d164e3049dd110200497`.
- [Signed Android build](https://github.com/radiotedu/rtai-mobile/actions/runs/33954706256): passed.
- [Android/iOS CI](https://github.com/radiotedu/rtai-mobile/actions/runs/33954705585): passed. iOS simulator build does not establish App Store signing or physical-device readiness.
- Phone APK: `com.radiotedumobile`, version **1.3.7**, versionCode **13070**; embedded source matches the clean build commit.
- APK SHA-256: `a1461822fea5bfc71bcdf1c21ef713386285ccf2db76fbdf454ffecaaa1e9bf3`.
- Production certificate SHA-256: `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`.
- APK native ELF and ZIP packaging alignment: **16 KB passed**, including React Native, Hermes and FLAC. AAB native verification passed separately.
- All eight build artifact hashes match the supplied `SHA256SUMS.txt`.
- TV **13071** and Wear **13072** APKs have the same package/version and production certificate. They lack the phone's embedded Git SHA field; their source attribution comes from the Actions run, not that manifest field. Their device runtime was not retested.
- Actual phone manifest includes the Android Auto application declaration and `RadioTeduCarService` media browser service. Inclusion is not projection certification.

## Passed checks

| Area | Evidence |
| --- | --- |
| Mobile source | 379 tests / 95 suites; TypeScript passed; full lint had 0 errors and 190 existing warnings; changed artwork files passed focused lint |
| Release contracts | Repository/release contracts passed; Android static audit 36/36 |
| Study | 227 tests / 46 files and three generator contracts passed |
| Terminal | 24 tests; syntax checks; downloaded ZIP extracted and checked; CLI help and interactive Windows TUI worked |
| Terminal interaction | All four views opened; Classical launched ffplay and displayed live Bach metadata; quit restored terminal state. No authenticated earning/spending test was performed |
| Android install | Installed exact production-signed APK over existing installation without uninstall/clear-data; installed APK hash verified. Existing station favorite remained visible |
| Actual audio | Final APK radio produced active 48 kHz AudioFlinger output; podcast produced active 44.1 kHz output, including background playback |
| Media controls | Podcast artwork/title appeared in system media notification; notification Pause changed session to PAUSED |
| Covers | Final APK visibly displayed Elton John artwork for Rocket Man in the mini-player; podcast catalog covers displayed |
| Home | Red left border removed and visually checked in final APK |
| Account/API | Earlier same-session authenticated read-only production audit passed 14 checks; no production Gold awards or purchases |
| Public web | Deletion instructions accessible without sign-in; no deletion submitted. Desktop/mobile/tablet website widths checked without horizontal overflow |

Screen recording `45-v137-release-radio-podcast.mp4` documents final APK radio/podcast and background controls. Recordings are silent screen captures; decoded-audio evidence is separate. Recording `44-v137-final-artwork.mp4` documents the startup failure, not a passing artwork test.

## Unresolved or not retested

1. **Startup race reproduced:** after upgrade, player setup reported that Android was not foreground; Listen live failed. Backgrounding and returning to the app allowed setup/playback. The APK still needs a robust retry fix before broad end-user rollout.
2. **Artwork/lyrics depend on metadata.** Telephone arrived without artist information, so the conservative artwork matcher retained the logo. Wrong-song artwork is rejected. Wi-Fi lyrics source regressions and a live lyrics lookup pass, but final APK lyrics display has not been verified across songs.
3. **Lo-Fi external stream:** normal stream failed TLS/read; low stream decoded silence in the 12-second sample. Ten other station/quality probes decoded non-silent PCM. All stations are preserved; streamer-PC diagnosis remains separate.
4. **Full Android Auto projection blocked:** Play emulator contains only `1.2.542030-stub`. Prior Android Automotive tests are not proof of projection, and the final 1.3.7 car runtime was not repeated.
5. Final APK login/logout/session-refresh, registration, account/Gold refresh, earning/spending/idempotent game retry, events, games, offline recovery, tablet/TV/Wear runtime and a physical-device upgrade matrix remain incomplete. Earlier-version tests are not counted as final-binary passes.
6. Backend handoff reports 637 isolated tests plus 38 focused post-deployment tests. Those server/PostgreSQL tests were not rerun here. See [backend handoff](../backend/docs/MOBILE_136_BACKEND_HANDOFF.md).
7. Signed iOS App Store archive, physical iOS/CarPlay testing, Play pre-launch report and policy declarations remain outstanding.
8. Preview assets include reviewed phone screenshots, a feature graphic, terminal and desktop previews. They are not a complete tablet/car/TV/Wear store submission set.

## Preview provenance

Phone composites use unchanged real screenshots from this exact signed APK, uniformly scaled with Manrope (SIL Open Font License). Raw captures, hashes and composition manifests accompany the release evidence. One earlier Home-labelled capture accidentally contained the Podcasts route; that image was rejected and a new immutable Home session was captured and reviewed. Rejected output is not included in the published preview set.

The layout references the short headlines and prominent app screenshots used by [Spotify](https://play.google.com/store/apps/details?id=com.spotify.music&hl=en) and [BBC Sounds](https://play.google.com/store/apps/details?id=com.bbc.sounds&hl=en). No competitor assets were copied. [Play preview guidance](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en) was reviewed; no store upload or approval is implied.
