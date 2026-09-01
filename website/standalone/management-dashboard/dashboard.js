(() => {
  const $ = selector => document.querySelector(selector);
  const fmtTime = value => new Intl.DateTimeFormat('tr-TR', {hour: '2-digit', minute: '2-digit'}).format(new Date(value));
  const escapeText = value => String(value ?? '');
  let requestInFlight = false;

  function render(data) {
    const people = Array.isArray(data?.people_inside) ? data.people_inside : [];
    const reservations = Array.isArray(data?.reservations)
      ? [...data.reservations].sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at))
      : [];

    $('#inside-count').textContent = people.length;
    $('#inside-badge').textContent = `${people.length} KİŞİ`;
    const inside = $('#inside-list');
    inside.replaceChildren();
    if (!people.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'İçeride kayıt yok.';
      inside.append(empty);
    }
    people.forEach(person => {
      const row = document.createElement('article');
      const avatar = document.createElement('span');
      avatar.textContent = escapeText(person.name).charAt(0).toUpperCase();
      const name = document.createElement('strong');
      name.textContent = escapeText(person.name) || 'RadioTEDU üyesi';
      const time = document.createElement('small');
      time.textContent = fmtTime(person.checked_in_at);
      row.append(avatar, name, time);
      inside.append(row);
    });

    if (typeof data?.room_qr?.qr_svg === 'string' && data.room_qr.qr_svg) {
      $('#staff-qr').innerHTML = data.room_qr.qr_svg;
    }

    const now = Date.now();
    document.querySelectorAll('[data-studio-id]').forEach(card => {
      const id = Number(card.dataset.studioId);
      const roomReservations = reservations.filter(item => Number(item.studio?.id || item.studio_id) === id);
      const current = roomReservations.find(item => new Date(item.starts_at).getTime() <= now && new Date(item.ends_at).getTime() > now);
      const upcoming = roomReservations.find(item => new Date(item.starts_at).getTime() > now);
      const status = card.querySelector('.status');
      const detail = card.querySelector('small');
      status.textContent = current ? 'DOLU' : 'UYGUN';
      status.className = `status ${current ? 'busy' : 'free'}`;
      detail.textContent = current
        ? `${fmtTime(current.starts_at)}—${fmtTime(current.ends_at)} · Rezerve`
        : upcoming
          ? `Sıradaki · ${fmtTime(upcoming.starts_at)}`
          : 'Bugün kayıt yok';
      const label = id === 2 ? $('#main-label') : $('#recording-label');
      label.textContent = current ? 'REZERVE' : 'UYGUN';
    });

    $('#schedule-date').textContent = new Date().toLocaleDateString('tr-TR', {day: '2-digit', month: 'short'}).toUpperCase();
    const schedule = $('#schedule-list');
    schedule.replaceChildren();
    if (!reservations.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Bugün için randevu bulunmuyor.';
      schedule.append(empty);
    }
    reservations.forEach(item => {
      const row = document.createElement('article');
      const time = document.createElement('time');
      time.textContent = fmtTime(item.starts_at);
      const body = document.createElement('div');
      const title = document.createElement('b');
      title.textContent = typeof item.studio === 'string'
        ? item.studio
        : item.studio?.name || item.studio_name || 'Stüdyo';
      const meta = document.createElement('small');
      meta.textContent = `${item.attendee_count} kişi · ${item.status === 'approved' ? 'Onaylı' : 'Onay bekliyor'}`;
      body.append(title, meta);
      const badge = document.createElement('span');
      badge.textContent = item.status === 'approved' ? 'ONAYLI' : 'BEKLİYOR';
      row.append(time, body, badge);
      schedule.append(row);
    });
  }

  async function refresh() {
    if (requestInFlight) return;
    requestInFlight = true;
    try {
      const response = await fetch('api.php', {cache: 'no-store', credentials: 'same-origin'});
      if (!response.ok) throw new Error('dashboard_unavailable');
      const payload = await response.json();
      if (!payload?.data) throw new Error('invalid_dashboard_payload');
      render(payload.data);
    } catch {
      // Keep the last confirmed ERP state visible. This entrance screen has no transient error/loading state.
    } finally {
      requestInFlight = false;
    }
  }

  refresh();
  setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
})();
