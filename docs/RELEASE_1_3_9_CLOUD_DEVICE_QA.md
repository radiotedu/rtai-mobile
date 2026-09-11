# Signed candidate cloud device checks — September 11, 2026

Tested the existing production-signed 1.3.9/13090 APK from source `700fdf4cc4e437621d15ee8e9b924c6bf2a7ba3f`. SHA-256 was checked before each install: `21d49e4f860b18df0f81b58aa4bee56837486adb94837f9ab26ef07888effb35`. The actual certificate, package and embedded clean-source identity were verified again. No APK was rebuilt for these checks.

- Pixel C / Android 35: tablet job passed in [run 34599043572](https://github.com/radiotedu/rtai-mobile/actions/runs/34599043572). The overall run failed because its separate phone job encountered a persistent Pixel Launcher ANR.
- Pixel 7 / Android 35: phone-only [run 34599540795](https://github.com/radiotedu/rtai-mobile/actions/runs/34599540795) passed. No launcher recovery was needed in this successful run.
- Both installed the exact APK, continued as guest without optional analytics, navigated Home/Podcasts/Radio, and returned to Home after three process restarts with consent retained. Neither had an app entry in the Android crash buffer.
- Both captured a 1.3 font-scale setting and rotation. Visual review confirmed home content in portrait and landscape, and real song artwork in the mini-player above navigation. This does not establish actual audio playback or comprehensive accessibility coverage.
- Phone landscape exposed an oversized header/hero that consumed most of the viewport. A compact landscape layout is being prepared; it requires a new signed build and visual verification. These captures are before that adjustment.

Earlier run 34598730025 failed because the driver selected an off-screen tablet checkbox and the phone had a system-launcher ANR. The driver now requires usable control bounds before tapping and handles only the explicitly identified Pixel Launcher dialog. It does not dismiss RadioTEDU crashes. All failed-run evidence is retained.

Native screenshots, XML hierarchies, identity checks, result JSON and silent recordings are included in the dated cloud evidence archive. The tablet recording is 120.506 seconds, H.264, 540×960. Source screenshots retain each emulator's actual aspect ratio and resolution.

These are guest checks on disposable cloud emulators. They do not establish authenticated account/Gold/retry correctness, production-release account upgrade retention, Android Auto projection, Wi-Fi lyrics, recipient-app sharing, or release readiness. Those gates remain open. Local Android Auto remains blocked by the SDK disk-space guard; no guard was bypassed or user data wiped.
