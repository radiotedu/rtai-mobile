# Study server secret requirements

The Study browser client is intentionally secret-free. No production credential belongs in this repository, a deployment prompt, an archive, Android assets, browser storage, HTML, JavaScript, source maps, or logs.

The webserver deployment must reuse the protected configuration already installed for RadioTEDU. Names differ between hosts, so the deployment agent must map the server's existing variables or secret-manager entries to these capabilities without copying their values:

| Capability | Required use | Must remain server-side |
| --- | --- | --- |
| Database connection | Account, inventory, study sessions, events, rewards, presence metadata, and moderation records | Yes |
| Session verification/signing material | Verify the existing RadioTEDU login and prevent impersonation | Yes |
| CSRF secret or framework CSRF service | Protect every state-changing same-origin request | Yes |
| Rate-limit storage/credentials | Shared enforcement for chat, presence, study heartbeat, purchases, and reports | Yes |
| Internal service credential, only if the existing account service requires one | Server-to-server account lookup | Yes |
| Encryption key, only if protected Study data is encrypted at rest | Server-side encryption/decryption | Yes |

Public configuration such as `/jukebox/api/v1`, `/study/`, login navigation URLs, room IDs, and asset URLs is not secret. A short-lived CSRF token may be rendered by the server for the current session, but it must be scoped, escaped, rotated according to the host framework, and never stored in the repository.

Before deployment, the server agent must:

1. Identify the existing secret provider and the runtime identity that may read it.
2. Confirm each required capability exists without displaying its value.
3. Keep file-based secrets outside the web root with least-privilege ownership and permissions.
4. Keep database and authentication operations server-authoritative.
5. Scan the built `dist/` output for private keys, passwords, tokens, connection strings, and source-only configuration.
6. Report only capability names, secret source names, and pass/fail status; redact all values.

If a capability is unavailable, stop before production deployment and request that the operator provision it through the server's protected secret mechanism. Never invent a credential, copy one from WordPress files into the project, or substitute a hard-coded value.
