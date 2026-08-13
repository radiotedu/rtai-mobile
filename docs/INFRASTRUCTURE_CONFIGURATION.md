# Infrastructure Configuration

Snapshot updated on 2026-08-13. DNS addresses are operational observations,
not values to hardcode in clients.

| Purpose | Host | Observed IPv4 |
|---|---|---|
| Website, API, and WebViews | `radiotedu.com` | `95.183.243.90` |
| Radio streams | `stream.radiotedu.com` | private TEDU origin; use DNS |

The tracked source uses unchanged legacy mounts for all stations. Six music
stations additionally prefer `-normal`, with automatic fallback through other
AAC tiers and then the legacy mount:

- `/radio`
- `/classic`
- `/cazz`
- `/lofi`
- `/spark`
- `/rock`
- `/energize`
- `/en` (single AI stream; no quality mounts provisioned)
- `/fr` (single AI stream; no quality mounts provisioned)

Provisioned music suffix profiles are `-low` (Opus 96), `-normal` (AAC-LC 128),
`-high` (Opus 196), and `-flac` (Ogg/FLAC). All four quality families are
currently disabled at the origin; the six unchanged legacy mounts remain the
production path. The app must not invent `/en-*`,
`/fr-*`, `/radiotedu-en`, or `/radiotedu-fr` URLs. The six FLAC listener URLs
use `http://stream.radiotedu.com:11154/<mount>-flac` because TinyIce exposes
them directly and the HTTPS proxy does not route quality suffixes. Android
permits cleartext only for that listener hostname; API, account, voting,
WebView and credential traffic remains HTTPS-only. Headless Android Auto and
TV/Wear playback carry the same selected → normal → low → high → legacy
fallback policy; FLAC is available only when explicitly selected.

On 2026-08-13 each direct `-flac` mount independently returned 48 kHz stereo
FLAC. A simultaneous six-mount continuity test then exhausted the current
TinyIce origin and also stalled legacy listeners. The extra FLAC sources were
disabled immediately to protect normal broadcasting. These client URLs are the
ready contract, but lossless service must remain operator-disabled until the
origin is restarted and its source/listener capacity is increased or replaced.

The v1.0.0 TV/Wear release binaries also contained `/ai` and `/event`, although
their source was not present in the v1.0.0 tag. A fresh GET probe on 2026-08-09
returned audio HTTP 200 for `/lofi`; that observation is historical. On
2026-08-12 the TinyIce origin accepted TCP but returned no HTTP bytes for any
mount. The mobile fallback code is complete, but live stream acceptance remains
blocked until the origin is restarted and verified. The configured Voting WebView also returned 404 because it is intentionally
disabled; Juke-local and Study returned 200. Run
`node scripts/verify-live-services.mjs` for diagnostics. Signed-release workflows
use `--allow-unavailable-streams`: they verify the configured Icecast links but
do not block while channels are intentionally offline. They also use
`--allow-unavailable-voting` while Voting is intentionally disabled; Juke-local
and Study remain blocking WebView checks. Keep DNS hostnames in all apps so
server migration does not require an app update.

## Secrets

No production secret can be recovered from v1.0.0 APK/AAB files. GitHub
reported no configured repository Actions secrets on 2026-08-09. Required
Android and iOS secret names are documented in `GITHUB_SECRETS.md`; values must
be supplied from the original secure keystore/certificate owners. Analytics and
Jukebox stream credentials remain blank in tracked mobile configuration.
