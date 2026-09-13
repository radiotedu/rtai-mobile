# Playback recovery and visible controls recheck

September 13, 2026. Work toward the release continues; this is not release approval.

## Installed candidate evidence

The installed base APK was hashed directly on `emulator-5556` and matches source `7df67f8` candidate SHA-256 `9276be5ab5ed002c31f6893894dfc28e923a41823bfb9ae7e1d5713f0effb75f`.

Five cold-process-start cycles passed: launch with existing guest consent, Listen live, app media session PLAYING with active AudioFlinger rendering, sustained playback, and media-key pause. Each cycle retained screenshots, native state, app logs and a screen recording in `output/radio-start-stress-7df-20260913-121425/`. No uninstall, data clearing or account/Gold operation occurred. First and fifth sustained-playback screenshots were visually reviewed; matching artwork and live lyrics were visible. This bounded pass does not explain the earlier cloud phone ERROR or prove general stress readiness.

## New source fixes awaiting signed APK verification

- An asynchronous fallback could call play after the user paused while its queue lookup or stream load was pending. Both new regression cases failed against the previous implementation (returned true and restarted playback). Recovery now rechecks user intent and the active track before replacing a stream, and respects a pause that arrives during load. The focused playback/recovery suites pass: 19 tests.
- Long song titles plus the lyrics panel pushed transport controls partly below the visible area. The player already allowed scrolling to them, but immediate access was poor. Controls now sit outside the scrolling artwork/metadata/lyrics region and do not shrink. Verify the rebuilt APK with long titles, visible lyrics, large fonts, phone/tablet and landscape before claiming this fixed on-device.

The full mobile suite passed 409 tests in 103 suites. TypeScript passed; full lint completed with 0 errors and 227 warnings; release-version validation passed for v1.3.9; Android source audit passed 36/36 checks. Lint warnings were retained rather than automatically rewriting unrelated files. Native CI/build and final artifact/device checks remain pending. Existing production signing and 16 KB alignment gates remain mandatory. Android Auto projection, isolated account/Gold workflows and recipient-app sharing remain open as documented in the device-test handoff.
