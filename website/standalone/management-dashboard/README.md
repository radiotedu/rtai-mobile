# RadioTEDU studio management dashboard

This directory contains the active dashboard source deployed to
`C:\inetpub\wwwroot\management\dashboard`.

`api.php` is the dashboard's read-only ERP bridge. `dashboard-v2.js` requests
the current schedule every 30 seconds and shows pending requests in the list;
only an approved reservation currently in progress marks a studio as busy.
Room reservations continue to be submitted through
`https://radiotedu.com/erp/room/reservation`.

`dashboard-v2.css` fits tablet portrait and landscape viewports and enlarges
controls for touch input. `app.js` renders the illustrative 3D studio layout
and applies a light red floor tint to rooms with a current approved booking.
The local Three.js package and the existing reservation QR and studio render
assets remain deployment prerequisites. The original `styles.css`,
`dashboard.js`, and `ecosystem.css` are retained for the earlier layout and
are not loaded by the active dashboard page.
