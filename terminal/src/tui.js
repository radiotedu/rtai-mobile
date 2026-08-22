const readline = require('node:readline');

const ESC = '\x1b[';

function draw(state) {
  const lines = [];
  lines.push('RadioTEDU  |  terminal player');
  lines.push('────────────────────────────────────────────────────────────');
  lines.push(`Stations  ${state.account ? `· ${state.account}` : '· guest'}${state.studyMinutes !== null ? `  · Study ${state.studyMinutes} min` : ''}`);
  lines.push('');
  state.stations.forEach((station, index) => {
    const selected = index === state.selected ? '›' : ' ';
    const active = state.active?.id === station.id ? '▶' : ' ';
    const meta = state.active?.id === station.id && state.metadata ? ` — ${state.metadata}` : '';
    lines.push(`${selected} ${active} ${station.name.padEnd(20)} ${station.description}${meta}`);
  });
  lines.push('');
  lines.push(`Quality: ${state.quality.toUpperCase()}  ${state.codec}   ${state.status || 'Ready'}`);
  lines.push('');
  lines.push('↑/↓ or mouse wheel select   Enter/click play   f quality   p pause');
  lines.push('s study timer   a account   q quit');
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

async function runTui({stations, onPlay, onQuality, onPause, onStudy, onAccount, onQuit, initialQuality = 'normal'}) {
  return new Promise(resolve => {
    const state = {stations, selected: 0, active: null, metadata: null, quality: initialQuality, codec: 'HE-AAC v1', status: '', account: null, studyMinutes: null};
    let inputBuffer = '';
    let rendering = false;
    const render = () => { if (!rendering) { rendering = true; draw(state); rendering = false; } };
    const cleanup = () => {
      clearInterval(timer);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write(`${ESC}?25h${ESC}?1000l${ESC}?1006l\n`);
    };
    const timer = setInterval(() => {
      if (state.studyMinutes !== null) state.studyMinutes += 1 / 60;
      onTick?.(state);
      render();
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
        case 'enter': await onPlay(stations[state.selected], state); break;
        case 'f': state.quality = onQuality(state); break;
        case 'p': onPause(state); break;
        case 's': state.studyMinutes = await onStudy(state); break;
        case 'a': state.account = await onAccount(state); break;
        default: break;
      }
      render();
    };
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdout.write(`${ESC}?25l${ESC}?1000h${ESC}?1006h`);
    process.stdin.on('data', async chunk => {
      inputBuffer += chunk;
      const parsed = parseInput(inputBuffer);
      if (parsed) { inputBuffer = ''; await handle(parsed); }
      else if (inputBuffer.length > 32) inputBuffer = '';
    });
    render();
  });
}

module.exports = {runTui, parseInput};
