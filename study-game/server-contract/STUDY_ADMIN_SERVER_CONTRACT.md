# RadioTEDU Study moderation server contract

The browser console at `/study/admin.html` is a client of this contract. It is never the moderation authority. Every endpoint below must authenticate the normal RadioTEDU server session and authorize the requested capability on every request.

## Mount point and response envelope

Mount the API at `/jukebox/api/v1/study/admin`. All responses use the existing RadioTEDU envelope:

```json
{ "success": true, "data": {} }
```

Failures must return a generic public message and a server-side request ID. Do not return stack traces, SQL, internal hostnames, email addresses, student numbers, raw IP addresses, session IDs, cookies, tokens, password data, or role storage details.

## Capabilities

- `study.moderation.read` — open the console and read public Study status.
- `study.moderation.ban` — create a Study-only ban.
- `study.moderation.unban` — revoke a Study-only ban.
- `study.moderation.reports` — resolve or dismiss a Study report.
- `study.moderation.audit` — read the moderation audit trail.

The server denies by default. A UI button being visible is not authorization. Re-check the capability, operator session freshness, target, and current resource state inside every transaction.

## Endpoints

### `GET /session`

Return the current operator's public ID, display name, exact allow-listed capabilities, and server session expiry.

### `GET /overview`

Return non-negative integer counts: `onlineUsers`, `activeBans`, `openReports`, and `actionsToday`.

### `GET /users?query=&status=all|active|banned`

Return at most 100 records. Each record contains only:

`userId`, `displayName`, `status`, `roomId`, `instanceId`, `lastSeenAt`, `openReportCount`, and `activeBan`.

`activeBan` contains `id`, allow-listed `reason`, sanitized internal `note`, `createdAt`, nullable `expiresAt`, and the creating operator's moderated display name. Do not expose the user's email, student number, main-account roles, password metadata, raw IP, device fingerprint, or authentication identifiers.

### `GET /reports?status=open|resolved|dismissed|all`

Return at most 100 reports containing the public target ID/name, moderated reporter display name, allow-listed reason, Study room, sanitized summary, timestamp, and status. The report queue never applies sanctions automatically.

### `GET /audit`

Return a cursor-paginated, append-only audit feed. A record includes action, operator display name/public ID, target public ID/name, reason, sanitized note, timestamps, nullable expiry, and request/idempotency ID. Raw request bodies and secrets are forbidden.

### `POST /bans`

Required capability: `study.moderation.ban`.

Body: `targetUserId`, allow-listed `reason`, `note` (3–500 normalized characters), nullable ISO `expiresAt`, and UUID `idempotencyKey`.

Perform one transaction:

1. Re-authenticate and re-authorize the operator; reject self-ban and protected-service targets.
2. Lock the target's Study profile and check for an active ban.
3. Insert the Study-only ban and consume the idempotency key uniquely.
4. Invalidate active Study focus and presence sessions/nonces.
5. Release Study seat reservations and remove the account from Study room presence.
6. Notify the Study realtime channel to disconnect the target.
7. Append the audit event.
8. Commit and return the authoritative updated Study user.

This action must not disable, delete, or change the main RadioTEDU account, ERP identity, mailbox, WordPress role, password, or any non-Study session.

### `POST /bans/{banId}/revoke`

Required capability: `study.moderation.unban`. Require `targetUserId`, a 3–500 character note, and a unique idempotency key. Lock the active ban, mark it revoked with operator/timestamp/reason, append an audit event, commit, and return the authoritative user. Never delete the original ban record.

### `PATCH /reports/{reportId}`

Required capability: `study.moderation.reports`. Accept only `resolved` or `dismissed`, a 3–500 character note, and a unique idempotency key. Lock the open report, update its state, append an audit event, and return it. A report review and a ban are separate actions.

## Security requirements

- Use the existing same-origin RadioTEDU session; do not put bearer tokens or admin secrets into HTML, JavaScript, local storage, session storage, URLs, logs, screenshots, or this package.
- Require HTTPS, a server-issued CSRF token/custom header, `Origin`/Fetch Metadata verification, JSON content types, and `SameSite`, `Secure`, `HttpOnly` session cookies.
- Rate-limit session discovery, searches, report review, bans, and revocations by operator and trusted proxy-derived source address.
- Configure the proxy trust list explicitly. Never trust a client-supplied `X-Forwarded-For` chain from an untrusted hop.
- Audit allowed and denied state-changing actions. Sanitize CR/LF and control characters. Keep security logs separate from the moderation audit trail.
- Store audit records append-only with restricted read access and tamper evidence. Do not make ordinary admins able to edit or delete them.
- Expire temporary bans with a server job and an auditable state transition. Server time is authoritative.
- Return `401` for no authenticated session, `403` for insufficient capability, `404` for intentionally hidden resources, `409` for stale/conflicting state or duplicate idempotency, `422` for invalid input, and `429` for throttling.

## Minimum persistence model

Use the existing server framework and database conventions. The logical model needs independently scoped Study records for:

- Study moderation capabilities or a mapping from the existing role service;
- Study bans with created/revoked/expiry metadata;
- Study reports with review metadata;
- moderation idempotency keys with operator/action/response identity;
- append-only Study moderation audit events.

Foreign keys may point to the main public account ID, but schema migrations and cleanup must never cascade-delete the shared RadioTEDU account.
