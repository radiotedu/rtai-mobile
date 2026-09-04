# RadioTEDU release work

React Native Android/iOS app. Current baseline 08a6b66 is 1.3.6 (13060 phone). Permanent signing certificate is pinned in Android release signing configuration. Use GitHub Actions for native builds; never build on production web server. Backups: C:/Users/akgul/radiotedu-mobile-backups/20260904-232831-codex-release.

Public release is conditional on all requested APK verification passing. Preserve station catalog and existing homepage/game improvements. Report external-service and test-account limitations explicitly.

2026-09-05: 12 original phone recordings and per-issue results are in artifacts/issue-recordings-2026-09-05. Recorded defects: missing full-player Hi-Fi, clipped Snake Down control, incorrect Music IQ header. Source fixes are being verified; old recordings are not proof of the fixes. Automotive and further device tests are blocked by host disk space; existing files/users are preserved.
