const readline = require('node:readline');

const ESC = '\x1b[';

function draw(state) {
  const lines = [];
  const account = state.account?.label || 'Guest';
  const gold = Number.isInteger(state.account?.gold) ? `  ◆ ${state.account.gold} Gold` : '';
  lines.push('╭──────────────────────────────────────────────────────────────╮');
  lines.push('│  RADIOTEDU TERMINAL                                         │');
  lines.push(`│  ${account}${gold}${state.studyMinutes !== null ? `  · Study ${Math.floor(state.studyMinutes)} min` : ''}`.padEnd(63) + '│');
  lines.push('├──────────────────────────────────────────────────────────────┤');
  lines.push('');
  state.stations.forEach((station, index) => {
    const selected = index === state.selected ? '›' : ' ';
    const active = state.active?.id === station.id ? '▶' : ' ';
    const meta = state.active?.id === station.id && state.metadata ? ` — ${state.metadata}` : '';
    const availability = station.liveCheck ? ' LIVE?' : '';
    lines.push(`${selected} ${active} ${station.name.padEnd(22)} ${station.description}${availability}${meta}`);
  });
  lines.push('');
  lines.push('──────────────────────── NOW PLAYING ─────────────────────────');
  lines.push(`${state.active?.name || 'Nothing playing'}${state.metadata ? ` — ${state.metadata}` : ''}`);
  lines.push(`${state.paused ? 'PAUSED' : state.active ? 'PLAYING' : 'READY'}  ·  ${state.quality.toUpperCase()}  ·  ${state.codec}  ·  ${state.playerName || 'no player'}`);
  lines.push(state.status || 'Choose a station and press Enter.');
  lines.push('');
  lines.push('↑/↓ select   Enter play   Space/P pause   F quality   A refresh');
  lines.push('L login   X logout   S Study   Q quit');
  lines.push('╰──────────────────────────────────────────────────────────────╯');
  process.stdout.write(`${ESC}2J${ESC}H${lines.join('\n')}`);
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
      if (changed) render();
    }, 1000);
    const handle = async (event) => {
      if (!event) return;
      if (event.type === 'mouse') {
        if (event.button === 64) state.selected = Math.max(0, state.selected - 1);
        else if (event.button === 65) state.selected = Math.min(stations.length - 1, state.selected + 1);
        else if (event.button === 0 && event.release && event.y >= 5 && event.y < 5 + stations.length) { state.selected = event.y - 5; await onPlay(stations[state.selected], state); }
        render();
        return;
      }
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
          try { state.account = await onLogin(state); state.status = 'Signed in. Gold listening enabled.'; }
          catch (error) { state.status = `Login failed: ${error.message}`; }
          finally { resumeInput(); }
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
      if (parsed) { inputBuffer = ''; await handle(parsed); }
      else if (inputBuffer.length > 32) inputBuffer = '';
    };
    process.stdin.on('data', dataHandler);
    render();
  });
}

module.exports = {runTui, parseInput};
