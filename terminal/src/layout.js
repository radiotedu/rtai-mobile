const {version} = require('../package.json');

const RESET = '\x1b[0m';
const palette = {brand: '\x1b[1;38;2;244;93;108m', text: '\x1b[38;2;237;233;225m', muted: '\x1b[38;2;145;153;169m', selected: '\x1b[48;2;56;34;43m\x1b[1;38;2;255;210;213m'};
const segments = new Intl.Segmenter('en', {granularity: 'grapheme'});

// Network metadata and account labels must never inject terminal control sequences.
function clean(value) {
  return String(value ?? '').replace(/\x1b(?:\][^\x07]*(?:\x07|$)|\[[0-?]*[ -/]*[@-~])/g, '')
    .replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, ' ');
}
function cellWidth(segment) {
  if (/^\p{Mark}+$/u.test(segment)) return 0;
  return /[\p{Extended_Pictographic}\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe6f\uff01-\uff60\uffe0-\uffe6\u{1f1e6}-\u{1f1ff}]/u.test(segment) ? 2 : 1;
}
function width(value) {
  return [...segments.segment(clean(value))].reduce((sum, item) => sum + cellWidth(item.segment), 0);
}
function fit(value, columns) {
  let result = ''; let used = 0;
  for (const {segment} of segments.segment(clean(value))) {
    const cells = cellWidth(segment);
    if (used + cells > columns) break;
    result += segment; used += cells;
  }
  return result + ' '.repeat(Math.max(0, columns - used));
}

