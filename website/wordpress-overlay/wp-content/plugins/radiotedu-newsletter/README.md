# RadioTEDU Monthly Podcast Newsletter

The plugin stores newsletter consent and delivery state in three dedicated WordPress tables. Email addresses are encrypted with Sodium and indexed through an HMAC, so logs and delivery tables do not contain plaintext addresses.

Operational behavior:

- Website visitors and RadioTEDU account registrations subscribe only after an explicit, optional newsletter consent.
- Verified ERP identities are imported read-only by the dedicated scheduler.
- An unsubscribe never disables account, ticket or service email.
- Each issue takes a fixed snapshot of episodes published in the preceding 30 days.
- The production snapshot is rebuilt at the publication cutoff, so episodes published after the preview are included.
- Upcoming active events within the next 120 days are imported through the same read-only database transaction and shown when available.
- September 2026 is skipped. The first production issue is scheduled for 1 October 2026 at 10:00 Europe/Istanbul.
- The first scheduler trigger and editorial preview are scheduled for 29 September 2026 at 10:00 Europe/Istanbul for `tuna.ozsari@tedu.edu.tr`.
- Before production start, manual tests are hard-limited to `arda.akgul@tedu.edu.tr`.
- A dedicated pause file and Windows task control only this newsletter.
