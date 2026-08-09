# Infrastructure Configuration

Snapshot verified on 2026-08-09. DNS addresses are operational observations,
not values to hardcode in clients.

| Purpose | Host | Observed IPv4 |
|---|---|---|
| Website, API, and WebViews | `radiotedu.com` | `95.183.243.90` |
| Radio streams | `stream.radiotedu.com` | `95.183.243.73` |

The tracked source uses these HTTPS stream mounts:

- `/radio`
- `/classic`
- `/cazz`
- `/lofi`
- `/spark`
- `/rock`

The v1.0.0 TV/Wear release binaries also contained `/ai` and `/event`, although
their source was not present in the v1.0.0 tag. A fresh GET probe on 2026-08-09
returned HTTP 404 for all eight candidates, including `/lofi`. The configured
Voting WebView also returned 404; Juke-local and Study returned 200. Run
`node scripts/verify-live-services.mjs` for diagnostics. Signed-release workflows
use `--allow-unavailable-streams`: they verify the configured Icecast links but
do not block while channels are intentionally offline. Keep DNS hostnames in all
apps so server migration does not require an app update.

## Secrets

No production secret can be recovered from v1.0.0 APK/AAB files. GitHub
reported no configured repository Actions secrets on 2026-08-09. Required
Android and iOS secret names are documented in `GITHUB_SECRETS.md`; values must
be supplied from the original secure keystore/certificate owners. Analytics and
Jukebox stream credentials remain blank in tracked mobile configuration.
