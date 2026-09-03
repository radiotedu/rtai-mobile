const readline = require('node:readline');

const ESC = '\x1b[';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  // Theme colors matching spotify-tui and RadioTEDU
  red: '\x1b[38;2;229;9;20m',          // RadioTEDU Signature Red
  brightRed: '\x1b[91;1m',
  spotifyGreen: '\x1b[38;2;30;215;96m', // Spotify Green
  green: '\x1b[32m',
  gold: '\x1b[38;2;229;160;0m',        // Classical & Gold
  yellow: '\x1b[38;2;241;196;15m',
  purple: '\x1b[38;2;156;39;176m',     // Jazz
  cyan: '\x1b[38;2;0;188;212m',        // Lo-Fi & Accents
  brightCyan: '\x1b[96;1m',
  orange: '\x1b[38;2;255;107;44m',     // Rock
  white: '\x1b[97m',
  gray: '\x1b[90m',
  lightGray: '\x1b[37m',
  bgActive: '\x1b[48;5;236m',          // Row selection background
  bgPanel: '\x1b[48;5;234m',
};

function stationColor(id) {
  switch (String(id || '').toLowerCase()) {
    case 'radio': return C.red;
    case 'classic': return C.gold;
    case 'cazz':
    case 'jazz': return C.purple;
    case 'lofi': return C.cyan;
    case 'energize': return C.yellow;
    case 'rock': return C.orange;
    default: return C.lightGray;
  }
}

