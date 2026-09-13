# Signed c9ef48b candidate verification

September 13, 2026. Not release-ready. This report applies only to source `c9ef48b03c747c4469746f62c20bef0f91341b05` and its source-suffixed APK/AAB attached to the private v1.3.9 draft. Public release and Google Play submission have not occurred.

## Binary and build

- Package `com.radiotedumobile`; version `1.3.9`; versionCode `13090`; embedded clean source matches c9ef48b.
- Production certificate SHA-256 `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`.
- APK SHA-256 `48fc0dd498a9074f1731cc3c20ad27e2c46f76303e018d3fcd6ea078a55337f6`.
- AAB SHA-256 `1e4c0cac0c6eb6d39d4e8fca20fd646aad9433930c44d1774acdb93bc719ddef`.
- Actual APK/AAB: all 26 packaged 64-bit ELF libraries pass 16 KB alignment, including React Native/Hermes/FLAC. APK packaging passes zipalign. Uploaded GitHub asset digests match local hashes.
- [Signed build 34755606689](https://github.com/radiotedu/rtai-mobile/actions/runs/34755606689) passed. [Exact-source CI 34755596304](https://github.com/radiotedu/rtai-mobile/actions/runs/34755596304) passed Android verification and iOS simulator compilation. Local source validation: 409 tests, TypeScript, release version and 36 Android audit checks passed; lint 0 errors, 227 retained warnings.

## Runtime evidence

| Requirement | Evidence and limits |
| --- | --- |
| Portrait/landscape metadata and lyrics | Local signed upgrade preserved guest consent. Both orientations at font scales 1.0/1.3 passed station/title/artist visibility, lyrics frame and transport target checks. Loaded lyrics and complete card border visually reviewed. [Screenshots](RELEASE_1_3_9_PLAYER_LAYOUT_CORRECTION.md). |
| Phone/tablet | [Run 34756444772](https://github.com/radiotedu/rtai-mobile/actions/runs/34756444772) passed guest tabs, three process restarts, large text/orientation, native rendered audio, background pause/resume, offline recovery, Story/Square save and absence of app crash-buffer entries. These are bounded guest cases, not exhaustive stress or authenticated tests. |
| Automotive | [Run 34756446458](https://github.com/radiotedu/rtai-mobile/actions/runs/34756446458) passed nine-station catalog, Lo-Fi rendered audio, pause/resume and selected podcast playback with correct title/publisher/artwork. Lo-Fi and podcast screenshots reviewed. One episode was tested briefly; no full episode or complete car lifecycle claim. Automotive is not Android Auto projection. |
| Account deletion information | This APK opened `radiotedu.com/delete-account/` from Data & Privacy. Browser UI contains Turkish and English account/data deletion instructions. No deletion confirmation, email or request was submitted. Local screenshots/XML: `output/c9-guest-account-check/`. |
| Streams | Fresh build-computer PCM probes decoded eight seconds of non-silent audio for all nine normal mounts, including Lo-Fi and Energize. Voting emitted a non-monotonic timestamp warning at the output muxer; retained separately, no infrastructure changes. This is a short stream probe, not every-station Android playback or long-term availability proof. |
| Terminal archive | ZIP SHA-256 `4ba8d03d9de8f3cba24478688e2ae9702e0afbaf91b19eeff47abfee6adbb25d`. All ten shipped JS files match repository source and pass Node syntax checks; packaged CLI reports 1.3.9 and all nine stations. TGZ is unchanged from earlier tested package (`175e6cbff5f3b8600708098e0bbb98fa9076ac79ddce20cbeacc835b6dc3fafd`). No new authenticated Terminal/Gold claim. |

Local evidence includes `output/device-c9-controls-20260913-130823/` and `output/c9-terminal-streams-20260913-131624/`. Original recordings retained. Local player recording decoded without frame errors using normalized output timestamps; this does not certify original timestamps or frame-by-frame visual quality.

## New finding and remaining gates

Guest navigation found the global profile button announces hardcoded Turkish `Profil` in the English UI and has an approximately 29dp-high target. A source follow-up uses the existing translated profile title and a minimum 48dp target. The c9 APK does not contain that follow-up; a replacement signed build and device evidence are required.

Full Android Auto projection still needs a compatible device with full Auto. Isolated registration/login/refresh/logout, account/Gold consistency, Memory/Flash awards, spending, duplicate/lost-response recovery and authenticated upgrade still require the [test-environment handoff](RELEASE_1_3_9_DEVICE_TEST_HANDOFF.md). WhatsApp/Instagram composer receipt, remaining language/accessibility/stress cases, iOS runtime/signing and final Play listing/declarations remain unverified. Website/Auto store material remains outstanding. Earlier intermittent phone playback ERROR is not conclusively explained by passing later runs.

Do not call this candidate issue-free or publish it as final based on the completed subset.
