# RadioTEDU Monthly Podcast Newsletter

The plugin stores newsletter consent and delivery state in three dedicated WordPress tables. Email addresses are encrypted with Sodium and indexed through an HMAC, so logs and delivery tables do not contain plaintext addresses.

Operational behavior:

- Website visitors and RadioTEDU account registrations subscribe only after an explicit, optional consent for the monthly podcast selection and ticketed event updates.
- Consent records include the consent text version and timestamp. Production delivery requires an active web subscriber with the current consent version; ERP identity sync alone never grants newsletter consent.
- Unsubscribe and language preferences are available from each issue. Unsubscribing does not disable account, ticket or service email.
- Each issue takes a fixed snapshot of podcast episodes published in the preceding 30 days. The production snapshot is rebuilt at the publication cutoff.
- Upcoming events are imported read-only from the public `/bilet/feed.php` JSON feed on every scheduler run and shown with their ticket links and categories. ERP remains read-only.
- The monthly editorial preview is sent to `tuna.ozsari@tedu.edu.tr` two days before publication. Its top red button opens a confirmation page to reject that issue; opening the email link alone does not reject it.
- September 2026 is skipped. The first production issue is scheduled for 1 October 2026 at 10:00 Europe/Istanbul.
- Production subscriber delivery is held by `C:/RadioTEDU/state/newsletter-send-held.flag` until editorial approval. Removing that file enables production delivery; test-message recipients remain hard-limited to `arda.akgul@tedu.edu.tr` and `tuna.ozsari@tedu.edu.tr`.
- `php cli.php sync-ticket-feed` refreshes only the public ticket feed cache and sends no mail. `php cli.php render-preview tr 30` writes a local preview and sends no mail. `php cli.php test <approved-address> 30` sends the explicit 30-day test issue.
- The separate full pause file and Windows task control only this newsletter.
