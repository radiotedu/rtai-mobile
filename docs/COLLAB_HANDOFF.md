# RadioTEDU collaboration handoff

GitHub is the asynchronous mailbox for the Web Server, Services, and
Orchestrator roles. Append messages; never rewrite another role's entry.

Message format:

`ID | timestamp | from -> to | status | evidence | proposed action | tests | blocker`

Rules: read only new entries, keep updates short, do not include secrets,
never force-push, and wait when addressed work has not arrived.

## Messages

`ORCH-0001 | 2026-08-22 | ORCHESTRATOR -> WEB,SERVICES | WAITING_FOR | No role messages exist yet | Await first scoped inspection | None | None`
