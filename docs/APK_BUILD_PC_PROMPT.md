# Prompt for the APK build computer

Continue RadioTEDU mobile v1.3.6 work from `https://github.com/radiotedu/rtai-mobile`, branch `main`. Fetch first, preserve newer commits and all unrelated local changes, and make timestamped backups before edits. Read `GEMINI.md` and `backend/docs/MOBILE_136_BACKEND_HANDOFF.md` before doing anything.

The backend has now been deployed on the server computer at `C:\inetpub\rtjukebox-releases\20260905-mobile136-recovery-r1`. The production mobile API base remains `https://radiotedu.com/jukebox/api/v1`. Do not redeploy the older Antigravity archive or modify production databases from this computer.

Actual backend source, tests, and migration are now tracked in this repository under `backend/`; the previous mobile commit only contained verification scripts/documentation. The tested backend implementation originates from commit `ecbd13a0ff509c072a5e954074c1351ff890eb8f` in `trivagotr/rtjukebox` and preserves newer server source.

What changed:

- Lost game-score responses can be recovered durably across restart. The stored fingerprint binds authenticated user, game, round, session, nonce, score, duration, and submission source. Exact retries return the committed result, with no second score or Gold ledger entry. Changed fields are rejected.
- The recovery record, score and Gold mutation commit atomically. Per-user database locking serializes concurrent submissions and daily limits. Ambiguous COMMIT outcomes recover from the database.
- Game profile/Home monthly Gold now uses the current month, matching account APIs.
- Logout reports database errors instead of falsely reporting success; `/logout-all` is restored with session revocation.
- Server migration `20260905_game_score_recovery.sql` has already been applied. It is additive; never delete or backfill recovery records from incomplete old payloads.

Verification: backend build passed; 637 tests passed across 68 files, with 2 unrelated voting integration tests skipped. All 38 focused fingerprint/PostgreSQL tests passed again using deployed source and a separate synthetic database. Live health and unauthenticated mobile API checks passed. No production balances were used for tests. No Android/iOS/terminal/mobile UI code was changed by this backend task.

Your task:

1. Confirm your checkout includes this handoff and preserve the existing mobile v1.3.6 changes. Baseline published APK source was `f3cfd03d6ba28f3b1cd5b2f6d9a752d00571600f`, version 1.3.6, Android versionCode 13060.
2. Keep the original score retry payload unchanged, including nonce, session ID, duration and round ID. Existing v1.3.6 client behavior already does this; the backend change alone requires no new app code or APK rebuild.
3. Update any stale verification expectations: exact score retry returns the original **201** success body, not 200 with `replayed:true`. The old `scripts/verify-gold-isolated.cjs` schema/expectations are outdated for this implementation. Prefer the new guarded PostgreSQL integration suite in `backend/src/routes/gameScoreRecovery.integration.test.ts`; never aim tests at production or copy production data.
4. Perform phone/device smoke checks for login, refresh rotation, logout, account totals and retry UI. Use an isolated/staging backend with synthetic users for score awards, changed-payload rejection, concurrency, and lost-response simulation. Use only authorized read-only requests for production account checks.
5. If the user still wants a fresh APK, build it here using existing authorized signing access and the repository's release workflow. Verify version/code, production signing identity, upgrade compatibility, and existing native alignment gates. Do not bump versions or publish to stores/GitHub Releases unless separately authorized. Do not request or paste signing passwords, server secrets, or production database data into chat or Git.
6. Return the exact source commit, artifact path/hash, signing/version verification, test results and remaining issues. Distinguish server deployment verification from device testing and publication.

Known limits: old committed rounds without fingerprints cannot safely recover; uncommitted in-memory game proofs can expire on server restart; full fresh-database bootstrap has an unrelated Study table-ordering issue. See the backend handoff for migration details, rollback and safe verification steps.
