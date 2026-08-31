# RadioTEDU WordPress player overlay

These files mirror the production footer-player surface that is deployed under
`C:\inetpub\wwwroot`. Apply only the listed paths; this is not a full WordPress
distribution and contains no database export.

The live endpoint requests ICY metadata only when `player=1`, excludes Lo-Fi,
uses WordPress's maintained CA bundle for the HTTPS stream connection, scans
past empty initial metadata blocks, and resolves cover art plus Apple/Amazon
links through the iTunes catalog. The browser player polls every 20 seconds and
keeps the same `Audio` element across in-site PJAX navigation.

No ERP, Sesli Kütüphane, email, notification or database-destructive operation
is part of this overlay.
