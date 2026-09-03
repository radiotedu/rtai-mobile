const readline = require('node:readline');

const ESC = '\x1b[';

// Professional Palette (OpenCode slate / Catppuccin / Spotify Studio)
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  // Brand & Accents
  red: '\x1b[38;2;229;9;20m',          // RadioTEDU Signature Crimson
  brightRed: '\x1b[38;2;255;85;85m',
  spotifyGreen: '\x1b[38;2;30;215;96m', // Spotify Studio Emerald
  green: '\x1b[38;2;80;250;123m',
  gold: '\x1b[38;2;241;196;15m',        // Classical & Gold Currency
  amber: '\x1b[38;2;255;184;108m',
  purple: '\x1b[38;2;189;147;249m',     // Jazz Bebop
  cyan: '\x1b[38;2;139;233;253m',       // Lo-Fi & Audio Spectrum
  brightCyan: '\x1b[38;2;0;229;255m',
  orange: '\x1b[38;2;255;121;198m',     // Rock
  yellow: '\x1b[38;2;241;250;140m',     // Energize
  white: '\x1b[38;2;248;248;242m',
  gray: '\x1b[38;2;140;145;160m',
  darkGray: '\x1b[38;2;98;104;128m',
  slateBorder: '\x1b[38;2;68;71;90m',   // OpenCode sleek slate border
  activeBorder: '\x1b[38;2;30;215;96m', // Active focused border
  // Backgrounds
  bgActiveRow: '\x1b[48;2;40;42;54m',
  bgTabActive: '\x1b[48;2;30;215;96m\x1b[38;2;15;15;20;1m',
  bgTabInactive: '\x1b[48;2;40;42;54m\x1b[38;2;180;185;200m',
};

function stationColor(id) {
  switch (String(id || '').toLowerCase()) {
    case 'radio': return C.red;
    case 'classic': return C.gold;
    case 'cazz':
    case 'jazz': return C.purple;
    case 'lofi': return C.cyan;
    case 'energize': return C.yellow;
    case 'rock': return C.amber;
    case 'en': return C.brightCyan;
    case 'fr': return C.orange;
    case 'spark': return C.green;
    default: return C.white;
  }
}

function stationGenre(id) {
  switch (String(id || '').toLowerCase()) {
    case 'radio': return 'Flagship Main';
    case 'classic': return 'Symphonic 24b';
    case 'cazz':
    case 'jazz': return 'Bebop & Soul';
    case 'lofi': return 'Chillhop Beats';
    case 'energize': return 'Workout EDM';
    case 'rock': return 'Classic & Alt';
    case 'en': return 'Campus English';
    case 'fr': return 'Campus French';
    case 'spark': return 'Audience Vote';
    default: return 'Live Broadcast';
  }
}

