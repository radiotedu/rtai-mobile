# Security Review — RadioTEDU Mobile

Scope: full app (native config, networking, auth, storage, deep links, external
content, secrets). Below is every finding, severity, and whether it was fixed
here or is a recommendation requiring your action.

## ✅ Fixed in this pass

| # | Severity | Finding | Fix |
| - | -------- | ------- | --- |
| 1 | **High** | `android:usesCleartextTraffic="true"` allowed unencrypted HTTP app-wide (MITM risk). | Removed; added `res/xml/network_security_config.xml` that **blocks cleartext** except `localhost`/`127.0.0.1`/`10.0.2.2` (dev only). All prod endpoints are HTTPS. |
| 2 | **Medium** | `Linking.openURL()` opened **feed-controlled** podcast URLs — a malicious RSS feed could supply `javascript:`/`file:`/`intent:` schemes. | `PodcastScreen` now opens only `http(s)` URLs; others are blocked with a warning. |
| 3 | **Medium** | **Release builds were signed with the public debug key** (`signingConfig signingConfigs.debug` in release). Debug-signed APKs are not production-safe. | `build.gradle` now uses a real release keystore from a **gitignored** `keystore.properties` when present; falls back to debug only for local dev. |
| 4 | **Low** | Broad legacy storage permissions (`READ/WRITE_EXTERNAL_STORAGE`) granted on all Android versions. | Scoped with `maxSdkVersion` (READ ≤32, WRITE ≤29); not requested on modern Android. |

## ⚠️ Recommendations (need your action / a follow-up change)

| # | Severity | Finding | Recommended fix |
| - | -------- | ------- | --------------- |
| 5 | **Resolved** | Auth tokens previously used plaintext AsyncStorage. | Tokens now use `react-native-keychain` (Android Keystore / iOS Keychain); legacy values are migrated and removed. |
| 6 | **Resolved locally** | Release signing must not use the public debug key. | v1.2.3 is signed by the RadioTEDU release certificate; keystore credentials remain gitignored. Enrolment in Play App Signing remains a Play Console action. |
| 7 | **Resolved** | Firebase Analytics uses `google-services.json`; no Measurement Protocol API secret is embedded in the APK. | Keep API secrets server-side. |
| 8 | **Low** | `usesCleartextTraffic` for dev relies on the loopback exception — ensure no production traffic ever uses HTTP. | Keep all `radiotedu.com` traffic on HTTPS (already the case). |

## Checked and found OK

- **No hardcoded passwords or Measurement Protocol secrets** in `src/`.
- **No `WebView`, `eval`, `Function()`, or `dangerouslySetInnerHTML`** — no JS injection surface.
- **No non-TLS URLs** in code except the documented dev loopback.
- `android:allowBackup="false"` — app data excluded from device backups. ✅
- Exported components (`MainActivity`, RNTP `MusicService`) are exported for
  legitimate reasons (launcher, Android Auto) with appropriate intent-filters.
- Auth header handling (`api.ts` interceptor + `axios` default) is standard Bearer.
- `debug.keystore` committed is the **standard public RN debug key** — expected, not a secret.
- Deep link `radiotedu://jukebox/<code>` passes only a device code to the server,
  which validates it; low risk.

## Suggested next steps (in priority order)
1. Enrol the upload certificate in Play App Signing and keep the key protected.
2. Keep Firebase/GA4 property access restricted and rotate the disclosed unused
   Measurement Protocol secret (#7).
