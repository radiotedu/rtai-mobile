# RadioTEDU Monthly Podcast Newsletter

The plugin stores newsletter consent and delivery state in three dedicated WordPress tables. Email addresses are encrypted with Sodium and indexed through an HMAC, so logs and delivery tables do not contain plaintext addresses.

Operational behavior:

- Web subscribers explicitly accept newsletter consent.
- Verified ERP identities are imported read-only by the dedicated scheduler.
- An unsubscribe never disables account, ticket or service email.
- Each issue takes a fixed snapshot of episodes published in the preceding 30 days.
- September 2026 is skipped. The first production issue is scheduled for 1 October 2026 at 10:00 Europe/Istanbul.
- The editorial preview is scheduled two days earlier for `tuna.ozsari@tedu.edu.tr`.
- Before production start, manual tests are hard-limited to `arda.akgul@tedu.edu.tr`.
- A dedicated pause file and Windows task control only this newsletter.
