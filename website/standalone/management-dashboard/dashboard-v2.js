(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const displayMode = document.body.classList.contains('display-mode');
  const timeFormat = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit'});
  const dateFormat = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', weekday: 'short'});
  const dayFormat = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'});
  const timestamp = value => typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
  const fmtTime = value => Number.isFinite(timestamp(value)) ? timeFormat.format(new Date(value)) : 'Time unavailable';
  const text = value => typeof value === 'string' ? value : '';
  const roomId = item => String(item.studio?.id ?? item.studio_id ?? '');
  const roomName = item => ({'1':'Recording Studio','2':'Main Studio'}[roomId(item)] || (typeof item.studio === 'string' ? item.studio : text(item.studio?.name) || text(item.studio_name) || 'Studio'));
  let lastData = null, lastSuccess = 0, connected = false, inFlight = false, filter = 'all';
  let schedulePage = 0, peoplePage = 0;
  let model = null, modelPromise = null, currentView = 'live', selectedRoom = null;
  let activeRoomNames = [];

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function empty(target, title, detail) {
    const p = element('p', 'empty-state');
    p.append(element('strong', '', title), document.createTextNode(detail));
    target.replaceChildren(p);
  }

  function pageItems(items, list, pagerId, page, onChange) {
    const size = Math.max(1, Math.floor(list.clientHeight / (list.id === 'inside-list' ? 42 : 48)));
    const pages = Math.max(1, Math.ceil(items.length / size));
    page = Math.min(page, pages - 1);
    const pager = document.getElementById(pagerId);
    const previous = element('button', '', 'Previous');
    const next = element('button', '', 'Next');
    previous.type = next.type = 'button';
    previous.disabled = page === 0; next.disabled = page >= pages - 1;
    previous.addEventListener('click', () => onChange(page - 1));
    next.addEventListener('click', () => onChange(page + 1));
    const label = element('span', '', items.length ? `${page * size + 1}–${Math.min((page + 1) * size, items.length)} of ${items.length}` : 'No entries');
    label.setAttribute('aria-live', 'polite');
    pager.replaceChildren(previous, label, next);
    return [items.slice(page * size, (page + 1) * size), page];
  }

  function todayReservations() {
    const today = dayFormat.format(new Date());
    return (lastData?.reservations || []).filter(item => {
      const start = timestamp(item.starts_at), end = timestamp(item.ends_at);
      return Number.isFinite(start) && Number.isFinite(end) && end > start
        && (dayFormat.format(new Date(start)) === today || (start <= Date.now() && end > Date.now()))
        && !['cancelled', 'canceled', 'rejected'].includes(item.status);
    }).sort((a, b) => timestamp(a.starts_at) - timestamp(b.starts_at));
  }
  function renderSchedule(reservations) {
    const now = Date.now();
    $('#schedule-count').textContent = `${reservations.length} bookings`;
    const next = reservations.find(item => item.status === 'approved' && timestamp(item.ends_at) > now);
    const nextBox = $('#next-booking');
    nextBox.replaceChildren(element('span', '', connected ? (next && timestamp(next.starts_at) <= now ? 'In progress' : 'Next approved booking') : 'Last known schedule'));
    nextBox.append(element('strong', '', next ? `${fmtTime(next.starts_at)} · ${roomName(next)}` : 'No more approved bookings today'));
    if (next) nextBox.append(element('small', '', `${fmtTime(next.starts_at)} - ${fmtTime(next.ends_at)}`));
    const list = $('#schedule-list');
    const shown = reservations.filter(item => filter === 'all' || roomId(item) === filter);
    list.replaceChildren();
    list.setAttribute('aria-busy', 'false');
    if (!shown.length) {
      empty(list, filter === 'all' ? 'No bookings today.' : 'No bookings for this room.', 'New ERP bookings appear here.');
    }
    let visible;
    [visible, schedulePage] = pageItems(shown, list, 'schedule-pagination', schedulePage, page => {schedulePage = page; renderSchedule(todayReservations());});
    visible.forEach(item => {
      const past = timestamp(item.ends_at) <= now;
      const active = item.status === 'approved' && timestamp(item.starts_at) <= now && !past;
      const row = element('article', `booking${past ? ' is-past' : ''}`);
      const time = element('time', '', fmtTime(item.starts_at));
      time.dateTime = item.starts_at;
      time.append(element('small', '', fmtTime(item.ends_at)));
      const body = element('div', 'booking-body');
      const info = element('div');
      const count = Number(item.attendee_count);
      info.append(element('b', '', roomName(item)), element('small', '', Number.isInteger(count) && count >= 0 ? `${count} attendees` : 'Attendance unavailable'));
      const label = item.status === 'approved' ? (past ? 'Completed' : active ? 'In progress' : 'Approved') : 'Pending';
      body.append(info, element('span', `status ${active ? 'busy' : item.status === 'approved' ? 'free' : 'unknown'}`, label));
      row.append(time, body); list.append(row);
    });
  }
  function renderRooms(reservations) {
    const now = Date.now();
    const activeNames = [];
    document.querySelectorAll('[data-studio-id]').forEach(card => {
      const items = reservations.filter(item => roomId(item) === card.dataset.studioId && item.status === 'approved');
      const active = items.find(item => timestamp(item.starts_at) <= now && timestamp(item.ends_at) > now);
      const next = items.find(item => timestamp(item.starts_at) > now);
      if (connected && active) activeNames.push(card.dataset.room);
      const status = card.querySelector('.status');
      status.className = `status ${!connected ? 'unknown' : active ? 'busy' : 'free'}`;
      status.textContent = !connected ? 'Unknown' : active ? 'Booked' : 'Available';
      card.querySelector('small').textContent = !connected ? 'ERP updates unavailable' : active ? `${fmtTime(active.starts_at)} - ${fmtTime(active.ends_at)}` : next ? `Next booking ${fmtTime(next.starts_at)}` : 'No more approved bookings today';
    });
    activeRoomNames = activeNames;
    model?.setActiveRooms(activeRoomNames);
  }
  function renderPeople() {
    if (displayMode) return; // The entrance screen must not expose staff identity or attendance QR codes.
    const people = lastData.people_inside;
    $('#inside-badge').textContent = `${people.length} people${connected ? '' : ' · last known'}`;
    const list = $('#inside-list');
    list.replaceChildren(); list.setAttribute('aria-busy', 'false');
    if (!people.length) empty(list, 'No active check-ins.', 'Use the staff QR code to check in.');
    let visible;
    [visible, peoplePage] = pageItems(people, list, 'people-pagination', peoplePage, page => {peoplePage = page; renderPeople();});
    visible.forEach(person => {
      const row = element('article');
      const name = text(person.name) || 'RadioTEDU member';
      const time = element('time', '', fmtTime(person.checked_in_at));
      if (Number.isFinite(timestamp(person.checked_in_at))) time.dateTime = person.checked_in_at;
      row.append(element('span', 'person-initial', name.charAt(0).toLocaleUpperCase('en-GB')), element('strong', '', name), time);
      list.append(row);
    });
  }
  function updateQr() {
    if (displayMode) return;
    const qr = lastData?.room_qr;
    const target = $('#staff-qr');
    const expires = timestamp(qr?.expires_at);
    const valid = connected && typeof qr?.qr_svg === 'string' && Number.isFinite(expires) && expires > Date.now();
    if (!valid) {
      target.replaceChildren(document.createTextNode('Waiting for QR'));
      delete target.dataset.expires;
      $('#qr-status').textContent = !connected ? 'The code refreshes after reconnection.' : 'The code expired or is unavailable.';
      return;
    }
    if (target.dataset.expires !== String(expires)) {
      // SVG is an image, never executable markup inserted into the page.
      const img = document.createElement('img');
      img.alt = 'ERP staff attendance QR code';
      img.width = img.height = 84;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.qr_svg)}`;
      img.addEventListener('error', () => {target.textContent = 'QR unavailable';delete target.dataset.expires;$('#qr-status').textContent = 'Select Refresh to load the code.';});
      target.replaceChildren(img); target.dataset.expires = String(expires);
    }
    $('#qr-status').textContent = `Valid until: ${fmtTime(qr.expires_at)} · Refreshes automatically`;
  }
  function render() {
    if (!lastData) return;
    const reservations = todayReservations();
    renderRooms(reservations); renderSchedule(reservations); renderPeople(); updateQr();
  }
  function showConnectionError() {
    connected = false;
    $('.connection-bar').dataset.state = 'error';
    $('#connection-status').textContent = lastSuccess
      ? `ERP disconnected. Last update: ${timeFormat.format(new Date(lastSuccess))}. Availability cannot be confirmed.`
      : 'ERP is unavailable. Check your session and select Refresh.';
    if (lastData) render();
    else {
      renderRooms([]); updateQr();
      $('#next-booking strong').textContent = 'Schedule currently unavailable';
      $('#schedule-count').textContent = 'Offline';
      $('#inside-badge').textContent = 'Unknown';
      for (const id of ['schedule-list', 'inside-list']) {const el=$(`#${id}`);el.setAttribute('aria-busy','false');empty(el, 'Information unavailable.', 'Updates resume after reconnection.');}
    }
  }
  async function refresh() {
    if (inFlight || document.hidden) return;
    inFlight = true; $('#refresh-button').disabled = true; $('#refresh-button').textContent = 'Refreshing';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch('api.php', {cache: 'no-store', credentials: 'same-origin', headers: {Accept: 'application/json'}, signal: controller.signal});
      if (!response.ok) throw new Error('unavailable');
      const payload = await response.json(), data = payload?.data;
      if (!data || !Array.isArray(data.people_inside) || !Array.isArray(data.reservations)) throw new Error('invalid_payload');
      if ([...data.people_inside, ...data.reservations].some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error('invalid_record');
      const generated = timestamp(data.generated_at);
      if (!Number.isFinite(generated) || Date.now() - generated > 120000 || generated - Date.now() > 120000) throw new Error('stale_payload');
      lastData = data; lastSuccess = Date.now(); connected = true;
      $('.connection-bar').dataset.state = 'ready';
      $('#connection-status').textContent = `ERP connected · Last update ${timeFormat.format(new Date(lastSuccess))}`;
      render();
    } catch {showConnectionError();}
    finally {clearTimeout(timeout);inFlight=false;$('#refresh-button').disabled=false;$('#refresh-button').textContent='Refresh';}
  }
  $('#refresh-button').addEventListener('click', refresh);
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    filter=button.dataset.filter; schedulePage=0;
    document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item===button)));
    if (lastData) renderSchedule(todayReservations());
  }));

  function setTheme(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('#theme-toggle').setAttribute('aria-pressed', String(dark));
    $('#theme-toggle').textContent = dark ? 'Light mode' : 'Dark mode';
    model?.setTheme(dark);
  }
  try {setTheme(localStorage.getItem('rt-studio-theme')==='dark');} catch {setTheme(false);}
  $('#theme-toggle').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark'; setTheme(dark);
    try {localStorage.setItem('rt-studio-theme', dark ? 'dark' : 'light');} catch { /* Preference storage is optional. */ }
  });
  $('#fullscreen-toggle').hidden = !document.fullscreenEnabled;
  $('#fullscreen-toggle').addEventListener('click', async () => {
    try {if(document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen();}
    catch {$('#fullscreen-toggle').textContent='Full screen unavailable';}
  });
  document.addEventListener('fullscreenchange', () => {$('#fullscreen-toggle').textContent=document.fullscreenElement?'Exit full screen':'Full screen';});

  async function setView(view) {
    currentView=view;
    const live=view==='live';
    $('#studioRender').hidden=live;$('#studioCanvas').hidden=!live;
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    document.querySelectorAll('[data-camera]').forEach(b=>b.disabled=!live || !model);
    $('#view-hint').textContent=live?'Drag or use the camera controls.':'Illustrative render, not a photo or measured plan.';
    $('#viewer-status').hidden=!live || !!model;
    if (!live) {model?.setVisible(false);return;}
    try {
      if(!modelPromise) modelPromise=import('./app.js?v=20260925-1').then(m=>m.initStudio());
      model=await modelPromise;
      model.setTheme(document.documentElement.dataset.theme==='dark');
      model.setActiveRooms(activeRoomNames);
      model.setVisible(currentView==='live' && !document.hidden);
      if(selectedRoom)model.selectRoom(selectedRoom);
      $('#viewer-status').hidden=true;
      document.querySelectorAll('[data-camera]').forEach(b=>b.disabled=currentView!=='live');
    } catch {
      modelPromise=null;
      $('#viewer-status').hidden=currentView!=='live';
      $('#viewer-status').textContent='3D view unavailable. Use the reference image or refresh.';
    }
  }
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
  document.querySelectorAll('[data-camera]').forEach(button=>button.addEventListener('click',()=>model?.moveCamera(button.dataset.camera)));
  document.querySelectorAll('[data-room]').forEach(button=>button.addEventListener('click',()=>{
    selectedRoom=button.dataset.room;
    document.querySelectorAll('[data-room]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    model?.selectRoom(selectedRoom);
    if(currentView!=='live')setView('live');
  }));
  $('#studioCanvas').addEventListener('webglcontextlost', event=>{
    event.preventDefault();model?.setVisible(false);$('#viewer-status').hidden=false;
    $('#viewer-status').textContent='3D view disconnected. Use the reference image or refresh.';
    document.querySelectorAll('[data-camera]').forEach(b=>b.disabled=true);
  },true);
  function tick() {
    const now = new Date();$('#clock').textContent=timeFormat.format(now);$('#date').textContent=dateFormat.format(now);
    $('#schedule-date').textContent=dateFormat.format(now);
    if(connected && Date.now()-lastSuccess>90000)showConnectionError();
    if(lastData?.room_qr && timestamp(lastData.room_qr.expires_at)<=Date.now())updateQr();
  }
  let layoutSize = '';
  const resize = new ResizeObserver(() => {
    const size = ['schedule-list', 'inside-list'].map(id => {const el=document.getElementById(id);return el.clientWidth+'x'+el.clientHeight;}).join('/');
    if(size !== layoutSize) {layoutSize=size; if(lastData) requestAnimationFrame(render);}
  });
  resize.observe($('#schedule-list')); resize.observe($('#inside-list'));
  tick();setInterval(tick,1000);refresh();setView(displayMode ? 'render' : 'live');
  if (displayMode) {
    document.querySelectorAll('a, button').forEach(node => { node.tabIndex = -1; });
    setInterval(() => {
      if (!document.hidden && lastData) {
        const count = todayReservations().length;
        const pageSize = Math.max(1, Math.floor($('#schedule-list').clientHeight / 48));
        if (count > pageSize) {
          schedulePage = (schedulePage + 1) % Math.ceil(count / pageSize);
          renderSchedule(todayReservations());
        }
      }
    }, 12000);
  }
  setInterval(()=>{if(!document.hidden){render();refresh();}},30000);
  document.addEventListener('visibilitychange',()=>{model?.setVisible(!document.hidden&&currentView==='live');if(!document.hidden){tick();refresh();}});
})();
