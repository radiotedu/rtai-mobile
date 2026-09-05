# RadioTEDU 1.3.6 candidate

## 2026-09-05 terminal and store presentation follow-up

Preserve backend 502761ba and all stations. Replace terminal rendering with responsive, measured-width layouts and accurate playback status; retain authentication and player controls. Fix lyrics artist matching and cancelled-request races. Back up touched files externally. Validate terminal behavior, mobile regressions, TypeScript, lint and Android/version safeguards before producing a new signed Actions candidate. Compose store artwork from provenance-checked real screenshots using HTML, original RadioTEDU typography and proportional device images. Research Spotify/BBC presentation without copying assets. Verify phone/tablet/web and car separately; Automotive is not proof of Android Auto projection. Publish a new GitHub version only after final binary checks, keeping unresolved physical-device, service and Play Console requirements explicit. No Play submission or production balance mutations.

2026-09-05 recorded-defect follow-up: restore full-player Hi-Fi from the active track (never from a pending quality preference), fit Snake's board into remaining height so all direction controls remain visible, and reuse the localized Music IQ catalog title. Touch only these three screens. Validate with TypeScript, lint and mobile tests, then Actions and a new signed-artifact recording when device disk capacity permits. Historical car, Gold and store requirements remain open; no publication until their evidence passes.

Car follow-up: after space was freed, production Automotive upgrade succeeded. Catalog recording exposed missing podcasts when RNTP foreground setup fails; initialize the native car catalog independently in App.tsx. Car song-only presentation omitted station identity; retain station/available artist in Media3 subtitle. Test existing full suite and native Actions build, then repeat the car recording. Hi-Fi buffering/fallback is still under investigation; no playback success inferred from its badge.

Baseline: 08a6b66, preserved by fast-forward and timestamped external source archives.

Upgrade React Native/Hermes to the first compatible 0.77 patch line, retain React 18 and the existing app architecture, and rebuild the same FLAC decoder with NDK r28. Preserve all stations, homepage, games and production identity. Make Actions generate a candidate without publishing until runtime checks pass.

Files: mobile package manifests; Android native build config/vendor build script; iOS AppDelegate/deployment target; binary verification script; CI/release workflows and focused regressions.

Success: source checks pass; established certificate and 1.3.6/13060 verified on final APK; every 64-bit ELF PT_LOAD aligned to 16 KB; ZIP packaging aligned; emulator upgrade and feature checks recorded. Separate external stream and authenticated test blockers from client defects. Never claim untested device behavior.

Validation: Jest, tsc, ESLint, release-version and Android audit; isolated backend tests; Actions Android release/iOS simulator build; binary inspection and emulator runtime evidence. Risks: Kotlin/native module migration, FLAC source compatibility, stream availability, unavailable isolated account credentials. No production data mutations or Play publishing.

2026-09-05 final binary exposes Automotive platform FLAC decoder crash (c2.android.flac.decoder). Supply official matching Media3 1.10.1 libFLAC renderer from pinned source, with a separate JNI soname from RNTP and NDK28 flexible page sizes. Preserve both playback stacks and all stream URLs. Native build only in Actions; inspect new APK identity/ELF/ZIP, then repeat recorded Hi-Fi and normal/podcast playback.

2026-09-05 e148ed0: signed build and Android/iOS CI passed; APK ELF/ZIP/signature verified. Recorded upgrade retains account and 25 Gold, logout and English guest copy pass, phone Hi-Fi/background notification controls pass. A 30-second offline outage needs manual Play; adding validated NetInfo reconnection recovery preserving pause/stop and station identity (nine regression cases; full 367 tests pass). Car Media3 libFLAC now loads but Ogg live frame gaps trigger libFLAC multi-output silence insertion and abort its one-frame adapter; flush continuity between complete Ogg packets, preserving CRC/format checks. New binary runtime verification remains required. Guest with no user object should display Guest rather than Member.

2026-09-05: Recorded Snake landscape control clipping on e148ed0 (clip 31). Added opt-in landscape game sidebar and side-by-side board/D-pad for Snake, preserving portrait layout and all game status. Awaiting source checks and new APK runtime verification.

2026-09-05 publication: user explicitly requested APK and terminal verification and GitHub release. Preserve built source 5f4de3f; publish a prerelease with known startup, metadata, Lo-Fi and device-test limitations. Package exact Actions artifacts, inspect identity/native alignment, exercise packaged terminal and Android playback, include reviewed screenshots and evidence report. Files: README, release report, preview assets, memory and ledger. Success: public assets match local SHA-256, tag points to APK source, clean synchronized main. No Google Play submission.
