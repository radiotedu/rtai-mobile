const readline = require('node:readline');

const ESC = '\x1b[';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[38;2;229;9;20m',       // RadioTEDU Red
  gold: '\x1b[38;2;229;160;0m',     // Classical & Gold
  purple: '\x1b[38;2;156;39;176m',  // Jazz
  cyan: '\x1b[38;2;0;188;212m',     // Lo-Fi
  yellow: '\x1b[38;2;198;255;0m',   // Energize
  orange: '\x1b[38;2;255;107;44m',  // Rock
  green: '\x1b[38;2;30;215;96m',    // Spotify / Active Green
  white: '\x1b[97m',
  gray: '\x1b[90m',
  bgSelect: '\x1b[48;5;236m',       // Subtle dark row highlight
};

const VISUALIZER_FRAMES = [
  ' ▂▃▅▆▇▆▅▃ ',
  '▃▅▆▇▆▅▃▂ ',
  '▅▆▇▆▅▃▂ ▂',
  '▆▇▆▅▃▂ ▂▃',
  '▇▆▅▃▂ ▂▃▅',
  '▆▅▃▂ ▂▃▅▆',
  '▅▃▂ ▂▃▅▆▇',
  '▃▂ ▂▃▅▆▇▆',
];

function stationColor(id) {
  switch (String(id || '').toLowerCase()) {
    case 'radio': return C.red;
    case 'classic': return C.gold;
    case 'cazz':
    case 'jazz': return C.purple;
    case 'lofi': return C.cyan;
    case 'energize': return C.yellow;
    case 'rock': return C.orange;
    default: return C.white;
  }
}