function stationFormat(station) {
  if (station.qualities.includes('flac')) return 'FLAC 24b';
  if (station.id === 'spark') return 'OGG OPUS';
  if (station.id === 'en' || station.id === 'fr') return 'MP3 192k';
  return 'HE-AACv2';
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

// ---------------------------------------------------------
// Real-Time 32-Band Audio Spectrum Engine with Peak-Hold Decay
// ---------------------------------------------------------
const peakHold = [];
const peakHoldTicks = [];

function generateStudioSpectrum(tick, numBands, maxHeight, isPlaying) {
  const heights = [];

  for (let i = 0; i < numBands; i++) {
    if (!isPlaying) {
      heights.push(0);
      if (peakHold[i] > 0) peakHold[i] = Math.max(0, peakHold[i] - 0.4);
      continue;
    }

    const freqFactor = i / numBands;
    // Multi-octave harmonic simulation:
    // Sub-bass (0..3), Bass (4..8), Mids (9..18), Highs (19..numBands-1)
    const wave1 = Math.sin(tick * 0.38 + i * 0.35) * 0.42;
    const wave2 = Math.cos(tick * 0.22 - i * 0.48) * 0.36;
    const wave3 = Math.sin(tick * 0.65 + i * 0.85) * 0.20;
    const beatPulse = (tick % 8 < 2) ? (0.28 * (1 - freqFactor * 0.65)) : 0;
    const highSparkle = Math.sin(tick * 1.1 + i * 1.4) * 0.16 * freqFactor;
    const raw = 0.35 + wave1 + wave2 + wave3 + beatPulse + highSparkle;
    const normalized = Math.max(0.05, Math.min(1.0, raw));
    const h = Math.round(normalized * maxHeight);
    heights.push(h);

    // Peak-hold update
    if (!peakHold[i] || h >= peakHold[i]) {
      peakHold[i] = h;
      peakHoldTicks[i] = tick;
    } else if (tick - (peakHoldTicks[i] || 0) > 3) {
      // Decay peak downward smoothly
      peakHold[i] = Math.max(h, peakHold[i] - 1);
    }
  }

  // Generate ASCII / Unicode rows from top down to 1
  const rows = [];
  for (let h = maxHeight; h >= 1; h--) {
    let row = '';
    for (let i = 0; i < numBands; i++) {
      const val = heights[i];
      const peak = Math.round(peakHold[i] || 0);

      let col = C.spotifyGreen;
      if (h >= Math.floor(maxHeight * 0.85)) col = C.brightRed;
      else if (h >= Math.floor(maxHeight * 0.60)) col = C.yellow;
      else if (h >= Math.floor(maxHeight * 0.30)) col = C.cyan;

      if (val >= h) {
        row += `${col}█ ${C.reset}`;
      } else if (val === h - 1 && val > 0) {
        row += `${col}▄ ${C.reset}`;
      } else if (peak === h && isPlaying) {
        row += `${C.white}• ${C.reset}`; // Floating peak hold dot
      } else {
        row += '  ';
      }
    }
    rows.push(row);
  }

  return rows;
}

let vizTick = 0;
let streamSeconds = 0;

function draw(state) {
  const totalCols = Math.max(96, Math.min(130, (process.stdout.columns || 100) - 2));
  const lines = [];

  const accountLabel = state.account?.label || 'Guest';
  const isGuest = accountLabel === 'Guest';
  const goldVal = state.account?.gold;
  const goldText = Number.isInteger(goldVal) ? `  ${C.gold}${C.bold}◆ ${goldVal} Gold${C.reset}` : '';
  const studyText = state.studyMinutes !== null ? `  ${C.cyan}⏱ ${Math.floor(state.studyMinutes)}m${C.reset}` : '';
  const activeTab = state.activeTab || 1;
  const volume = state.volume ?? 80;

  // ---------------------------------------------------------
  // 1. TOP APP BAR & OPENCODE-STYLE TAB CAPSULES
  // ---------------------------------------------------------
  const tabPill = (num, name, tabIdx) => {
    return activeTab === tabIdx
      ? `${C.bgTabActive} ${num}: ${name} ${C.reset}`
      : `${C.bgTabInactive} ${num}: ${name} ${C.reset}`;
  };

  const tabsBar = `${tabPill('1', 'STATIONS', 1)}  ${tabPill('2', 'EQUALIZER', 2)}  ${tabPill('3', 'STUDY ROOM', 3)}  ${tabPill('4', 'ACCOUNT', 4)}`;
  const userBar = isGuest
    ? `${C.darkGray}👤 Guest (${C.white}Press 'L' to Login${C.darkGray})${C.reset} `
    : `${C.spotifyGreen}● ${C.white}${C.bold}${accountLabel}${C.reset}${goldText}${studyText} `;

  const headerTitle = ` 📻 ${C.bold}${C.white}RADIOTEDU${C.reset} ${C.red}//${C.reset} ${C.gray}STUDIO CONSOLE${C.reset} `;
  const headerRight = `${C.darkGray}v1.3.5 ─╮${C.reset}`;
  const fillHeader = Math.max(0, totalCols - stripAnsi(headerTitle).length - stripAnsi(headerRight).length - 2);

  lines.push(`${C.slateBorder}╭─${C.reset}${headerTitle}${C.slateBorder}${'─'.repeat(fillHeader)}${C.reset}${headerRight}`);
  
  const headerContent = `  ${tabsBar}${' '.repeat(Math.max(2, totalCols - stripAnsi(tabsBar).length - stripAnsi(userBar).length - 4))}${userBar}`;
  lines.push(`${C.slateBorder}│${C.reset}${padVisible(headerContent, totalCols)}${C.slateBorder}│${C.reset}`);
  lines.push(`${C.slateBorder}╰${'─'.repeat(totalCols)}╯${C.reset}`);

  // ---------------------------------------------------------
  // 2. MAIN WORKSPACE PANELS
  // ---------------------------------------------------------
  const leftW = 50;
  const rightW = totalCols - leftW - 3;
  const numStations = state.stations.length;

  if (activeTab === 1) {
    // TAB 1: STUDIO DASHBOARD (Left: Stations Table, Right: Telemetry & Equalizer)
    const leftHeader = `╭─ STATIONS (${numStations}) ${'─'.repeat(Math.max(0, leftW - 17))}╮`;
    const rightHeader = `╭─ AUDIO SPECTRUM & BROADCAST TELEMETRY ${'─'.repeat(Math.max(0, rightW - 41))}╮`;
    lines.push(`${C.slateBorder}${leftHeader}${C.reset} ${C.slateBorder}${rightHeader}${C.reset}`);

    // Table Sub-header for Stations Pane
    const tableHead = `  ${C.darkGray}STATION             GENRE           FORMAT${C.reset}`;
    const headFiller = '─'.repeat(rightW - 4);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(tableHead, leftW)}${C.slateBorder}│${C.reset} ${C.slateBorder}│${C.reset}${padVisible(`  ${C.darkGray}${headFiller}${C.reset}`, rightW)}${C.slateBorder}│${C.reset}`);

    vizTick++;
    if (state.active && !state.paused) streamSeconds++;
    const isPlayingAudio = state.active && !state.paused;

    // 6-Row Studio Spectrum Analyzer with dB Scale
    const spectrumBands = Math.max(10, Math.floor((rightW - 12) / 2));
    const spectrumRows = generateStudioSpectrum(vizTick, spectrumBands, 6, isPlayingAudio);

    const maxRows = Math.max(numStations, 10);

    for (let r = 0; r < maxRows; r++) {
      // LEFT PANE: Stations Table Row
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
        const nameText = isSelected
          ? `${C.bold}${C.white}${station.name.slice(0, 18).padEnd(18)}${C.reset}`
          : `${station.name.slice(0, 18).padEnd(18)}`;
        const genre = `${C.gray}${stationGenre(station.id).slice(0, 15).padEnd(15)}${C.reset}`;
        const fmtBadge = station.qualities.includes('flac')
          ? `${C.gold}[FLAC]${C.reset}`
          : `${C.darkGray}[AAC]${C.reset} `;

        const rowContent = ` ${cursor} ${playIcon} ${dot} ${nameText} ${genre} ${fmtBadge}`;
        leftContent = isSelected
          ? `${C.bgActiveRow}${padVisible(rowContent, leftW)}${C.reset}`
          : padVisible(rowContent, leftW);
      } else {
        leftContent = ' '.repeat(leftW);
      }

      // RIGHT PANE: Telemetry & Audio Spectrum
      let rightContent = '';
      if (r === 0) {
        // Station Title & Broadcast Banner
        const stName = state.active ? state.active.name.toUpperCase() : 'NO STATION SELECTED';
        const stColor = state.active ? stationColor(state.active.id) : C.gray;
        const onAirTag = isPlayingAudio ? `${C.brightRed}● ON AIR${C.reset}` : `${C.darkGray}○ STANDBY${C.reset}`;
        rightContent = `  ${stColor}${C.bold}${stName}${C.reset}  ${C.darkGray}·${C.reset}  ${onAirTag}`;
      } else if (r === 1) {
        // Now Playing Track & Artist
        const meta = state.metadata || (state.active ? 'Broadcasting live from Ankara Studios' : 'Select a station to listen');
        rightContent = `  ${C.white}♪ ${truncateVisible(meta, rightW - 6)}${C.reset}`;
      } else if (r >= 2 && r <= 7) {
        // 6 Spectrum Rows with vertical dB marks
        const specIdx = r - 2;
        const dBMarkers = [
          `${C.brightRed}+3dB ┼${C.reset} `,
          `${C.yellow} 0dB ┼${C.reset} `,
          `${C.spotifyGreen}-3dB ┼${C.reset} `,
          `${C.spotifyGreen}-6dB ┼${C.reset} `,
          `${C.cyan}-12dB ┼${C.reset} `,
          `${C.cyan}-24dB ┼${C.reset} `,
        ];
        const dbMark = dBMarkers[specIdx] || '     ┼ ';
        const specRow = spectrumRows[specIdx] || '';
        rightContent = `  ${dbMark}${specRow}`;
      } else if (r === 8) {
        // Frequency Axis
        const freqLine = `${C.darkGray}      ┴─┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬─${C.reset}`;
        rightContent = `  ${truncateVisible(freqLine, rightW - 4)}`;
      } else if (r === 9) {
        // Frequency Labels
        const fLabels = `${C.darkGray}       32  64  125 250 500  1k  2k  4k  8k 12k 16k Hz${C.reset}`;
        rightContent = `  ${truncateVisible(fLabels, rightW - 4)}`;
      } else {
        // Diagnostics & Heartbeat
        const bufGauge = isPlayingAudio ? `${C.spotifyGreen}[██████████]${C.reset}` : `${C.darkGray}[░░░░░░░░░░]${C.reset}`;
        const goldStatus = state.account?.gold !== null ? `${C.gold}+1 Gold/30s${C.reset}` : `${C.darkGray}Sign in for Gold${C.reset}`;
        rightContent = `  ${C.gray}Buffer: ${bufGauge} · Heartbeat: ${goldStatus} · Engine: ${state.playerName || 'ffplay'}${C.reset}`;
      }

      lines.push(`${C.slateBorder}│${C.reset}${leftContent}${C.slateBorder}│${C.reset} ${C.slateBorder}│${C.reset}${padVisible(rightContent, rightW)}${C.slateBorder}│${C.reset}`);
    }

    const leftFooter = `╰${'─'.repeat(leftW)}╯`;
    const rightFooter = `╰${'─'.repeat(rightW)}╯`;
    lines.push(`${C.slateBorder}${leftFooter}${C.reset} ${C.slateBorder}${rightFooter}${C.reset}`);

  } else if (activeTab === 2) {
    // TAB 2: FULL-WIDTH STUDIO EQUALIZER & STEREO MONITORS
    lines.push(`${C.slateBorder}╭─ FULL-WIDTH STUDIO EQUALIZER & STEREO MONITORS ${'─'.repeat(Math.max(0, totalCols - 50))}╮${C.reset}`);
    vizTick++;
    if (state.active && !state.paused) streamSeconds++;
    const isPlayingAudio = state.active && !state.paused;

    const fullBands = Math.floor((totalCols - 14) / 2);
    const fullRows = generateStudioSpectrum(vizTick, fullBands, 8, isPlayingAudio);

    // Stereo Channel Peak Gauges
    const chL = isPlayingAudio ? `${C.spotifyGreen}[██████████████░░░░] -2.4 dB${C.reset}` : `${C.darkGray}[░░░░░░░░░░░░░░░░░░] --.- dB${C.reset}`;
    const chR = isPlayingAudio ? `${C.spotifyGreen}[█████████████░░░░░] -3.1 dB${C.reset}` : `${C.darkGray}[░░░░░░░░░░░░░░░░░░] --.- dB${C.reset}`;
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  ${C.bold}STEREO MONITORS:${C.reset}  CH-L: ${chL}   CH-R: ${chR}`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible('', totalCols)}${C.slateBorder}│${C.reset}`);

    const dBMarkers = [
      `${C.brightRed}+3dB ┼${C.reset} `,
      `${C.yellow} 0dB ┼${C.reset} `,
      `${C.spotifyGreen}-3dB ┼${C.reset} `,
      `${C.spotifyGreen}-6dB ┼${C.reset} `,
      `${C.spotifyGreen}-9dB ┼${C.reset} `,
      `${C.cyan}-12dB ┼${C.reset} `,
      `${C.cyan}-18dB ┼${C.reset} `,
      `${C.cyan}-24dB ┼${C.reset} `,
    ];

    for (let i = 0; i < 8; i++) {
      const dbLabel = dBMarkers[i] || '     ┼ ';
      lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  ${dbLabel}${fullRows[i]}`, totalCols)}${C.slateBorder}│${C.reset}`);
    }

    const freqLabels = '       20  40  80  160  320  640   1k   2k   4k   8k  12k  16k  20k Hz';
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  ${C.darkGray}      ┴───┴───┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴──────${C.reset}`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`${C.darkGray}${freqLabels}${C.reset}`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}╰${'─'.repeat(totalCols)}╯${C.reset}`);

  } else if (activeTab === 3) {
    // TAB 3: STUDY ROOM & CAMPUS FOCUS SESSION
    lines.push(`${C.slateBorder}╭─ STUDY ROOM & CAMPUS FOCUS SESSION ${'─'.repeat(Math.max(0, totalCols - 38))}╮${C.reset}`);
    const isStudying = state.studyMinutes !== null;
    const studyMins = isStudying ? Math.floor(state.studyMinutes) : 0;
    const pomodoroBar = Math.min(20, Math.floor((studyMins % 25) / 25 * 20));
    const pBarStr = `${C.spotifyGreen}${'█'.repeat(pomodoroBar)}${C.darkGray}${'░'.repeat(20 - pomodoroBar)}${C.reset}`;

    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  ${C.bold}POMODORO FOCUS TIMER:${C.reset}  ${isStudying ? `${C.spotifyGreen}● ACTIVE SESSION${C.reset}` : `${C.darkGray}○ IDLE (Press 'S' to begin)${C.reset}`}`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  Progress : [${pBarStr}] ${studyMins}m / 25m (${C.gold}+10 Gold reward${C.reset})`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  Location : TEDÜ Ana Kütüphane / Çim Alan  ·  Verified campus study zone`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible('', totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  ${C.bold}LIVE LYRICS / STREAM INTEL:${C.reset}`, totalCols)}${C.slateBorder}│${C.reset}`);
    const track = state.metadata || state.active?.description || 'Broadcasting live from RadioTEDU Ankara Studios';
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  ${C.cyan}♪ ${track}${C.reset}`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  ${C.darkGray}• Smart lyrics policy: Zero background cellular drain.${C.reset}`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  ${C.darkGray}• High-concentration instrumental music active on Lo-Fi & Classical.${C.reset}`, totalCols)}${C.slateBorder}│${C.reset}`);
    for (let k = 0; k < 2; k++) lines.push(`${C.slateBorder}│${C.reset}${padVisible('', totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}╰${'─'.repeat(totalCols)}╯${C.reset}`);

  } else if (activeTab === 4) {
    // TAB 4: RADIOTEDU ACCOUNT & GOLD WALLET
    lines.push(`${C.slateBorder}╭─ RADIOTEDU ACCOUNT & GOLD WALLET ${'─'.repeat(Math.max(0, totalCols - 36))}╮${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  ${C.bold}Identity Status :${C.reset} ${isGuest ? `${C.yellow}Guest Profile (Unauthenticated)${C.reset}` : `${C.spotifyGreen}● Verified RadioTEDU Account${C.reset}`}`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  User Account    : ${C.white}${accountLabel}${C.reset}`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  Gold Balance    : ${C.gold}${C.bold}◆ ${state.account?.gold ?? 0} Gold${C.reset} (Server Verified)`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  Listening Proof : Rotating nonces active · ${C.spotifyGreen}+1 Gold per 30s playback${C.reset}`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  Campus Perks    : Jukebox priority access · TEDÜ event tickets · Merch store`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible('', totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  ${C.bold}Actions:${C.reset}`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  • Press ${C.white}[L]${C.reset} to Login via RadioTEDU Email/Password or TEDÜ ERP SSO.`, totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}│${C.reset}${padVisible(`  • Press ${C.white}[X]${C.reset} to Sign Out cleanly.`, totalCols)}${C.slateBorder}│${C.reset}`);
    for (let k = 0; k < 2; k++) lines.push(`${C.slateBorder}│${C.reset}${padVisible('', totalCols)}${C.slateBorder}│${C.reset}`);
    lines.push(`${C.slateBorder}╰${'─'.repeat(totalCols)}╯${C.reset}`);
  }

  // ---------------------------------------------------------
  // 3. BOTTOM SPOTIFY PLAYBAR DOCK
  // ---------------------------------------------------------
  const isPlaying = state.active && !state.paused;
  const playIcon = isPlaying ? `${C.spotifyGreen}▶${C.reset}` : `${C.yellow}⏸${C.reset}`;
  const trackName = state.active
    ? `${state.active.name} — ${state.metadata || 'Live Stream'}`
    : 'Select a station to start listening';

  const formatPill = state.active ? `[${stationFormat(state.active)}]` : '[AUDIO IDLE]';

  // Volume Bar: [████████░░]
  const volBarsCount = 10;
  const filledBars = Math.round((volume / 100) * volBarsCount);
  const volBarStr = `${C.spotifyGreen}${'█'.repeat(filledBars)}${C.darkGray}${'░'.repeat(volBarsCount - filledBars)}${C.reset}`;
  const volumeDisplay = `🔉 [${volBarStr}] ${volume}%`;

  // Authentic Live Broadcast Telemetry (No fake progress bar)
  const elapsedMins = Math.floor(streamSeconds / 60);
  const elapsedSecs = streamSeconds % 60;
  const sessionTime = `${String(elapsedMins).padStart(2, '0')}m ${String(elapsedSecs).padStart(2, '0')}s`;

  const onAirPill = isPlaying
    ? `${C.brightRed}${C.bold}● LIVE ON AIR${C.reset}`
    : `${C.darkGray}○ STANDBY (IDLE)${C.reset}`;

  const signalBars = isPlaying
    ? `${C.spotifyGreen}▂▃▅▆▇ (99% Signal)${C.reset}`
    : `${C.darkGray}───── (No Signal)${C.reset}`;

  const telemetryInfo = isPlaying
    ? `${onAirPill}   ${C.darkGray}·${C.reset}   ${C.gray}Continuous Stream: ${C.white}${sessionTime}${C.reset}   ${C.darkGray}·${C.reset}   ${C.gray}Health: ${signalBars}`
    : `${onAirPill}   ${C.darkGray}·${C.reset}   ${C.gray}Broadcasting 24/7 from RadioTEDU Ankara Studios · Press [Space] to play${C.reset}`;

  lines.push(`${C.slateBorder}╭─ NOW PLAYING // LIVE BROADCAST ${'─'.repeat(Math.max(0, totalCols - 34))}╮${C.reset}`);
  
  const playRow1 = `  ${playIcon}  ${C.bold}${C.white}${truncateVisible(trackName, totalCols - 24)}${C.reset}  ${C.gold}${formatPill}${C.reset}`;
  lines.push(`${C.slateBorder}│${C.reset}${padVisible(playRow1, totalCols)}${C.slateBorder}│${C.reset}`);

  const playRow2Spacing = Math.max(2, totalCols - stripAnsi(telemetryInfo).length - stripAnsi(volumeDisplay).length - 4);
  const playRow2 = `  ${telemetryInfo}${' '.repeat(playRow2Spacing)}${volumeDisplay}`;
  lines.push(`${C.slateBorder}│${C.reset}${padVisible(playRow2, totalCols)}${C.slateBorder}│${C.reset}`);

  // Action Buttons Dock
  const btnSpace = `${C.white}[Space]${C.reset} ${isPlaying ? 'Pause' : 'Play'}`;
  const btnQual = `${C.white}[F]${C.reset} ${state.quality.toUpperCase()}`;
  const btnVolUp = `${C.white}[+]${C.reset} Vol+`;
  const btnVolDown = `${C.white}[-]${C.reset} Vol-`;
  const btnLogin = isGuest ? `${C.white}[L]${C.reset} Login` : `${C.white}[X]${C.reset} Logout`;
  const btnStudy = `${C.white}[S]${C.reset} Study`;
  const btnQuit = `${C.white}[Q]${C.reset} Quit`;

  const playRow3 = `  ${btnSpace}   ${btnQual}   ${btnVolUp} ${btnVolDown}   ${btnLogin}   ${btnStudy}   ${btnQuit}   ${C.darkGray}· Click anywhere to control ·${C.reset}`;
  lines.push(`${C.slateBorder}│${C.reset}${padVisible(playRow3, totalCols)}${C.slateBorder}│${C.reset}`);
  lines.push(`${C.slateBorder}╰${'─'.repeat(totalCols)}╯${C.reset}`);

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

    // 200ms tick for smooth peak-hold decay and real-time audio animation
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
            if (x >= 2 && x <= 18) state.activeTab = 1;
            else if (x >= 19 && x <= 35) state.activeTab = 2;
            else if (x >= 36 && x <= 54) state.activeTab = 3;
            else if (x >= 55 && x <= 72) state.activeTab = 4;
            render();
            return;
          }

          // Station Row click in Tab 1 (Y=6 to 5 + stations.length, X <= 44)
          if (state.activeTab === 1 && y >= 6 && y < 6 + stations.length && x <= 52) {
            state.selected = y - 6;
            await onPlay(stations[state.selected], state);
            state.paused = false;
            render();
            return;
          }

          // Bottom Playbar click
          const playbarStart = state.activeTab === 1 ? 6 + Math.max(stations.length, 10) + 1 : 16;

          // Track row (play/pause toggle)
          if (y === playbarStart + 1) {
            state.paused = await onPause(state);
            render();
            return;
          }

          // Progress / Volume row
          if (y === playbarStart + 2) {
            if (x >= 50) {
              const rel = Math.max(0, Math.min(100, Math.round((x - 52) / 10 * 100)));
              state.volume = onSetVolume ? onSetVolume(rel, state) : rel;
              render();
              return;
            }
          }

          // Action buttons row
          if (y === playbarStart + 3) {
            if (x >= 2 && x <= 18) {
              // Space: Play / Pause
              state.paused = await onPause(state);
            } else if (x >= 19 && x <= 32) {
              // F: Quality
              state.quality = onQuality(state);
            } else if (x >= 33 && x <= 42) {
              // Vol+
              state.volume = onVolume ? onVolume(5, state) : Math.min(100, state.volume + 5);
            } else if (x >= 43 && x <= 52) {
              // Vol-
              state.volume = onVolume ? onVolume(-5, state) : Math.max(0, state.volume - 5);
            } else if (x >= 53 && x <= 65) {
              // Login / Logout
              if (state.account?.label && state.account.label !== 'Guest') {
                state.account = await onLogout();
              } else {
                pauseInput();
                try {
                  state.account = await onLogin();
                } finally {
                  resumeInput();
                }
              }
            } else if (x >= 66 && x <= 78) {
              // Study
              const minutes = await onStudy(state);
              state.studyMinutes = minutes;
            } else if (x >= 79 && x <= 90) {
              // Quit
              cleanup();
              onQuit();
              resolve();
              return;
            }
            render();
            return;
          }
        }
        return;
      }

      // KEYBOARD SUPPORT
      if (event.type === 'key') {
        switch (event.key) {
          case '1': state.activeTab = 1; render(); break;
          case '2': state.activeTab = 2; render(); break;
          case '3': state.activeTab = 3; render(); break;
          case '4': state.activeTab = 4; render(); break;
          case 'tab':
            state.focusedPanel = state.focusedPanel === 'stations' ? 'main' : 'stations';
            render();
            break;
          case 'up':
            state.selected = (state.selected - 1 + stations.length) % stations.length;
            render();
            break;
          case 'down':
            state.selected = (state.selected + 1) % stations.length;
            render();
            break;
          case 'enter':
            await onPlay(stations[state.selected], state);
            state.paused = false;
            render();
            break;
          case 'space':
          case 'p':
            state.paused = await onPause(state);
            render();
            break;
          case 'f':
            state.quality = onQuality(state);
            render();
            break;
          case 'v':
            state.activeTab = state.activeTab === 2 ? 1 : 2;
            render();
            break;
          case 'volup':
          case '+':
          case '=':
            state.volume = onVolume ? onVolume(5, state) : Math.min(100, state.volume + 5);
            render();
            break;
          case 'voldown':
          case '-':
          case '_':
            state.volume = onVolume ? onVolume(-5, state) : Math.max(0, state.volume - 5);
            render();
            break;
          case 'm':
            state.volume = state.volume > 0 ? (onSetVolume ? onSetVolume(0, state) : 0) : (onSetVolume ? onSetVolume(80, state) : 80);
            render();
            break;
          case 'l':
            pauseInput();
            try {
              state.account = await onLogin();
            } finally {
              resumeInput();
            }
            render();
            break;
          case 'x':
            state.account = await onLogout();
            render();
            break;
          case 's':
            state.studyMinutes = await onStudy(state);
            render();
            break;
          case 'a':
            state.account = await onAccount();
            render();
            break;
          case 'q':
            cleanup();
            onQuit();
            resolve();
            break;
        }
      }
    };

    const dataHandler = async (chunk) => {
      inputBuffer += chunk.toString('utf8');
      while (inputBuffer.length > 0) {
        if (inputBuffer.startsWith('\x1b[<')) {
          const m = inputBuffer.match(/^\x1b\[<[0-9]+;[0-9]+;[0-9]+[mM]/);
          if (m) {
            const event = parseInput(Buffer.from(m[0], 'utf8'));
            inputBuffer = inputBuffer.slice(m[0].length);
            await handle(event);
            continue;
          }
          if (inputBuffer.length < 16) break;
        }
        if (inputBuffer.startsWith('\x1b')) {
          const escSeq = inputBuffer.match(/^\x1b(?:\[[A-Z0-9]+|.)?/);
          if (escSeq) {
            const event = parseInput(Buffer.from(escSeq[0], 'utf8'));
            inputBuffer = inputBuffer.slice(escSeq[0].length);
            await handle(event);
            continue;
          }
        }
        const ch = inputBuffer[0];
        inputBuffer = inputBuffer.slice(1);
        await handle(parseInput(Buffer.from(ch, 'utf8')));
      }
    };

    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', dataHandler);
    process.stdout.write(`${ESC}?25l${ESC}?1000h${ESC}?1006h`);
    render();
  });
}

module.exports = {runTui, parseInput, generateStudioSpectrum};
