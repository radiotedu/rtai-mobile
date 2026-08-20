# RadioTEDU Study final handoff

Target URLs:

- Game: `https://radiotedu.com/study/`
- Moderation: `https://radiotedu.com/study/admin.html`

## Package contents

- `dist/` — production game and admin multi-page build.
- `src/`, `public/`, `art/` — complete editable client source and assets.
- `tests/`, `e2e/`, `scripts/` — contract, behavior, browser, generation, security, and release checks.
- `server-contract/` — server-authoritative moderation contract.
- `STARTER_PROMPT.md` — English prompt for the authorized webserver integration agent.
- `BACKUP_AND_SCOPED_REPLACEMENT.md` — mandatory backup, deletion boundary, and rollback rules.
- `SECRETS_AND_NETWORK_INVENTORY.md` and `config/production.env.template` — required names and safe storage boundaries; no live values.
- `release-evidence/` — final screenshots and audit reports.
- `RELEASE_MANIFEST.json` — per-file SHA-256 and byte lengths, regenerated after final verification.

The ZIP excludes `node_modules`, browser traces/videos, temporary logs, live `.env` files, credentials, private keys, tokens, production exports, and raw private IP addresses. These are intentionally not game files and must remain in the authorized RadioTEDU secret manager/infrastructure inventory.

The moderation UI is complete, but production bans become authoritative only after the existing RadioTEDU server implements `server-contract/STUDY_ADMIN_SERVER_CONTRACT.md` and injects the authorized bridge. The production page fails closed when that bridge is absent.