function stripAnsi(str) {
  return String(str || '').replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

function padVisible(content, targetWidth) {
  const visibleLen = stripAnsi(content).length;
  const pad = Math.max(0, targetWidth - visibleLen);
  return content + ' '.repeat(pad);
}

function truncateVisible(str, maxLen) {
  const plain = stripAnsi(str);
  if (plain.length <= maxLen) return str;
  return plain.slice(0, Math.max(1, maxLen - 1)) + '…';
}

// Multi-row Audio Spectrum Visualizer generator
function generateSpectrum(tick, numBands, maxHeight) {
  const heights = [];
  for (let i = 0; i < numBands; i++) {
    const wave1 = Math.sin(tick * 0.35 + i * 0.45) * 0.45;
    const wave2 = Math.cos(tick * 0.22 - i * 0.32) * 0.35;
    const wave3 = Math.sin(tick * 0.6 + i * 0.8) * 0.2;
    const normalized = Math.max(0.05, Math.min(1.0, wave1 + wave2 + wave3 + 0.45));
    heights.push(Math.round(normalized * maxHeight));
  }
  const rows = [];
  for (let h = maxHeight; h >= 1; h--) {
    let row = '';
    for (let i = 0; i < numBands; i++) {
      const val = heights[i];
      let char = '  ';
      let col = C.spotifyGreen;
      if (h > Math.floor(maxHeight * 0.75)) col = C.brightRed;
      else if (h > Math.floor(maxHeight * 0.5)) col = C.yellow;
      else if (h > Math.floor(maxHeight * 0.25)) col = C.cyan;

      if (val >= h) {
        char = `${col}█ ${C.reset}`;
      } else if (val === h - 1 && val > 0) {
        char = `${col}▄ ${C.reset}`;
      }
      row += char;
    }
    rows.push(row);
  }
  return rows;
}

let vizTick = 0;
let streamSeconds = 0;

function draw(state) {
  const totalCols = Math.max(86, Math.min(120, (process.stdout.columns || 90) - 2));
  const lines = [];

  const accountLabel = state.account?.label || 'Guest';
  const isGuest = accountLabel === 'Guest';
  const goldText = Number.isInteger(state.account?.gold) ? `  ${C.gold}${C.bold}◆ ${state.account.gold} Gold${C.reset}` : '';
  const studyText = state.studyMinutes !== null ? `  ${C.cyan}⏱ Study ${Math.floor(state.studyMinutes)}m${C.reset}` : '';
  const activeTab = state.activeTab || 1;
  const volume = state.volume ?? 80;

  // 1. TOP HEADER - TABS & STATUS BAR (spotify-tui style)
  const tab1 = activeTab === 1 ? `${C.spotifyGreen}${C.bold}[1: Stations]${C.reset}` : `${C.gray}[1: Stations]${C.reset}`;
  const tab2 = activeTab === 2 ? `${C.spotifyGreen}${C.bold}[2: Visualizer]${C.reset}` : `${C.gray}[2: Visualizer]${C.reset}`;
  const tab3 = activeTab === 3 ? `${C.spotifyGreen}${C.bold}[3: Study & Lyrics]${C.reset}` : `${C.gray}[3: Study & Lyrics]${C.reset}`;
  const tab4 = activeTab === 4 ? `${C.spotifyGreen}${C.bold}[4: Account]${C.reset}` : `${C.gray}[4: Account]${C.reset}`;

  const tabsBar = ` ${tab1}  ${tab2}  ${tab3}  ${tab4}`;
  const userBar = isGuest
    ? `${C.gray}👤 Guest (Press 'L' to Sign In)${C.reset} `
    : `${C.spotifyGreen}👤 ${C.bold}${accountLabel}${C.reset}${goldText}${studyText} `;

  lines.push(`${C.red}┌─ ${C.white}${C.bold}radiotedu-tui${C.reset} ${C.dim}v1.3.5 (Spotify CLI style)${C.reset}${C.red}${'─'.repeat(Math.max(0, totalCols - 42))}┐${C.reset}`);
  const headerContent = ` ${tabsBar}${' '.repeat(Math.max(2, totalCols - stripAnsi(tabsBar).length - stripAnsi(userBar).length - 2))}${userBar}`;
  lines.push(`${C.red}│${C.reset}${padVisible(headerContent, totalCols)}${C.red}│${C.reset}`);
  lines.push(`${C.red}└${'─'.repeat(totalCols)}┘${C.reset}`);

  // 2. MAIN BODY PANELS
  const leftW = 40;
  const rightW = totalCols - leftW - 3;
  const numStations = state.stations.length;

  if (activeTab === 1) {
    // TAB 1: SIDE-BY-SIDE DASHBOARD (Left: Stations, Right: Spectrum Visualizer & Stream Details)
    const leftHeader = `┌─ Stations (${numStations}) ${'─'.repeat(Math.max(0, leftW - 17))}┐`;
    const rightHeader = `┌─ Live Audio Spectrum & Stream ${'─'.repeat(Math.max(0, rightW - 33))}┐`;
    lines.push(`${C.spotifyGreen}${leftHeader}${C.reset} ${C.cyan}${rightHeader}${C.reset}`);

    // Prepare Spectrum Visualizer rows (height 5)
    vizTick++;
    if (state.active && !state.paused) streamSeconds++;
    const isPlayingAudio = state.active && !state.paused;
    const spectrumBands = Math.max(10, Math.floor((rightW - 4) / 2));
    const spectrumRows = isPlayingAudio
      ? generateSpectrum(vizTick, spectrumBands, 5)
      : [
          `  ${C.gray}■ Playback paused or idle.${C.reset}`,
          `  ${C.gray}Select a station or press [Space] to stream.${C.reset}`,
          '',
          '',
          '',
        ];

    const maxRows = Math.max(numStations, 10);

    for (let r = 0; r < maxRows; r++) {
      // Left Pane Line: Station Row
      let leftContent = '';
      if (r < numStations) {
        const station = state.stations[r];
        const isSelected = r === state.selected;
        const isCurrentActive = state.active?.id === station.id;
        const isPlaying = isCurrentActive && !state.paused;
        const isPaused = isCurrentActive && state.paused;

        const cursor = isSelected ? `${C.spotifyGreen}${C.bold}›${C.reset}` : ' ';
        const playIcon = isPlaying ? `${C.spotifyGreen}▶${C.reset}` : isPaused ? `${C.yellow}⏸${C.reset}` : ' ';
        const dot = `${stationColor(station.id)}●${C.reset}`;
        const flac = station.qualities.includes('flac') ? `${C.gold}[FLAC]${C.reset}` : '';
        const namePart = isSelected
          ? `${C.bold}${C.white}${station.name.slice(0, 19).padEnd(19)}${C.reset}`
          : `${station.name.slice(0, 19).padEnd(19)}`;

        const rowStr = ` ${cursor} ${playIcon} ${dot} ${namePart} ${flac}`;
        leftContent = isSelected
          ? `${C.bgActive}${padVisible(rowStr, leftW)}${C.reset}`
          : padVisible(rowStr, leftW);
      } else {
        leftContent = ' '.repeat(leftW);
      }

      // Right Pane Line: Spectrum / Details
      let rightContent = '';
      if (r === 0) {
        const activeName = state.active?.name || 'RadioTEDU Flagship';
        const qualityTag = state.quality.toUpperCase();
        rightContent = `  ${C.bold}${C.white}${activeName}${C.reset}  ${C.gold}[${qualityTag} · ${state.codec}]${C.reset}`;
      } else if (r === 1) {
        const trackTitle = state.metadata || state.active?.description || 'Broadcasting from Ankara Studios';
        rightContent = `  ${C.cyan}♪ ${truncateVisible(trackTitle, rightW - 6)}${C.reset}`;
      } else if (r >= 2 && r <= 6) {
        // Spectrum visualizer rows
        rightContent = `  ${spectrumRows[r - 2] || ''}`;
      } else if (r === 7) {
        // Frequency axis
        rightContent = `  ${C.gray}60Hz  120Hz  250Hz  500Hz  1kHz  2kHz  4kHz  8kHz  16kHz${C.reset}`;
      } else if (r === 8) {
        const liveStatus = isPlayingAudio ? `${C.brightRed}● LIVE STREAM${C.reset}` : `${C.yellow}■ STANDBY${C.reset}`;
        const engine = `${C.gray}Engine: ${state.playerName || 'ffplay'}${C.reset}`;
        rightContent = `  ${liveStatus}  ${C.gray}·${C.reset}  ${engine}  ${C.gray}·${C.reset}  ${C.gray}Audio buffer: 100%${C.reset}`;
      } else if (r === 9) {
        rightContent = `  ${C.dim}${truncateVisible(state.status || 'Click station or use arrows + Enter.', rightW - 6)}${C.reset}`;
      } else {
        rightContent = ' '.repeat(rightW);
      }

      const leftBorder = state.focusedPanel === 'stations' ? C.spotifyGreen : C.gray;
      const rightBorder = state.focusedPanel === 'main' ? C.spotifyGreen : C.cyan;
      lines.push(`${leftBorder}│${C.reset}${leftContent}${leftBorder}│${C.reset} ${rightBorder}│${C.reset}${padVisible(rightContent, rightW)}${rightBorder}│${C.reset}`);
    }

    const leftFooter = `└${'─'.repeat(leftW)}┘`;
    const rightFooter = `└${'─'.repeat(rightW)}┘`;
    lines.push(`${C.spotifyGreen}${leftFooter}${C.reset} ${C.cyan}${rightFooter}${C.reset}`);

  } else if (activeTab === 2) {
    // TAB 2: FULL-WIDTH AUDIO VISUALIZER (Large 10-row spectrum)
    lines.push(`${C.spotifyGreen}┌─ Full-Screen Audio Spectrum Analyzer ${'─'.repeat(Math.max(0, totalCols - 40))}┐${C.reset}`);
    vizTick++;
    const fullBands = Math.floor((totalCols - 6) / 2);
    const fullSpectrum = (state.active && !state.paused)
      ? generateSpectrum(vizTick, fullBands, 9)
      : Array(9).fill(`  ${C.gray}■ Playback paused. Press [Space] to resume.${C.reset}`);

    for (let i = 0; i < 9; i++) {
      lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`  ${fullSpectrum[i]}`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    }
    const freqLabels = '  60Hz   120Hz   250Hz   500Hz    1kHz    2kHz    4kHz    8kHz   12kHz   16kHz   20kHz';
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`${C.gray}${freqLabels}${C.reset}`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}└${'─'.repeat(totalCols)}┘${C.reset}`);

  } else if (activeTab === 3) {
    // TAB 3: STUDY SESSION & LYRICS
    lines.push(`${C.spotifyGreen}┌─ Study Session & Live Lyrics ${'─'.repeat(Math.max(0, totalCols - 32))}┐${C.reset}`);
    const isStudying = state.studyMinutes !== null;
    const studyMins = isStudying ? Math.floor(state.studyMinutes) : 0;
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`  ${C.bold}Active Study Session:${C.reset} ${isStudying ? `${C.spotifyGreen}● ACTIVE (${studyMins} minutes elapsed)${C.reset}` : `${C.gray}No active timer (Press 'S' to start)${C.reset}`}`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`  Location: TEDÜ Library / Çim Alan  ·  Reward: +10 Gold per 25 min`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible('', totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`  ${C.bold}Live Lyrics / Song Info:${C.reset}`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    const track = state.metadata || state.active?.description || 'No lyrics available for current track';
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`  ${C.cyan}${track}${C.reset}`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`  ${C.dim}(Lyrics auto-load on Wi-Fi connection; station audio uninterrupted)${C.reset}`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    for (let k = 0; k < 4; k++) lines.push(`${C.spotifyGreen}│${C.reset}${padVisible('', totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}└${'─'.repeat(totalCols)}┘${C.reset}`);

  } else if (activeTab === 4) {
    // TAB 4: ACCOUNT & GOLD LEDGER
    lines.push(`${C.spotifyGreen}┌─ RadioTEDU Account & Gold Ledger ${'─'.repeat(Math.max(0, totalCols - 36))}┐${C.reset}`);
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`  ${C.bold}Account Status:${C.reset} ${isGuest ? `${C.yellow}Guest (Not signed in)${C.reset}` : `${C.spotifyGreen}● Authenticated${C.reset}`}`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`  User: ${accountLabel}`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`  Spendable Balance: ${C.gold}${C.bold}${state.account?.gold ?? 0} Gold${C.reset}`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible('', totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`  ${C.bold}Login Options:${C.reset}`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`  • Press ${C.white}[L]${C.reset} or click Login button for Email/Password or TEDÜ SSO.`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`  • Listening Rewards: Rotating nonce heartbeat every 30s (+1 Gold).`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(`  • Press ${C.white}[X]${C.reset} to Sign Out.`, totalCols)}${C.spotifyGreen}│${C.reset}`);
    for (let k = 0; k < 2; k++) lines.push(`${C.spotifyGreen}│${C.reset}${padVisible('', totalCols)}${C.spotifyGreen}│${C.reset}`);
    lines.push(`${C.spotifyGreen}└${'─'.repeat(totalCols)}┘${C.reset}`);
  }

  // 3. BOTTOM SPOTIFY PLAYBAR (Track, Progress Bar, Volume, Controls)
  const isPlaying = state.active && !state.paused;
  const playIcon = isPlaying ? `${C.spotifyGreen}▶${C.reset}` : `${C.yellow}⏸${C.reset}`;
  const trackName = state.active ? `${state.active.name}${state.metadata ? ` — ${state.metadata}` : ''}` : 'Select a station to start listening';

  // Volume bar: [████████░░]
  const volBarsCount = 10;
  const filledBars = Math.round((volume / 100) * volBarsCount);
  const volBarStr = '█'.repeat(filledBars) + '░'.repeat(volBarsCount - filledBars);
  const volumeDisplay = `${C.cyan}🔉 [${volBarStr}] ${volume}%${C.reset}`;

  // Live progress bar: 04:12 ━━━━━━━━━━━━━━●──────────────────── 60:00 [● LIVE]
  const elapsedMins = Math.floor(streamSeconds / 60);
  const elapsedSecs = streamSeconds % 60;
  const timeStr = `${String(elapsedMins).padStart(2, '0')}:${String(elapsedSecs).padStart(2, '0')}`;

  const barTotalLen = Math.max(16, totalCols - 52);
  const dotPos = isPlaying ? Math.floor((streamSeconds % 180) / 180 * barTotalLen) : 0;
  const progBar = '━'.repeat(dotPos) + `${C.spotifyGreen}●${C.reset}` + '─'.repeat(Math.max(0, barTotalLen - dotPos - 1));
  const liveBadge = isPlaying ? `${C.brightRed}[● LIVE]${C.reset}` : `${C.gray}[IDLE]${C.reset}`;

  lines.push(`${C.spotifyGreen}┌─ Playback ──────────────────────────────────────────────────────────────────${'─'.repeat(Math.max(0, totalCols - 78))}┐${C.reset}`);
  const playRow1 = `  ${playIcon}  ${C.bold}${C.white}${truncateVisible(trackName, totalCols - 8)}${C.reset}`;
  lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(playRow1, totalCols)}${C.spotifyGreen}│${C.reset}`);

  const playRow2 = `  ${C.gray}${timeStr}${C.reset} ${progBar} ${liveBadge}   ${volumeDisplay}`;
  lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(playRow2, totalCols)}${C.spotifyGreen}│${C.reset}`);

  // Interactive Action Shortcuts (Row 3)
  const btnSpace = `${C.white}[Space]${C.reset} ${isPlaying ? 'Pause' : 'Play'}`;
  const btnQual = `${C.white}[F]${C.reset} ${state.quality.toUpperCase()}`;
  const btnVolUp = `${C.white}[+]${C.reset} Vol+`;
  const btnVolDown = `${C.white}[-]${C.reset} Vol-`;
  const btnLogin = isGuest ? `${C.white}[L]${C.reset} Login` : `${C.white}[X]${C.reset} Logout`;
  const btnStudy = `${C.white}[S]${C.reset} Study`;
  const btnQuit = `${C.white}[Q]${C.reset} Quit`;

  const playRow3 = `  ${btnSpace}   ${btnQual}   ${btnVolUp} ${btnVolDown}   ${btnLogin}   ${btnStudy}   ${btnQuit}   ${C.dim}(Click anywhere to control)${C.reset}`;
  lines.push(`${C.spotifyGreen}│${C.reset}${padVisible(playRow3, totalCols)}${C.spotifyGreen}│${C.reset}`);
  lines.push(`${C.spotifyGreen}└${'─'.repeat(totalCols)}┘${C.reset}`);

  process.stdout.write(`${ESC}2J${ESC}H${lines.join('\n')}\n`);
}

