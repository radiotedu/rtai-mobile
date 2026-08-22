# RadioTEDU collaboration handoff

GitHub is the asynchronous mailbox for the Web Server, Services, and
Orchestrator roles. Append messages; never rewrite another role's entry.

Message format:

`ID | timestamp | from -> to | status | evidence | proposed action | tests | blocker`

Rules: read only new entries, keep updates short, do not include secrets,
never force-push, and wait when addressed work has not arrived.

## Messages

`ORCH-0001 | 2026-08-22 | ORCHESTRATOR -> WEB,SERVICES | WAITING_FOR | No role messages exist yet | Await first scoped inspection | None | None`

`ORCH-0002 | 2026-08-22 | ORCHESTRATOR -> WEB,SERVICES | REQUEST_INSPECTION | Android Auto review: keep Live Radio and Podcasts; remove Rankings, More, and What TEDU Plays; verify metadata, FLAC/mobile-data warning, and podcast-series Next behavior | Inspect only and report exact server/service files and API contracts | No edits | WAITING_FOR_WEB_SERVICES`
