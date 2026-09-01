<?php
declare(strict_types=1);
require 'C:/inetpub/wwwroot/App_Data/RadioTEDU/ecosystem_gateway.php';
rt_require_screen_auth('rt_management_dashboard', '/management/dashboard', 'Stüdyo Yönetim Ekranı');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
header('Cache-Control: no-store, private');
?><!doctype html>
<html lang="tr">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>RadioTEDU Stüdyo Yönetimi</title>
  <link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="ecosystem.css">
</head>
<body>
  <main class="dashboard">
    <section class="visual-panel">
      <header class="topbar"><div class="brand-mark"><span class="signal"><i></i><i></i><i></i></span><strong>RADIO<span>TEDU</span></strong></div><div class="location"><span></span>B BLOK · 1. KAT</div><div class="clock"><b id="clock">--:--</b><span id="date">---</span></div><img class="topbar-logo" src="/wp-content/themes/radiotedu/assets/images/radiotedu-logo.png" alt="RadioTEDU"></header>
      <div class="scene-copy"><p>STÜDYO DURUMU</p><h1>Yayın alanı<br><em>tek ekranda.</em></h1><div class="live-pill"><span></span><b id="inside-count">0</b> PERSONEL İÇERİDE</div></div>
      <div class="scene-wrap"><img id="studioRender" src="assets/studio-render-v4.png" alt="RadioTEDU stüdyoları yerleşim görünümü"><div id="studioCanvas" aria-label="Etkileşimli 3B stüdyo planı"></div><div class="view-switch"><button class="active" data-view="render">FOTOĞRAF</button><button data-view="live">CANLI 3B</button></div><div class="canvas-label label-main"><b>ANA STÜDYO</b><span id="main-label">UYGUN</span></div><div class="canvas-label label-recording"><b>KAYIT STÜDYOSU</b><span id="recording-label">UYGUN</span></div><div class="canvas-label label-welcome"><b>KARŞILAMA</b><span>TOPLANTI ALANI</span></div><div class="orbit-hint">FOTOĞRAF GÖRÜNÜMÜ <span>●</span></div></div>
      <div class="room-cards">
        <button class="room-card active" data-room="main" data-studio-id="2"><span class="room-index">01</span><span><b>Ana Stüdyo</b><small>Bugün kayıt yok</small></span><i class="status free">UYGUN</i></button>
        <button class="room-card" data-room="recording" data-studio-id="1"><span class="room-index">02</span><span><b>Kayıt Stüdyosu</b><small>Bugün kayıt yok</small></span><i class="status free">UYGUN</i></button>
        <button class="room-card" data-room="welcome"><span class="room-index">03</span><span><b>Karşılama Alanı</b><small>Ortak çalışma alanı</small></span><i class="status free">AÇIK</i></button>
      </div>
    </section>
    <aside class="info-panel">
      <div class="info-glow"></div><div class="studio-title"><small>TED ÜNİVERSİTESİ · ANKARA</small><h2>RadioTEDU<br><span>Stüdyoları</span></h2><p>KAMPÜSÜN SESİ</p></div>
      <section class="inside-card"><div class="section-title"><h3>Şu anda içeride</h3><span id="inside-badge">0 KİŞİ</span></div><div class="inside-layout"><div id="inside-list" class="inside-list"><p class="muted">İçeride kayıt yok.</p></div><div class="mini-qr"><div id="staff-qr" aria-label="ERP oda katılım QR kodu"></div><small>PERSONEL KATILIMI</small></div></div></section>
      <section class="schedule"><div class="section-title"><h3>Bugünün programı</h3><span id="schedule-date">—</span></div><div id="schedule-list"><p class="muted">Bugün için randevu bulunmuyor.</p></div></section>
      <section class="reservation-link" aria-labelledby="reservation-title">
        <span class="reservation-eyebrow">ERP RANDEVU SİSTEMİ</span>
        <h3 id="reservation-title">Stüdyo randevusu</h3>
        <p>Başvurunuzu telefonunuzdan veya kişisel bilgisayarınızdan ERP’de tamamlayın.</p>
        <a href="https://radiotedu.com/erp/room/reservation">radiotedu.com/erp/room/reservation <span aria-hidden="true">↗</span></a>
        <small>Yeni kayıtlar bu ekranda otomatik görünür.</small>
      </section>
    </aside>
  </main>
  <script type="importmap">{"imports":{"three":"./node_modules/three/build/three.module.js"}}</script>
  <script type="module" src="app.js"></script><script src="dashboard.js" defer></script>
</body></html>
