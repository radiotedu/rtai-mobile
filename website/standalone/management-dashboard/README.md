# RadioTEDU entrance dashboard overlay

This directory contains the source-controlled files deployed over the existing
`C:\inetpub\wwwroot\management\dashboard` installation.

The entrance screen is intentionally read-only. `api.php` accepts only `GET`
and reads the current studio status from ERP. Appointment applications are made
through the stable ERP page:

`https://radiotedu.com/erp/room/reservation`

The existing `app.js`, `styles.css`, Three.js dependency, and studio render
asset remain deployment prerequisites and are not duplicated by this overlay.
