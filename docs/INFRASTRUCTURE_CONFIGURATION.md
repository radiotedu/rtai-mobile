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
their source was not present in the v1.0.0 tag. During the 2026-08-09 probe,
`/lofi` returned HTTP 200; the other listed candidates returned HTTP 404. Keep
DNS hostnames in all apps so server migration does not require an app update.

## Secrets

No production secret can be recovered from v1.0.0 APK/AAB files. GitHub
reported no configured repository Actions secrets on 2026-08-09. Required
Android and iOS secret names are documented in `GITHUB_SECRETS.md`; values must
be supplied from the original secure keystore/certificate owners. Analytics and
Jukebox stream credentials remain blank in tracked mobile configuration.
