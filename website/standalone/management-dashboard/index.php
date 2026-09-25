<?php
declare(strict_types=1);
require 'C:/inetpub/wwwroot/App_Data/RadioTEDU/ecosystem_gateway.php';
rt_require_screen_auth('rt_management_dashboard', '/management/dashboard', 'Studio Management', 'en');
$nonce = base64_encode(random_bytes(18));
$displayMode = isset($_GET['display']) && $_GET['display'] === '1';
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-$nonce'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
header('Cache-Control: no-store, private');
?><!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>RadioTEDU Studio Management</title>
  <meta name="color-scheme" content="light dark">
  <link rel="stylesheet" href="dashboard-v2.css?v=20260925-1">
  <?php if ($displayMode): ?><link rel="stylesheet" href="display.css?v=20260923-1"><?php endif; ?>
</head>
<body<?= $displayMode ? ' class="display-mode"' : '' ?>>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="topbar">
    <a class="brand" href="/" aria-label="RadioTEDU home"><img class="logo-light" src="/wp-content/themes/radiotedu/assets/images/radiotedu-logo.png" alt="RadioTEDU"><img class="logo-dark" src="/wp-content/themes/radiotedu/assets/images/radiotedu-logo-white.png" alt="" aria-hidden="true"></a>
    <span class="header-label">Studio management <span>TED University</span></span>
    <div class="header-actions"><button id="theme-toggle" type="button" aria-pressed="false">Dark mode</button><button id="fullscreen-toggle" type="button">Full screen</button><div class="clock"><time id="clock">--:--</time><span id="date">Istanbul time</span></div></div>
  </header>
  <main id="main" class="dashboard">
    <section class="page-heading" aria-labelledby="page-title"><div><p class="eyebrow">RadioTEDU / Operations</p><h1 id="page-title">Today in the studio</h1><p>Room availability, attendance and today’s schedule.</p></div><div class="booking-access"><div><a class="primary-button" href="/erp/room/reservation">Book a studio</a><p>Scan to open studio reservations</p></div><a class="reservation-qr" href="/erp/room/reservation" aria-label="Open studio reservations"><img src="assets/reservation-qr.svg" width="112" height="112" alt="QR code linking to the studio reservation system"></a></div></section>
    <div class="connection-bar"><p id="connection-status" role="status" aria-live="polite">Connecting to ERP…</p><button id="refresh-button" type="button">Refresh</button></div>
    <div class="workspace">
      <section class="studio-panel" aria-labelledby="studio-title">
        <div class="panel-heading"><div><p class="eyebrow">Studio overview</p><h2 id="studio-title">Studio layout</h2></div><div class="view-switch" role="group" aria-label="Layout view"><button type="button" data-view="live" aria-pressed="true">3D model</button><button type="button" data-view="render" aria-pressed="false">Reference image</button></div></div>
        <div class="room-cards" role="group" aria-label="Select a room">
          <button type="button" class="room-card" data-room="main" data-studio-id="2" aria-pressed="false"><span class="room-index">01</span><span class="room-copy"><b>Main Studio</b><small>Waiting for ERP</small></span><span class="status unknown">Loading</span></button>
          <button type="button" class="room-card" data-room="recording" data-studio-id="1" aria-pressed="false"><span class="room-index">02</span><span class="room-copy"><b>Recording</b><small>Waiting for ERP</small></span><span class="status unknown">Loading</span></button>
          <button type="button" class="room-card" data-room="welcome" aria-pressed="false"><span class="room-index">03</span><span class="room-copy"><b>Welcome Area</b><small>Shared workspace</small></span><span class="status neutral">Shared space</span></button>
        </div>
        <p class="room-note">Booking availability only; not live occupancy or broadcast status.</p>
        <div class="scene-wrap live-view"><img id="studioRender" src="assets/studio-render-v4.png" alt="An illustrative studio render, not a photograph of the actual space." hidden><div id="studioCanvas" role="img" aria-label="Approximate three-dimensional studio layout" aria-describedby="model-note"></div><p id="viewer-status" role="status">Loading the 3D studio…</p><div class="scene-legend" aria-hidden="true"><span>01 Main studio</span><span>02 Recording</span><span>03 Welcome</span></div></div>
        <div class="viewer-toolbar"><p id="view-hint">Drag to rotate. Use the controls to zoom.</p><div role="group" aria-label="3D camera controls"><button type="button" data-camera="left" aria-label="Rotate left">Left</button><button type="button" data-camera="right" aria-label="Rotate right">Right</button><button type="button" data-camera="in" aria-label="Zoom in">+</button><button type="button" data-camera="out" aria-label="Zoom out">−</button><button type="button" data-camera="reset">Reset</button></div></div>
        <p id="model-note" class="model-note">Illustrative, unscaled model · Red tint marks a current approved booking. Studio video, 31 August 2026.</p>
      </section>
      <aside class="operations-panel" aria-label="Daily operations">
        <section class="schedule" aria-labelledby="schedule-title"><div class="panel-heading"><div><p class="eyebrow" id="schedule-date">Daily schedule</p><h2 id="schedule-title">Today’s bookings</h2></div><span id="schedule-count" class="count-label">Loading</span></div><div id="next-booking" class="next-booking"><span>Next booking</span><strong>Loading the schedule…</strong></div><div class="schedule-filters" role="group" aria-label="Filter bookings by room"><button type="button" data-filter="all" aria-pressed="true">All</button><button type="button" data-filter="2" aria-pressed="false">Main studio</button><button type="button" data-filter="1" aria-pressed="false">Recording</button></div><div id="schedule-list" aria-busy="true"><p class="empty-state">Loading bookings from ERP…</p></div><nav id="schedule-pagination" class="pagination" aria-label="Booking pages"></nav></section>
        <section class="inside-card" aria-labelledby="inside-title"><div class="panel-heading"><div><p class="eyebrow">Staff attendance</p><h2 id="inside-title">Currently inside</h2></div><span id="inside-badge" class="count-label">Loading</span></div><div id="inside-list" class="inside-list" aria-busy="true"><p class="empty-state">Loading attendance…</p></div><nav id="people-pagination" class="pagination" aria-label="Attendance pages"></nav><div class="check-in"><div id="staff-qr" class="qr-placeholder" aria-label="ERP staff attendance QR code">Waiting for QR</div><div><h3>Staff check-in</h3><p>Scan with a phone signed in to ERP.</p><small id="qr-status">Loading the check-in code…</small></div></div></section>
      </aside>
    </div>
    <footer class="page-footer"><span>RadioTEDU <span aria-hidden="true">/</span> Studio management</span><span>ERP connection · Refreshes every 30 seconds</span></footer>
    <noscript><p class="empty-state">Enable JavaScript for live room and schedule information. Studio reservations remain available through ERP.</p></noscript>
  </main>
  <script type="importmap" nonce="<?= htmlspecialchars($nonce, ENT_QUOTES, 'UTF-8') ?>">{"imports":{"three":"./node_modules/three/build/three.module.js"}}</script>
  <script src="dashboard-v2.js?v=20260925-1" defer></script>
</body></html>
