# RadioTEDU 1.3.9 candidate verification

This is a release candidate, not a Google Play readiness certification. Public publication remains gated by the unresolved checks below. No production balances, database contents or account deletions were changed during testing.

## Candidate

Source: `700fdf4cc4e437621d15ee8e9b924c6bf2a7ba3f`. Signed build: [Android Actions run](https://github.com/radiotedu/rtai-mobile/actions/runs/34579190307). Android/iOS source checks: [CI run](https://github.com/radiotedu/rtai-mobile/actions/runs/34579189727). Both runs succeeded, including iOS simulator compilation.

Independently inspected APK identity: `com.radiotedumobile`, version `1.3.9`, phone versionCode `13090`. Permanent signing certificate SHA-256: `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`. Embedded source commit matches the source above, with a clean source tree. Native ELF alignment and APK ZIP packaging alignment passed; the AAB native check also passed.

APK SHA-256: `21d49e4f860b18df0f81b58aa4bee56837486adb94837f9ab26ef07888effb35`.

## Changes

- Recap sharing now uses a designed poster with weekly listening minutes, decorative record artwork and explicitly all-time station/hour preferences. It no longer renders a verbose message or calls the station a genre. Track and lyric sharing have separate artwork layouts. Six languages and Story/Square formats are supported.
- PNGs use the native Android/iOS share or save sheet. The selected song is captured when opening Share. Export buttons remain above the preview. Native export normalizes supported formats to 1080×1920 or 1080×1080.
- Podcast sharing now uses the displayed episode title and publisher. Publisher names wrap instead of being truncated on Square cards.
- Fixed timezone-sensitive weekly recap resets. A regression reproduced 16 minutes incorrectly becoming zero after a three-hour timezone shift; the fix preserves the calendar week and still resets on a genuine week rollover. Existing emulator data displayed its original 16 minutes again after upgrade, without a data rewrite.
- Mini-player positioning uses measured tab height and navigation readiness. Foreground player initialization retries are bounded and cancelled in the background.
- Flash Memory uses the existing Memory reward contract. Games require an online authenticated session; no practice/daily challenge or new reward API was added. Game effects, reduced-motion support, haptics and local round history are included.
- Offline score retries preserve the original proof and payload. The client never invents Gold awards.
- Terminal typography, spacing, palette and wide-screen details were refreshed. All stations were preserved.

## Evidence and its scope

| Check | Result |
| --- | --- |
| Mobile source | 404 tests across 102 suites passed after the timezone fix; 10 focused tests passed after the final publisher-wrap adjustment. Final CI passed the full source checks and Android builds. TypeScript passed. Lint has no errors; existing and inline-style warnings remain. Release-version validation and Android audit (36/36) passed. |
| Terminal | Earlier in this task: 25 tests, syntax checks, guest playback and actual session capture passed. The final packaged terminal reports 1.3.9, lists nine stations including Lo-Fi, and all 10 JavaScript source files match the tested source, ignoring line endings. |
| Backend | Earlier: TypeScript and 87 focused tests passed. Changes were to test fixtures/mocks, not deployed runtime code. |
| Gold | 12 isolated PostgreSQL/handler checks passed for Snake and again for Memory: earning, spending, wallet/ledger agreement, duplicates, conflicts and lost-response recovery. Synthetic data only. These do not replace authenticated device testing. |
| Upgrade | Production 1.3.8 accepted an earlier 1.3.9 candidate without uninstall; first-install timestamp retained. Subsequent candidate upgrades preserved guest consent/history. Complete account-data retention remains unverified. |
| Player layout | Earlier candidate recordings show the mini-player above navigation, with real cover art when available. The station logo remains an artwork fallback. |
| Playback | Earlier candidates played main radio and BPW Talks #2; media-session state and active rendered audio were inspected. Background notification pause/resume and recovery after a controlled offline interval were recorded. |
| Sharing baseline | Earlier candidates opened the Android image chooser and saved a decoded 1080×1080 Square PNG. ce7c64c saved a complete Story PNG, whose plain design and 1919px height prompted the final redesign. These earlier images are not final-design proof. |
| Final sharing | Installed 700fdf4 with `install -r`. Saved the final 1080×1080 podcast card with complete episode/publisher text and undistorted artwork. Saved the final 1080×1920 recap showing the restored 16 minutes; it is byte-identical to the visually inspected 8e459ff recap. Both formats were also saved on preceding candidates. Android's chooser identified a PNG as an image. |
| Final podcast | 700fdf4 played BPW Talks #2 with an active Android audio track and PLAYING media-session state. Native audio-state evidence was inspected, not just HTTP status. |
| Guest games | Recorded on 8e459ff: online Gold requirements are visible and quick play routes to sign-in. No guest practice entry or Gold award was offered. Game code is unchanged in 700fdf4. |
| Android Auto inclusion | The actual final APK manifest contains the Google car application descriptor, RadioTeduCarService and MediaLibraryService. This verifies inclusion, not full projection. |
| Account deletion | In-app navigation opened the live deletion information page in Chrome. No deletion request or email was submitted. |
| Stream probes | Earlier PCM probes passed main, Classical, Jazz, Lo-Fi, Rock, English, French, Voting, Classical FLAC, Jazz FLAC and Lo-Fi low. Energize failed twice. On September 11, main radio returned HTTP 502 both in the emulator and from the build computer. This is an upstream stream-service blocker; no station was removed or infrastructure altered. |

## Remaining release gates

- Final lyric PNG and a live song with album art still need device verification. Tested images include station and podcast artwork. Non-English and very large listening totals require additional device coverage.
- Authenticated final-APK registration/login/session refresh/logout, Memory/Flash completion, Gold refresh and duplicate submission against an isolated HTTP backend. No such backend was supplied to the emulator. Production balances must not be used for this test.
- Full Android Auto projection. MediaLibraryService and Android Auto declarations are included, but projection was not verified with a full Android Auto installation or physical device.
- Final tablet, landscape, large-font and iOS runtime checks. The existing tablet has an incompatible signing certificate and was preserved. iOS simulator compilation does not establish App Store signing/readiness.
- Wi-Fi lyric availability and sharing need a successful final-device case. WhatsApp/Instagram receipt was not tested because recipient apps were unavailable.
- Restore upstream radio service and retest real playback. Finish repeated startup, events, games, account and offline stress coverage on the final binary.
- Store listing/declarations, release AAB and promotional images still require review. No Google Play submission was made.

## Recording provenance

Recordings are silent Android captures. Intermediate recordings include defects and must not be presented as passing final tests.

| Recording | Candidate / scope |
| --- | --- |
| 46–47 | Early 1.3.9 upgrade, emulator ANRs and separate fresh-emulator setup |
| 48–49 | b14daf5: radio, image chooser, Square save and podcasts |
| 50 | 351db73: Story clipping and network failure |
| 51 | 351db73: working background controls and offline recovery |
| 52 | 351db73: deletion page, privacy and guest game wording defect |
| 53 | d2ce67e: export footer still clipped |
| 54 | ce7c64c: reachable export actions and successful plain Story save |
| 55 | 917f835: startup, redesigned recap preview and save |
| 56 | 917f835: redesigned now-playing exports using station artwork |
| 57 | 917f835: podcast playback and the discovered share-title defect |
| 58–59 | 8e459ff: restored recap, podcast exports; Square publisher truncation identified |
| 60 | 8e459ff: guest game requirements and sign-in gate |
| 61 | 700fdf4: final podcast sharing with wrapped publisher |
| 62 | 700fdf4: final recap and save-dialog navigation |

The last recording's transfer (63) stalled in the emulator transport and is excluded. Its saved Story PNG was successfully pulled, decoded and compared before that transfer issue. No emulator data was wiped; stalled recording clients were stopped.

The older phone emulator had Launcher/System UI ANRs. A separate emulator was created rather than wiping existing data. Another host interruption broke emulator network access; restart restored it. These environment failures are separate from application defects.

Timestamped backups precede source edits outside the repository. Credentials, signing keys and private raw logs are excluded from release evidence.
