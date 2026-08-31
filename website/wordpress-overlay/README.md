# RadioTEDU WordPress player overlay

These files mirror the production footer-player surface that is deployed under
`C:\inetpub\wwwroot`. Apply only the listed paths; this is not a full WordPress
distribution and contains no database export.

The live endpoint requests ICY metadata only when `player=1`, excludes Lo-Fi,
uses WordPress's maintained CA bundle for the HTTPS stream connection, scans
past empty initial metadata blocks, and resolves cover art plus Apple/Amazon
links through the iTunes catalog. The browser player polls every 5 seconds,
keeps the same `Audio` element across in-site PJAX navigation, and displays an
automatic three-line synchronized lyric view when LRCLIB has a confident match.
LRCLIB is queried directly from the browser and needs no account or API key.

The overlay also includes the production theme's `header.php`, `functions.php`
and `assets/css/app.css` because `/listeler/` (`/en/playlists/`) is implemented
as a database-free theme route. It renders 23 public RadioTEDU Spotify playlist
embeds with editorial Turkish/English descriptions; the empty Classical list is
intentionally excluded. `page-listeler.php` is the route template.

No ERP, Sesli Kütüphane, email, notification or database-destructive operation
is part of this overlay.
