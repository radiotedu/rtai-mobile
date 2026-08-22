# Store screenshot evidence

Store images must be captured from the built app with `adb screencap`; no mock UI, generated metadata, or composited feature claims are accepted. `scripts/capture-android-store-screenshot.mjs` installs the APK, launches the requested component, requires exactly one ready device, enforces 1080×1920 PNG dimensions, and writes a SHA-256 evidence manifest.

Required reproducible states before a release asset set is complete:

- Radio station with live Icecast metadata and normal quality.
- Low quality and Classic/Cazz FLAC quality, including the cellular-data warning state.
- Voting round with real candidates and vote controls.
- Jukebox with a connected device, now playing, queue, and search results.
- Study authenticated room with elapsed minutes visible.
- Account/profile/settings with consent and language override surfaces.
- Android media notification/lock-screen controls; separate real captures for Auto, TV, and Wear where listing policy requires them.

Do not publish screenshots containing email addresses, tokens, private account data, or analytics identifiers. Google Play preview dimensions and supported asset types must be checked against the [official Play Console guidance](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-US).
