# Production Account Testing

The manual `Production account smoke` workflow verifies authenticated production APIs that unit tests cannot prove: Gold profile and persistence, games, market, events, tickets, Study rooms, sessions, and avatar inventory.

Configure these repository secrets for a dedicated disposable test account:

| Secret | Purpose |
|---|---|
| `RADIOTEDU_E2E_ACCESS_TOKEN` | Short-lived access token |
| `RADIOTEDU_E2E_ACCOUNT_ID` | Account ID guard; prevents using the wrong token |
| `RADIOTEDU_E2E_AVATAR_ITEM_ID` | Optional cheap avatar item for purchase/equip testing |
| `RADIOTEDU_E2E_MARKET_ITEM_ID` | Optional harmless market item for Gold-spend testing |

Run with `mutate=false` for read-only route/schema checks. Run with `mutate=true` only for the disposable account: it submits a minimal game score, completes a short Study session, optionally purchases/equips the configured avatar item, optionally redeems the configured market item, then re-reads Gold state. Output contains check names and catalog counts only—never token, account details, or balances.

Rotate the access token after testing. Never use a student, staff, or administrator account.