function buildFrame(state, {columns = 100, rows = 30} = {}) {
  const cols = Math.max(1, columns - 1);
  const height = Math.max(1, rows - 1);
  const lines = []; const hits = [];
  const add = (text = '', tone = 'text', action) => {
    if (lines.length >= height) return;
    lines.push('\x1b[48;2;18;20;26m' + (palette[tone] || palette.text) + fit(text, cols) + RESET);
    if (action) hits.push({x: 1, endX: Math.min(cols, width(text)), y: lines.length, ...action});
  };
  const buttons = items => {
    let line = ''; let actions = [];
    const flush = () => {
      const y = lines.length + 1;
      add(line, 'muted');
      if (y <= height) hits.push(...actions.map(item => ({...item, y})));
      line = ''; actions = [];
    };
    for (const [label, key] of items) {
      if (line && width(line + label) > cols) flush();
      const x = width(line) + 1;
      line += label + '  ';
      actions.push({x, endX: Math.min(cols, x + width(label) - 1), key});
    }
    if (line) flush();
  };
  add(` RadioTEDU / TERMINAL  ${version}`, 'brand');
  buttons([['1 Stations', '1'], ['2 Audio', '2'], ['3 Focus', '3'], ['4 Account', '4']]);
  add('─'.repeat(cols), 'muted');
  const modal = state.modal;
  if (modal) {
    add(' SIGN IN / CONNECTION', 'brand');
    if (modal.type === 'choice') {
      buttons([['[1] Open browser sign-in', '1'], ['[2] Email and password', '2'], ['[3] TEDU / ERP code', '3']]);
    } else if (modal.type === 'creds') {
      add(`${modal.field === 'email' ? '>' : ' '} Email: ${modal.email || ''}`);
      add(`${modal.field === 'password' ? '>' : ' '} Password: ${'*'.repeat(Math.min(40, modal.password?.length || 0))}`);
      buttons([['[Tab] Switch field', 'tab'], ['[Enter] Sign in', 'enter']]);
    } else if (modal.type === 'device_poll') {
      add(modal.url || 'https://radiotedu.com/device');
      add(` Approval code: ${modal.userCode || 'Waiting...'}`, 'brand');
      buttons([['[O] Open browser', 'o']]);
    } else if (modal.type === 'pair') {
      add(' radiotedu.com/erp/device');
      add(` Code: ${modal.code || ''}`, 'brand');
      buttons([['[Enter] Connect', 'enter']]);
    } else if (modal.type === 'audio_engine_missing') {
      add(' Install an audio engine to listen.');
      buttons([['[1] Download portable ffplay', '1'], ['[2] Install with winget', '2']]);
    }
    add(modal.status || '', 'muted');
    buttons([['[Esc] Cancel', 'escape']]);
  } else {
    const tab = state.activeTab || 1;
    const playing = state.active && !state.paused;
    const name = state.active?.name || 'Choose a station';
    const detail = [playing ? 'Player active' : state.paused ? 'Paused' : 'Ready', state.active ? state.codec : '', state.active ? state.quality : ''].filter(Boolean).join(' / ');
    if (tab === 1) {
      add(` STATIONS / ${state.stations.length} channels`, 'brand');
      const capacity = Math.max(1, height - lines.length - 7);
      const first = Math.max(0, Math.min(state.selected - capacity + 1, state.stations.length - capacity));
      for (let i = first; i < Math.min(state.stations.length, first + capacity); i++) {
        const station = state.stations[i];
        const selected = i === state.selected;
        const label = ` ${selected ? '›' : ' '} ${station.name}${state.active?.id === station.id ? '  / active' : ''}`;
        add(cols >= 82 ? fit(label, 37) + clean(station.description) : label, selected ? 'selected' : 'text', {station: i});
      }
    } else if (tab === 2) {
      add(' AUDIO / OUTPUT', 'brand');
      add(` Engine    ${state.playerName || 'Not installed'}`);
      add(` Format    ${state.active ? `${state.codec} / ${state.quality}` : 'No active stream'}`);
      add(` Volume    ${state.volume ?? 80}%`);
      add(' Playback status reflects the player process.', 'muted');
      add(' Signal strength and spectrum are not measured.', 'muted');
      buttons([['[F] Change quality', 'f'], ['[M] Mute / restore', 'm']]);
    } else if (tab === 3) {
      const pomo = state.pomodoro || {};
      const seconds = pomo.secondsLeft || 0;
      add(' FOCUS / YOUR SESSION', 'brand');
      add(` ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}   ${pomo.phase || 'focus'} / ${pomo.running ? 'running' : 'paused'}`, 'brand');
      add(` Preset ${pomo.preset || '25/5'}   Completed ${pomo.completedFocus || 0}`);
      buttons([['[S] Start / pause', 's'], ['[P] Preset', 'p'], ['[B] Phase', 'b'], ['[R] Reset', 'r']]);
    } else {
      add(' ACCOUNT / RADIOTEDU', 'brand');
      add(` ${state.account?.label || 'Guest'}`);
      add(Number.isInteger(state.account?.gold) ? ` ${state.account.gold} Gold / last account refresh` : ' Sign in to view your account and Gold.');
      buttons(state.account?.label && state.account.label !== 'Guest' ? [['[A] Refresh', 'a'], ['[X] Sign out', 'x']] : [['[L] Sign in', 'l']]);
    }
    const footerRows = cols >= 74 ? 6 : 7;
    while (lines.length < height - footerRows) add();
    add('─'.repeat(cols), 'muted');
    add(` ${name}`, 'brand');
    add(` ${state.metadata || detail}`);
    add(` ${state.status || `${detail} / Volume ${state.volume ?? 80}%`}`, 'muted');
    buttons([['[Space] Play/pause', 'space'], ['[F] Quality', 'f'], ['[+] Louder', '+'], ['[-] Quieter', '-'], ['[Q] Quit', 'q']]);
  }
  while (lines.length < height) add();
  return {lines, hits, columns: cols, rows: height};
}

function mouseAction(frame, event) {
  if (event.button !== 0 || !event.release) return null;
  return frame.hits.find(hit => hit.y === event.y && event.x >= hit.x && event.x <= hit.endX) || null;
}

module.exports = {buildFrame, mouseAction, clean, width, fit};