function parseInput(buffer) {
  const input = buffer.toString('utf8');
  if (input === '\u0003') return {type: 'key', key: 'q'};
  if (input === '\x1b[A' || input === 'k') return {type: 'key', key: 'up'};
  if (input === '\x1b[B' || input === 'j') return {type: 'key', key: 'down'};
  if (input === '\x1b[C') return {type: 'key', key: 'right'};
  if (input === '\x1b[D') return {type: 'key', key: 'left'};
  if (input === '\r' || input === '\n') return {type: 'key', key: 'enter'};
  if (input === ' ') return {type: 'key', key: 'space'};
  if (input === '\t') return {type: 'key', key: 'tab'};
  if (input === '+' || input === '=') return {type: 'key', key: 'volup'};
  if (input === '-' || input === '_') return {type: 'key', key: 'voldown'};
  if (input.length === 1) return {type: 'key', key: input.toLowerCase()};
  const mouse = input.match(/^\x1b\[<([0-9]+);([0-9]+);([0-9]+)([mM])$/);
  if (mouse) return {type: 'mouse', button: Number(mouse[1]), x: Number(mouse[2]), y: Number(mouse[3]), release: mouse[4] === 'm'};
  return null;
}

async function runTui({
  stations,
  onPlay,
  onQuality,
  onPause,
  onVolume,
  onSetVolume,
  onStudy,
  onAccount,
  onLogin,
  onLogout,
  onQuit,
  onTick,
  initialAccount = null,
  initialQuality = 'normal',
  playerName = null,
}) {
  return new Promise(resolve => {
    const state = {
      stations,
      selected: 0,
      active: null,
      metadata: null,
      quality: initialQuality,
      codec: 'HE-AAC v2',
      status: '',
      account: initialAccount,
      studyMinutes: null,
      paused: false,
      playerName,
      activeTab: 1,
      volume: 80,
      focusedPanel: 'stations',
    };

    let inputBuffer = '';
    let rendering = false;
    const render = () => {
      if (!rendering) {
        rendering = true;
        draw(state);
        rendering = false;
      }
    };
    state.requestRender = render;

    const cleanup = () => {
      clearInterval(timer);
      process.stdin.removeListener('data', dataHandler);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write(`${ESC}?25h${ESC}?1000l${ESC}?1006l\n`);
    };

    const pauseInput = () => {
      process.stdin.removeListener('data', dataHandler);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdout.write(`${ESC}?25h${ESC}?1000l${ESC}?1006l${ESC}2J${ESC}H`);
    };

    const resumeInput = () => {
      if (process.stdin.isTTY) process.stdin.setRawMode(true);
      process.stdin.on('data', dataHandler);
      process.stdout.write(`${ESC}?25l${ESC}?1000h${ESC}?1006h`);
    };

    // 200ms tick for smooth audio visualizer and real-time timer
    const timer = setInterval(() => {
      let changed = false;
      if (state.studyMinutes !== null) {
        state.studyMinutes += 0.2 / 60;
        changed = true;
      }
      if (state.active && !state.paused) {
        changed = true;
      }
      if (onTick?.(state)) changed = true;
      if (changed) render();
    }, 200);

    const handle = async (event) => {
      if (!event) return;

      // MOUSE SUPPORT
      if (event.type === 'mouse') {
        const {button, x, y, release} = event;

        // Wheel Scroll
        if (button === 64) {
          state.selected = Math.max(0, state.selected - 1);
          render();
          return;
        }
        if (button === 65) {
          state.selected = Math.min(stations.length - 1, state.selected + 1);
          render();
          return;
        }

        // Left Click
        if (button === 0 && release) {
          // Tab bar click (Line Y=2)
          if (y === 2) {
            if (x >= 2 && x <= 16) state.activeTab = 1;
            else if (x >= 17 && x <= 32) state.activeTab = 2;
            else if (x >= 33 && x <= 50) state.activeTab = 3;
            else if (x >= 51 && x <= 65) state.activeTab = 4;
            render();
            return;
          }

          // Station Row click in Tab 1 (Y=5 to 4 + stations.length, X <= 42)
          if (state.activeTab === 1 && y >= 5 && y < 5 + stations.length && x <= 42) {
            state.selected = y - 5;
            await onPlay(stations[state.selected], state);
            state.paused = false;
            render();
            return;
          }

          // Bottom Playbar click:
          // Check line numbers for playbar (total lines ~ 17-20)
          const playbarStart = state.activeTab === 1 ? 5 + Math.max(stations.length, 10) + 1 : 16;

          // Track row (play/pause toggle)
          if (y === playbarStart + 1) {
            state.paused = await onPause(state);
            render();
            return;
          }

          // Progress / Volume row
          if (y === playbarStart + 2) {
            // Volume clicked
            if (x >= 45) {
              const rel = Math.max(0, Math.min(100, Math.round((x - 48) / 10 * 100)));
              state.volume = onSetVolume ? onSetVolume(rel, state) : rel;
            } else {
              state.paused = await onPause(state);
            }
            render();
            return;
          }

          // Buttons row
          if (y === playbarStart + 3) {
            if (x >= 2 && x <= 18) {
              state.paused = await onPause(state);
            } else if (x >= 19 && x <= 29) {
              state.quality = onQuality(state);
            } else if (x >= 30 && x <= 38) {
              state.volume = onVolume ? onVolume(5, state) : Math.min(100, state.volume + 5);
            } else if (x >= 39 && x <= 47) {
              state.volume = onVolume ? onVolume(-5, state) : Math.max(0, state.volume - 5);
            } else if (x >= 48 && x <= 59) {
              if (state.account?.label && state.account.label !== 'Guest') {
                state.account = await onLogout(state);
                state.status = 'Signed out.';
              } else {
                pauseInput();
                try {
                  state.account = await onLogin(state);
                  state.status = 'Signed in. Gold listening enabled.';
                } catch (err) {
                  state.status = `Login failed: ${err.message}`;
                } finally {
                  resumeInput();
                }
              }
            } else if (x >= 60 && x <= 70) {
              state.studyMinutes = await onStudy(state);
            } else if (x >= 71 && x <= 80) {
              cleanup();
              onQuit?.();
              return resolve();
            }
            render();
            return;
          }
        }
        return;
      }

      // KEYBOARD SHORTCUTS
      switch (event.key) {
        case 'q':
          cleanup();
          onQuit?.();
          return resolve();
        case '1': state.activeTab = 1; break;
        case '2': state.activeTab = 2; break;
        case '3': state.activeTab = 3; break;
        case '4': state.activeTab = 4; break;
        case 'v': state.activeTab = state.activeTab === 2 ? 1 : 2; break;
        case 'tab':
          state.focusedPanel = state.focusedPanel === 'stations' ? 'main' : 'stations';
          break;
        case 'up':
          state.selected = Math.max(0, state.selected - 1);
          break;
        case 'down':
          state.selected = Math.min(stations.length - 1, state.selected + 1);
          break;
        case 'enter':
          await onPlay(stations[state.selected], state);
          state.paused = false;
          break;
        case 'space':
        case 'p':
          state.paused = await onPause(state);
          break;
        case 'f':
          state.quality = onQuality(state);
          break;
        case 'volup':
          state.volume = onVolume ? onVolume(5, state) : Math.min(100, (state.volume || 80) + 5);
          break;
        case 'voldown':
          state.volume = onVolume ? onVolume(-5, state) : Math.max(0, (state.volume || 80) - 5);
          break;
        case 'm':
          state.volume = onSetVolume ? onSetVolume(state.volume > 0 ? 0 : 80, state) : (state.volume > 0 ? 0 : 80);
          break;
        case 's':
          state.studyMinutes = await onStudy(state);
          break;
        case 'a':
          state.account = await onAccount(state);
          break;
        case 'l':
          pauseInput();
          try {
            state.account = await onLogin(state);
            state.status = 'Signed in. Gold listening enabled.';
          } catch (err) {
            state.status = `Login failed: ${err.message}`;
          } finally {
            resumeInput();
          }
          break;
        case 'x':
          state.account = await onLogout(state);
          state.status = 'Signed out.';
          break;
        default:
          break;
      }
      render();
    };

    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdout.write(`${ESC}?25l${ESC}?1000h${ESC}?1006h`);

    const dataHandler = async chunk => {
      inputBuffer += chunk;
      const parsed = parseInput(inputBuffer);
      if (parsed) {
        inputBuffer = '';
        await handle(parsed);
      } else if (inputBuffer.length > 32) {
        inputBuffer = '';
      }
    };

    process.stdin.on('data', dataHandler);
    render();
  });
}

module.exports = {runTui, parseInput, generateSpectrum};
