# RadioTEDU Study security boundary

The browser is never an authority for identity, Gold, inventory, study credit, seat ownership, events, or chat authorship. A modified client can change its own pixels, but must not be able to change durable account state.

## Required production enforcement

- Authenticate every `/study` and gamification request with the normal RadioTEDU account session. Ignore any user ID, display name, Gold balance, ownership list, or reward amount supplied by the client.
- Assign room instances on the server. Validate room IDs, node IDs, seat IDs, graph reachability, occupancy, and one-seat-per-account rules before accepting presence or reservations.
- Start study credit only after a server-owned seat reservation. Rotate a single-use cryptographic nonce on every heartbeat; reject missing, reused, expired, out-of-order, or cross-session nonces.
- Derive accepted study seconds from server time. Require a valid reserved seat, `seated` interaction, a visible/focused client signal, reasonable heartbeat cadence, and the room's study policy. Cap credit and rewards on the server.
- Finish sessions idempotently. Mint Gold once from server-calculated eligible seconds and return the authoritative balance and summary.
- Price and grant wearables on the server in one transaction. Require a unique idempotency key, reject insufficient balance, and return proof of ownership plus the authoritative remaining balance.
- Treat chat identity and timestamps as server-owned. Normalize text, reject empty or over-180-character messages, strip control/bidirectional spoofing characters, scope messages to the assigned room instance, and rate-limit by account and IP.
- Derive leaderboard time only from accepted server-side study heartbeats. Publish only the public user ID, moderated display name, rank, verified duration, and streak; never include email, student number, IP address, session identifiers, or authentication claims.
- Escape chat on every non-browser consumer. The web client uses text nodes and never injects chat as HTML.
- Log rejected nonce replays, impossible movement, conflicting seats, purchase replays, reward-cap attempts, and chat throttling for abuse review.

## Implemented client defenses

- Hosted production locks unless it receives an authenticated RadioTEDU bridge.
- Local preview cannot purchase items or mint Gold and is visibly labelled `LOCAL PREVIEW · No rewards`.
- Study heartbeats require a rotating nonce; replayed nonces, credit over 15 seconds per heartbeat, or credit while not seated/focused/visible are rejected.
- Purchases are idempotent and ignored unless the response proves ownership and a valid authoritative balance.
- Chat is room-scoped, normalized, length-limited, locally throttled, author-checked on send, rendered with `textContent`, and protected by a restrictive Content Security Policy.
- Moderation reports are authenticated, instance-bound, reason-limited, and idempotent in the production contract. The server must rate-limit and retain them for human review; client reports never create automatic sanctions.
- Ignore lists are private local display preferences. They hide chat and speech bubbles but grant no server moderation authority and cannot alter another account.

Client checks improve UX and detect broken responses; the production server rules above are the anti-cheat boundary and are mandatory for deployment.
