# Store screenshot evidence

Store images must be captured from the built app with `adb screencap`; no mock UI, generated metadata, or composited feature claims are accepted. Raw evidence and marketing composition are separate, immutable stages.

Prepare one session from a dedicated Android emulator, a clean committed SHA (including no untracked files), and one exact APK. The screenshot session does not claim AAB provenance; verify a Play bundle separately in the release pipeline. Preparation sets and verifies the requested English device/application locale and may restart an emulator whose locale differs. Use a fresh emulator profile so no saved in-app language override can contradict the verified OS locale.

```powershell
$env:ADB = 'C:\Users\akgul\AppData\Local\Android\Sdk\platform-tools\adb.exe'
node scripts/capture-android-store-screenshot.mjs prepare --apk mobile/android/app/build/outputs/apk/release/app-release.apk --component com.radiotedumobile/.MainActivity --serial emulator-5554 --locale en --size 1080x1920 --density 420 --out artifacts/store-evidence/<git-sha>
```

Preparation fails unless the expected package/activity resolves and the installed `base.apk` SHA-256 equals the input APK. When Android SDK `apksigner` is available (or `APKSIGNER` points to it), the APK signature must verify and signer certificate SHA-256 fingerprints are recorded. Absence of `apksigner` is recorded explicitly; an invalid signature always fails preparation.

Navigate the installed app to a real state, then capture it without reinstalling or relaunching:

```powershell
node scripts/capture-android-store-screenshot.mjs capture --session artifacts/store-evidence/<git-sha>/session.json --id en-radio-live --claim radio.live_metadata.normal --route Radio --state 'Normal quality; ICY title and artist visible' --surface app --output raw/en/02-radio-live.png
```

Immediately before every `adb screencap`, capture rechecks the input and installed APK hashes, exact package/component, version name/code, and observed English device/application locales. Any drift aborts the capture. Each raw-manifest entry records that verification snapshot.

Insets are read from Android. If the device does not expose stable insets, review `dumpsys window` and pass `--insets top,right,bottom,left`; never guess bar heights. Seal the complete raw set before composition:

```powershell
node scripts/capture-android-store-screenshot.mjs seal --session artifacts/store-evidence/<git-sha>/session.json
```

Compose a deterministic 1080×1920 RGB Play image with a neutral RadioTEDU phone frame. This removes only recorded OS status/navigation insets; the real app UI and its bottom navigation remain unchanged:

```powershell
python scripts/compose-radiotedu-store-portrait.py --manifest artifacts/store-evidence/<git-sha>/raw-manifest.json --capture en-radio-live --copy mobile/android/store-assets/copy/en.json --font C:\Windows\Fonts\arialbd.ttf --output artifacts/store-evidence/<git-sha>/final/en/02-radio-live.png
```

The evidence manifests record raw/final hashes, Git SHA, exact input and installed APK hashes, package/component/version, available signer-certificate fingerprints, observed device/application locales, crop, scale, logo/font/copy hashes, and alt text. Raw files and sealed manifests are never overwritten.

Required reproducible states before a release asset set is complete:

- Radio station with live Icecast metadata and normal quality.
- Low quality and Classic/Jazz FLAC quality, including the cellular-data warning state.
- Voting round with real candidates and vote controls.
- Jukebox with a connected device, now playing, queue, and search results.
- Study authenticated room with elapsed minutes visible.
- Account/profile/settings with consent and language override surfaces.
- Android media notification/lock-screen controls; separate real captures for Auto, TV, and Wear where listing policy requires them.

Do not publish screenshots containing email addresses, tokens, private account data, or analytics identifiers. Google Play preview dimensions and supported asset types must be checked against the [official Play Console guidance](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-US).
