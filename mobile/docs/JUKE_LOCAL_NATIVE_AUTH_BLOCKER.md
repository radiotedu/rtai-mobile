# Juke-local native auth adapter release blocker

The deployed `/juke-local/controller/` client currently reads its short-lived
bearer through Axios and the `localStorage` `token` key. The Android WebView
therefore provides an in-memory compatibility token only on the exact HTTPS
RadioTEDU controller route. It never writes the bearer to persistent storage,
cookies, URLs, logs, or other WebView routes.

This compatibility exposure must be removed before treating the controller as
fully isolated from page JavaScript. Required external work:

1. Add a controller-owned native auth adapter that uses the authorized fetch
   bridge without reading a bearer from JavaScript globals or storage.
2. Confirm login, refresh, logout, device pairing, and Axios requests through
   that adapter.
3. Remove `__RADIOTEDU_EPHEMERAL_TOKEN__` and the Juke-specific raw auth state,
   then update the mobile contract tests.

Until then, keep controller navigation pinned to
`https://radiotedu.com/juke-local/controller/` and use short-lived sessions.
