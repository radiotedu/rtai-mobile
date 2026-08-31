# Voting Live Activity preview

This ActivityKit model is intentionally limited to a user-opened song-voting
round. It never exposes the Juke queue and never starts for ordinary radio
playback. A Widget extension and its App Store signing profile are required
before this source can ship; the current repository does not have those Apple
credentials, so the production iOS target does not reference this directory.

Android 16 uses the equivalent promoted Live Update only after the trusted
Voting page emits a `radiotedu.voting.round` message. No push, email or remote
notification is sent by either implementation.
