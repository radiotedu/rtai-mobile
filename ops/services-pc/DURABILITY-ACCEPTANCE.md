# RadioTEDU Durability Acceptance Record

Date: 2026-08-14 (Europe/Istanbul)

This record maps the unattended-operation goal to authoritative evidence. The machine-local result file is `C:\ProgramData\RadioTEDU\ServicesCompanion\autonomy-verification.json` and must have `passed: true`.

| Requirement | Evidence | Result |
|---|---|---|
| Operable without Codex or login | Four Windows services run as `LocalSystem`; System UI is loopback-local; SYSTEM boot/watchdog tasks own recovery. | Pass |
| Start exactly at PC boot | All services are `Auto`, `DelayedAutoStart=0`; startup task has a boot trigger, `StartWhenAvailable`, and `WakeToRun`. | Pass |
| Recover after application closure | Destructive verifier kills the supervised child of AI Streams, Shared AI, Voting, and Juke; each service host launches a new child and its endpoint recovers. | Pass |
| Recover after whole-service failure | Verifier stops each service and starts the independent SYSTEM watchdog; every service and endpoint returns without user action. | Pass |
| Recover after service-host crash | SCM `FailureActions` has three restart actions and `FailureActionsOnNonCrashFailures=1` for all four services. | Pass |
| Recover after power loss | Immediate Automatic services plus the SYSTEM boot task execute before user login and are configured to run when a missed trigger becomes available. This is the non-reboot destructive/configuration equivalent; the verifier intentionally does not reboot the user's PC. | Pass |
| Restream after origin/network outage | EN/FR supervisors continue fresh local production while the origin is unavailable and continuously run their bounded reconnect loop. The semantic watchdog accepts healthy local production without restart-thrashing on external Icecast failure. | Pass locally; external origin currently unavailable |
| UI controls every service | Browser acceptance shows Start and Restart for AI, Juke, Shared AI, and Voting. Voting uses a detached SYSTEM task to restart its own UI host safely; destructive verifier proves the endpoint returns. | Pass |
| UI exposes semantic health | Browser acceptance shows two locally-ready EN/FR cards, automatic-origin-retry state, genre voting readiness, live Juke candidate count/mode, and Shared AI availability. | Pass |
| UI changes broadcast configuration | UI and API expose deterministic seed, EN/FR seeds, host enable, lead range, Juke roots, and scan interval; API contract tests prove validated persistence and targeted restarts. | Pass |
| UI manages Juke songs | Browser acceptance shows folder editing, candidate search, exclusions/restoration, managed upload, and managed deletion. Contract tests prove upload/delete and reversible exclusion; originals outside the managed root cannot be deleted by the UI. | Pass |
| Genre-only voting returns | Live `/api/health` reports `ready: true`, `votingMode: genre`, 9 eligible genres, and 500 eligible tracks; child and whole-service recovery both pass. | Pass |
| Juke all-playable returns | Live health reports ready roots `C:\` and `F:\`, an all-playable scan, and no rights filter; child and whole-service recovery both pass. | Pass |
| Deterministic operation | Runtime and tests use explicit seeds for AI rotation, AI host schedule, Voting choices/ties, and Juke fallback. | Pass |
| Approved AI catalogs | Filesystem and EN/FR health each report exactly 500 playable catalog items. | Pass |
| Ephemeral AI host | Each station reports `mode: dynamic-ephemeral`, queue depth 1, deterministic scheduling, and generation at the configured 3–4-song lead; used clips are deleted. | Pass |
| Secret isolation | Operator API is loopback-only and returns sanitized settings; tests verify credentials survive writes but are absent from responses; ProgramData secret ACL is SYSTEM/Administrators-only. | Pass |
| Maintainable by another AI | `AI-MAINTAINER-GUIDE.md` and `SYSTEM-FUNCTION-MAP.json` identify owners, invariants, edit process, tests, deployment, and rollback per function. | Pass |

## Verification commands

```powershell
cd C:\Users\tedu\Desktop\Services
powershell.exe -ExecutionPolicy Bypass -File .\Test-RadioTEDU-Autonomy.ps1
cd payload\voting-agent
npm.cmd test
npm.cmd run build
cd ..\juke-local
node --test server.test.js playLedger.test.js libraryScanner.test.js
cd ..\ai-host
python -m pytest -q tests/backend/test_ai_stream_supervisor.py tests/backend/test_dynamic_host_queue.py tests/backend/test_ai_quality_supervisor_unittest.py
```

Current automated evidence: 53 Voting/operator tests, 20 Juke tests, 23 focused AI tests, production TypeScript/Vite build, PowerShell parser validation, browser acceptance, and two successful full destructive recovery runs.

## External dependency

The external Icecast origin at `10.98.98.75:11154` currently accepts no usable source/listener response. RadioTEDU cannot repair or reboot that separate server. This does not stop local playout, queues, voting, Juke, health monitoring, boot recovery, or continuous automatic source retry. When the origin responds, no operator or Codex action is required.