function stripAnsi(str) {
  return String(str || '').replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

function padBox(content, width = 62) {
  const visibleLen = stripAnsi(content).length;
  const padding = Math.max(0, width - visibleLen);
  return content + ' '.repeat(padding);
}

function truncateVisible(str, maxLen) {
  const plain = stripAnsi(str);
  if (plain.length <= maxLen) return str;
  return plain.slice(0, maxLen - 1) + '…';
}

let animTick = 0;

function draw(state) {
  const lines = [];
  const W = 62;
  const accountName = state.account?.label || 'Guest';
  const isGuest = accountName === 'Guest';
  const goldStr = Number.isInteger(state.account?.gold) ? `  ${C.gold}${C.bold}◆ ${state.account.gold} Gold${C.reset}` : '';
  const studyStr = state.studyMinutes !== null ? `  ${C.cyan}⏱ Study ${Math.floor(state.studyMinutes)} min${C.reset}` : '';
  const userHeader = isGuest
    ? `  ${C.gray}👤 ${accountName} ${C.dim}(Press 'L' or click to Sign In)${C.reset}`
    : `  ${C.green}👤 ${C.bold}${accountName}${C.reset}${goldStr}${studyStr}`;

  lines.push(`${C.red}╭${'─'.repeat(W)}╮${C.reset}`);
  lines.push(`${C.red}│${C.reset}${padBox(`  ${C.bold}${C.white}RADIOTEDU TERMINAL${C.reset} ${C.dim}· Spotify-inspired CLI v1.3.5${C.reset}`, W)}${C.red}│${C.reset}`);
  lines.push(`${C.red}│${C.reset}${padBox(userHeader, W)}${C.red}│${C.reset}`);
  lines.push(`${C.red}├${'─'.repeat(W)}┤${C.reset}`);

  // Station List (Lines start at Y=5 in terminal output)
  state.stations.forEach((station, index) => {
    const isSelected = index === state.selected;
    const isPlaying = state.active?.id === station.id && !state.paused;
    const isPaused = state.active?.id === station.id && state.paused;

    const cursor = isSelected ? `${C.red}${C.bold}›${C.reset}` : ' ';
    const playIndicator = isPlaying
      ? `${C.green}▶${C.reset}`
      : isPaused
      ? `${C.yellow}⏸${C.reset}`
      : ' ';

    const dotColor = stationColor(station.id);
    const dot = `${dotColor}●${C.reset}`;
    const sName = isSelected
      ? `${C.bold}${C.white}${station.name.padEnd(16)}${C.reset}`
      : `${station.name.padEnd(16)}`;

    const flacBadge = station.qualities.includes('flac') ? `${C.gold}[FLAC]${C.reset} ` : '';
    const availability = station.liveCheck ? `${C.yellow}LIVE?${C.reset} ` : '';
    const desc = `${C.gray}${station.description}${C.reset}`;

    const lineContent = `  ${cursor} ${playIndicator} ${dot} ${sName} ${flacBadge}${availability}${desc}`;
    const boxed = isSelected
      ? `${C.red}│${C.reset}${C.bgSelect}${padBox(lineContent, W)}${C.reset}${C.red}│${C.reset}`
      : `${C.red}│${C.reset}${padBox(lineContent, W)}${C.red}│${C.reset}`;

    lines.push(boxed);
  });

  // Now Playing Section
  lines.push(`${C.red}├${'─'.repeat(22)} NOW PLAYING ${'─'.repeat(27)}┤${C.reset}`);

  const activeName = state.active?.name || 'Nothing playing';
  const meta = state.metadata ? ` — ${state.metadata}` : '';
  const nowPlayingLine = truncateVisible(`  ${C.bold}${C.white}${activeName}${C.reset}${C.gray}${meta}${C.reset}`, W - 2);
  lines.push(`${C.red}│${C.reset}${padBox(nowPlayingLine, W)}${C.red}│${C.reset}`);

  animTick = (animTick + 1) % VISUALIZER_FRAMES.length;
  const viz = (!state.paused && state.active)
    ? `${C.green}${VISUALIZER_FRAMES[animTick]}${C.reset} `
    : '          ';

  const playStateLabel = state.paused
    ? `${C.yellow}${C.bold}PAUSED${C.reset}`
    : state.active
    ? `${C.green}${C.bold}PLAYING${C.reset}`
    : `${C.gray}READY${C.reset}`;

  const qualityLabel = `${C.cyan}${state.quality.toUpperCase()}${C.reset}`;
  const codecLabel = `${C.gray}${state.codec}${C.reset}`;
  const playerLabel = `${C.gray}${state.playerName || 'no player'}${C.reset}`;

  const statusSub = `  ${viz}${playStateLabel}  ·  ${qualityLabel}  ·  ${codecLabel}  ·  ${playerLabel}`;
  lines.push(`${C.red}│${C.reset}${padBox(statusSub, W)}${C.red}│${C.reset}`);

  const rawStatus = state.status || 'Click a station or use arrows + Enter to play.';
  const livePill = (!state.paused && state.active) ? `${C.red}● LIVE${C.reset} · ` : '';
  const statusLine = truncateVisible(`  ${livePill}${C.dim}${rawStatus}${C.reset}`, W - 2);
  lines.push(`${C.red}│${C.reset}${padBox(statusLine, W)}${C.red}│${C.reset}`);

  // Clickable Control Buttons
  lines.push(`${C.red}├${'─'.repeat(W)}┤${C.reset}`);
  const controlsRow1 = `  ${C.white}[Space]${C.reset} Play/Pause   ${C.white}[F]${C.reset} Quality   ${C.white}[A]${C.reset} Refresh   ${C.white}[S]${C.reset} Study`;
  const controlsRow2 = `  ${C.white}[L]${C.reset} Login   ${C.white}[X]${C.reset} Logout   ${C.white}[Q]${C.reset} Quit   ${C.dim}(Mouse control enabled)${C.reset}`;
  lines.push(`${C.red}│${C.reset}${padBox(controlsRow1, W)}${C.red}│${C.reset}`);
  lines.push(`${C.red}│${C.reset}${padBox(controlsRow2, W)}${C.red}│${C.reset}`);
  lines.push(`${C.red}╰${'─'.repeat(W)}╯${C.reset}`);

  process.stdout.write(`${ESC}2J${ESC}H${lines.join('\n')}\n`);
}

function parseInput(buffer) {
  const input = buffer.toString('utf8');
  if (input === '\u0003') return {type: 'key', key: 'q'};
  if (input === '\x1b[A' || input === 'k') return {type: 'key', key: 'up'};
  if (input === '\x1b[B' || input === 'j') return {type: 'key', key: 'down'};
  if (input === '\x1b[C') return {type: 'key', key: 'right'};
  if (input === '\x1b[D') return {type: 'key', key: 'left'};
  if (input === '\r' || input === '\n' || input === ' ') return {type: 'key', key: input === ' ' ? 'space' : 'enter'};
  if (input.length === 1) return {type: 'key', key: input.toLowerCase()};
  const mouse = input.match(/^\x1b\[<([0-9]+);([0-9]+);([0-9]+)([mM])$/);
  if (mouse) return {type: 'mouse', button: Number(mouse[1]), x: Number(mouse[2]), y: Number(mouse[3]), release: mouse[4] === 'm'};
  return null;
}

async function runTui({stations, onPlay, onQuality, onPause, onStudy, onAccount, onLogin, onLogout, onQuit, onTick, initialAccount = null, initialQuality = 'normal', playerName = null}) {
  return new Promise(resolve => {
    const state = {stations, selected: 0, active: null, metadata: null, quality: initialQuality, codec: 'HE-AAC v2', status: '', account: initialAccount, studyMinutes: null, paused: false, playerName};
    let inputBuffer = '';
    let rendering = false;
    const render = () => { if (!rendering) { rendering = true; draw(state); rendering = false; } };
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

    const timer = setInterval(() => {
      let changed = false;
      if (state.studyMinutes !== null) { state.studyMinutes += 1 / 60; changed = true; }
      if (onTick?.(state)) changed = true;
      // Animate visualizer when active & playing
      if (state.active && !state.paused) changed = true;
      if (changed) render();
    }, 1000);

    const handle = async (event) => {
      if (!event) return;

      // Mouse handling
      if (event.type === 'mouse') {
        // Wheel up / down
        if (event.button === 64) {
          state.selected = Math.max(0, state.selected - 1);
          render();
          return;
        }
        if (event.button === 65) {
          state.selected = Math.min(stations.length - 1, state.selected + 1);
          render();
          return;
        }

        // Left button click release
        if (event.button === 0 && event.release) {
          const y = event.y;
          const x = event.x;

          // 1. Station row clicked (Y=5 to 4 + stations.length)
          if (y >= 5 && y < 5 + stations.length) {
            state.selected = y - 5;
            await onPlay(stations[state.selected], state);
            state.paused = false;
            render();
            return;
          }

          // 2. Now Playing area clicked (toggle pause)
          const nowPlayingStart = 5 + stations.length;
          if (y >= nowPlayingStart && y <= nowPlayingStart + 3) {
            state.paused = await onPause(state);
            render();
            return;
          }

          // 3. Controls Row 1 clicked: [Space] Play/Pause, [F] Quality, [A] Refresh, [S] Study
          const controlsRow1Y = nowPlayingStart + 5;
          if (y === controlsRow1Y) {
            if (x >= 2 && x <= 18) {
              state.paused = await onPause(state);
            } else if (x >= 19 && x <= 32) {
              state.quality = onQuality(state);
            } else if (x >= 33 && x <= 46) {
              state.account = await onAccount(state);
            } else if (x >= 47 && x <= 62) {
              state.studyMinutes = await onStudy(state);
            }
            render();
            return;
          }

          // 4. Controls Row 2 clicked: [L] Login, [X] Logout, [Q] Quit
          const controlsRow2Y = controlsRow1Y + 1;
          if (y === controlsRow2Y) {
            if (x >= 2 && x <= 12) {
              // Login
              pauseInput();
              try {
                state.account = await onLogin(state);
                state.status = 'Signed in. Gold listening enabled.';
              } catch (error) {
                state.status = `Login failed: ${error.message}`;
              } finally {
                resumeInput();
              }
            } else if (x >= 13 && x <= 25) {
              // Logout
              state.account = await onLogout(state);
              state.status = 'Signed out.';
            } else if (x >= 26 && x <= 36) {
              // Quit
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

      // Keyboard handling
      switch (event.key) {
        case 'q': cleanup(); onQuit?.(); return resolve();
        case 'up': state.selected = Math.max(0, state.selected - 1); break;
        case 'down': state.selected = Math.min(stations.length - 1, state.selected + 1); break;
        case 'enter': await onPlay(stations[state.selected], state); state.paused = false; break;
        case 'f': state.quality = onQuality(state); break;
        case 'p':
        case 'space': state.paused = await onPause(state); break;
        case 's': state.studyMinutes = await onStudy(state); break;
        case 'a': state.account = await onAccount(state); break;
        case 'l':
          pauseInput();
          try {
            state.account = await onLogin(state);
            state.status = 'Signed in. Gold listening enabled.';
          } catch (error) {
            state.status = `Login failed: ${error.message}`;
          } finally {
            resumeInput();
          }
          break;
        case 'x': state.account = await onLogout(state); state.status = 'Signed out.'; break;
        default: break;
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

module.exports = {runTui, parseInput};
