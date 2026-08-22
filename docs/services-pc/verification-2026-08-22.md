# Services-PC verification — 2026-08-22

Time zone: Europe/Istanbul  
Public API changed: **No**

## Result

All scoped service-PC components were healthy after current-state destructive recovery testing.

| Check | Evidence | Result |
|---|---|---|
| Automatic startup | Voting, JukeLocal, AI Streams and Shared AI are immediate Automatic `LocalSystem` services. YouTube Focus, YouTube Classical and the stream watchdog are SYSTEM boot tasks. | Pass |
| Child crash recovery | The verifier terminated each application child and observed a replacement child plus a recovered semantic endpoint. | Pass |
| Whole-service recovery | The verifier stopped each application service and observed the independent SYSTEM watchdog restore it. | Pass |
| Voting self-restart | The operator restart endpoint replaced the Voting service host and health returned. | Pass |
| Voting connection | Public status returned agent `school-radio-pc`, `connected=true`, and an active open round. | Pass |
| JukeLocal connection | Local health returned a ready 12,801-track all-playable catalog; the post-restart log recorded an authenticated WebSocket connection. | Pass |
| AI playout | EN and FR produced fresh local audio, maintained host queues of 10, and each public Icecast URL decoded three seconds of 48 kHz stereo MP3 without error. | Pass |
| YouTube playout | Focus and Classical status files were fresh, running, and free of fatal errors with 429 and 9 tracks respectively. | Pass |
| YouTube recovery | A controlled Lo-fi supervisor termination exposed an obsolete `adaptive-v2` watchdog PID path. The deployed watchdog was corrected to `adaptive-v4`; the updated watchdog restored a replacement supervisor and healthy status. | Pass after fix |
| YouTube regression tests | Full repository suite: 12 passed. | Pass |
| Guest-only JukeLocal test | Playwright showed role `Misafir`, connected to `KOLEJ`, searched for Chopin, queued “Berceuse in D-Flat Major, Op. 57,” received the success notice, and observed Queue 5 → 6 immediately. | Pass |
| Secret scan | The 14-file operational source package contained no credential value. | Pass |

## Published revisions

- `radiotedu/rtai-mobile`: operations package commit `21b26b28bf8eb8bd0872cd0c7ae56f52fec978f5`.
- `akgularda/radiotedu-focus-stream`: watchdog fix commit `26e4cbf224ab2d788dc795afc8376d4bc5ed057e`.

## Local evidence

- Destructive verification record: `C:\ProgramData\RadioTEDU\ServicesCompanion\autonomy-verification.json` with `passed=true`.
- Pre-test backup: `C:\RadioTEDU\backups\services-durability-20260822-192113`.
- YouTube watchdog backup: `C:\RadioTEDU\backups\youtube-watchdog-path-20260822-192825`.
- Human HTML guide: `C:\Users\tedu\Desktop\RadioTEDU-Service-and-Song-Guide.html`.

## Test footprint

The production guest acceptance left one non-personal guest session named `Codex Guest Check` and one approved Chopin queue entry on device `KOLEJ`. No admin account was used. The entry was not deleted because deletion was not part of the authorized acceptance flow.

