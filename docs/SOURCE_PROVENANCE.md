# Source Provenance

## Import identity

- Source repository: `trivagotr/rtjukebox`
- Source branch: `codex/study-game-oss`
- Source commit: `f2624e15cecbc206a1f7a0b9eb8c464c298bd7f2`
- Export allowlist: `mobile/` and `study-game/` only

The standalone repository was created from the exact tracked trees at that commit. Repository-specific documentation, contracts, and GitHub workflows were then added in independent commits.

## Required startup branding and native handoff

The import preserves all four supplied logo assets byte-for-byte:

- `mobile/src/assets/images/logo-radiotedu-splash.png`
- `mobile/src/assets/images/logo-rtai-splash.png`
- `mobile/logos/logo-radiotedu-splash.png`
- `mobile/logos/logo-rtai-splash.png`

It also preserves the startup and platform integration contracts:

- `mobile/__tests__/dualLogoSplashSource.test.ts`
- `mobile/android/app/src/main/res/values/colors.xml`
- `mobile/android/app/src/main/res/values/styles.xml`
- `mobile/ios/RadioTEDUMobile/LaunchScreen.storyboard`
- `mobile/android/app/src/main/res/xml/automotive_app_desc.xml`
- `mobile/README.md`, including its `## Startup branding` section

Android keeps the dark `#070707` native handoff and disabled template preview; iOS keeps its calibrated static dark launch background without template labels. The React Native startup surface then displays the original RadioTEDU and RTAI artwork.

## Intentionally excluded

The export intentionally excludes every source-repository top-level subsystem and generated artifact outside the two-directory allowlist, including:

- backend services (`backend/`)
- kiosk application (`kiosk/`)
- local voting/Music PC agent (`tools/local-voting-agent/`)
- WordPress files and pages (`wordpress/`)
- other tools or unrelated application directories
- `node_modules`, build output, Gradle output and caches
- emulator data, local environment files, signing material, QA recordings, and generated APKs

These exclusions keep the repository limited to the mobile client and Study game. They do not authorize deleting or changing any excluded source system, server content, RadioTEDU files, personal accounts, `@tedu.edu.tr` accounts, or WordPress pages.
