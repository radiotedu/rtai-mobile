# RadioTEDU server handoff

This repository is the mobile-contract source of truth. Before changing any
server code, inspect the authentication and WebView contracts in:

- `mobile/src/services/studyWebViewService.ts`
- `mobile/src/services/votingWebViewService.ts`
- `mobile/src/services/jukeLocalWebViewService.ts`
- `mobile/src/screens/study/LibraryStudyWebView.tsx`
- `mobile/src/screens/next-song-vote/NextSongVoteScreen.tsx`
- `mobile/src/screens/jukebox/JukeLocalWebViewScreen.tsx`
- `mobile/src/utils/api.ts`

Adjust the server-side implementation to match these contracts. Do not guess,
remove, or weaken authentication. Inspect first, report exact files and a diff
plan, then wait for approval before editing.

## Local services prompt

Use on the local PC Codex. Scope is only Voting, JukeLocal, Study auth bridge,
and related service/API endpoints. Do not modify website pages, WordPress, ERP,
or mobile UI.

Verify that one authenticated RadioTEDU account session works across Study,
Voting, and JukeLocal without a second login. Check bearer/cookie handling,
CORS, token expiry, logout, 401 behavior, vote identity, JukeLocal device
connection, queue, permissions, and safe guest behavior.

**NEVER DELETE WORDPRESS, ERP, OR ANY FILES. DO NOT CHANGE OR DELETE FILES
outside this exact service scope.** Do not use production credentials or bypass
consent/security. Inspect only first; provide findings, risks, affected files,
and exact proposed diff for approval.

## Website/account prompt

Use on the podcast PC Codex. Scope is only `radiotedu.com` account,
authentication, consent, localization, and web-server integration. Do not
modify local Voting/JukeLocal services, mobile code, WordPress content, ERP
data, backups, or unrelated files.

Verify RadioTEDU account session persistence, app-to-website authentication,
privacy-notice acceptance, secure logout/expiry, CSRF/CORS/cookies, and
RadioTEDU-account versus crew/ERP-account routing. Replace “Sign in with TEDÜ”
with “Are you in RadioTEDU crew?”. Ensure Study, Voting, and JukeLocal links
preserve the authenticated session. Keep English, Turkish, Russian, Arabic,
German, and French pages internally consistent.

**NEVER DELETE WORDPRESS, ERP, OR ANY FILES. DO NOT CHANGE OR DELETE FILES
unless explicitly approved.** Preserve backups, data, security, KVKK, GDPR,
and production behavior. Inspect only first; provide findings, risks, exact
files, and proposed diff for approval.
