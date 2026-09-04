# RadioTEDU 1.3.6: release-candidate source handoff

## Status

Source is ready for a production-signed **release-candidate APK build on the build PC or GitHub Actions**. No APK/AAB, Gradle build, emulator, tag or release was produced here. This is not end-user or Play publication approval.

## Changes

- Synchronized mobile, TV, Wear, iOS, terminal and mobile lockfile versions to `1.3.6`. Android codes are `13060`, `13061`, `13062`; iOS build is `13060`.
- Release-version verification now also checks lockfile versions and platform build codes, preventing a correctly named artifact from containing stale source version metadata.
- Removed Android release debug-key fallback. All three Android modules require the established production private key and certificate before release compilation. The existing GitHub release workflow also verifies final APK/AAB signatures. Signing secrets were checked by name only; no secret values were displayed.
- Fixed the game-score retry path: a failed online submission retains its verified round proof and exact original payload. Successful submission consumes the local proof. Retained rounds are bounded to avoid unbounded memory growth.
- Extended the authenticated production audit with cross-screen Gold wallet agreement, ERP linking status and ecosystem tickets. Requests are bounded to four concurrent reads.
- Changed the live-stream health probe to use a normal GET instead of a file byte-range request, which is inappropriate for continuous live streams. The probe cancels after the first audio chunk and rejects missing bodies. This does not repair stream-server availability.
- Added a reusable in-memory PostgreSQL Gold verification script using the deployed backend's compiled economy service. It does not load production environment variables or connect to production databases.

The previously committed home discovery, arcade replay and account-deletion page remain included. Lo-Fi remains available in the app; stream-server repair belongs to the streamer PC.

## Verification completed

- Mobile: **355 tests in 93 suites passed**; TypeScript passed; ESLint returned zero errors (118 warnings remain).
- Repository release/API contracts: **22 tests passed**.
- Android source audit: **36/36 passed**; release version verification passed for `v1.3.6`.
- Live authenticated read-only account audit: **14 checks passed**, covering authentication, profile, Gold home, games, market, events, tickets, avatars, study presence, ERP status and ecosystem tickets. Profile, gamification, Home and avatar wallet balances agree and are valid nonnegative integers.
- Market API is healthy but its configured catalogue is empty; no products were inserted.
- Public Juke-Local, Voting and Study pages and the account-deletion page returned HTTP 200. Stream availability is **not certified**: a direct main-radio request delivered audio, but the final all-station audit returned empty bodies for all eight normal-quality station URLs. Lo-Fi also returned an empty body in a direct probe. Check the stream server and actual device playback before distributing to users; stream configuration was not changed.
- Backend isolated tests: **80 passed in eight files**, covering registration, refresh rotation, authentication middleware, gamification, economy, and game-session proof validation.
- In-memory PostgreSQL: **9 checks passed**, exercising the deployed Gold service's real SQL for awards, spending, rank/monthly totals, duplicate request protection, conflicting idempotency keys, insufficient-funds rollback and wallet/ledger reconciliation. Dummy accounts existed only in memory. Production database connections from this test: **zero**.

Live audit was limited to the owner's existing account, using a short-lived audit token kept inside the process. No live password login, account creation, deletion, purchase or reward mutation was performed. Isolated tests do not substitute for device testing or a live reward round.

## Required after building

1. Inspect the actual APK: version `1.3.6`, code `13060`, production certificate SHA-256 `B3B08DB1C4AEFBF4251D53951061ADA727796479DE45D817F9576232FF2D9439`. Test upgrade from a genuinely production-signed installation; a prior debug-signed APK cannot normally update across certificates.
2. Test login/refresh/logout, a real game reward and wallet refresh, background playback, notification controls, podcasts, events and account-deletion navigation on an Android device. Test airplane-mode/retry behavior without deliberately manipulating real balances.
3. Inspect native libraries for 16 KB compatibility. The React Native/Hermes/FLAC native stack was not upgraded here, so the earlier binary compatibility finding remains unresolved. Passing source checks does not prove binary compatibility.
4. Complete remaining publication checks, including the matching AAB, Play declarations and previously reported push-registration/Juke-Local authentication concerns. These were not certified by this task.

A response lost after the server has already accepted a game score can still encounter a consumed server proof on retry; retaining the client payload does not implement backend outcome recovery. Existing ledger idempotency protects duplicate accounting, but that ambiguous-response UX needs separate end-to-end testing.

## Safety and reproduction

Pre-edit tracked source backup: `C:\Users\tuna.ozsari\radiotedu-mobile-backups\20260904-release-api-225619\source-before.zip`.

No production backend deployment, database mutation, user-information change, deletion, notification or email was performed. The old dirty checkout was preserved. The source commit uses `[skip ci]` so this handoff does not start an Android build.

From the repository root, use `node scripts/verify-release-version.mjs v1.3.6` and `node --test tests/release-workflows.test.mjs tests/production-account.test.mjs tests/live-services.test.mjs tests/repository-contract.test.mjs`.

For the in-memory SQL audit, run `node scripts/verify-gold-isolated.cjs <backend-release-root> <external-tools-root>`. The external tools directory must contain `@electric-sql/pglite`; it is deliberately not an app dependency. The verified backend release was `C:\inetpub\rtjukebox-releases\20260828-ecosystem-r1`.
