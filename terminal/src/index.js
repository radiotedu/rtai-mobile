#!/usr/bin/env node
const readline = require('node:readline');
const crypto = require('node:crypto');
const {execFile} = require('node:child_process');
const {STATIONS, getStation, streamUrl, codecFor, listStations} = require('./stations');
const {loadAuth, saveStudy, loadStudy, clearStudy} = require('./store');
const {login, me, logout, startErpLogin, exchangeErpCode, startStudySession, heartbeatStudySession, finishStudySession} = require('./api');
const {readIcecastMetadata, isLive} = require('./metadata');
const {Player} = require('./player');
const {runTui} = require('./tui');

function prompt(question) {
  return new Promise(resolve => { const rl = readline.createInterface({input: process.stdin, output: process.stdout}); rl.question(question, answer => { rl.close(); resolve(answer.trim()); }); });
}

function secretPrompt(question) {
  return new Promise(resolve => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode?.(true); stdin.resume();
    let value = '';
    const onData = chunk => {
      const key = chunk.toString();
      if (key === '\r' || key === '\n') { stdin.setRawMode?.(wasRaw || false); stdin.removeListener('data', onData); process.stdout.write('\n'); resolve(value); }
      else if (key === '\u0003') { stdin.setRawMode?.(wasRaw || false); stdin.removeListener('data', onData); process.stdout.write('\n'); resolve(''); }
      else if (key === '\u007f') value = value.slice(0, -1);
      else if (!key.startsWith('\x1b')) { value += key; process.stdout.write('*'); }
    };
    stdin.on('data', onData);
  });
}

function openExternal(url) {
  const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  execFile(command, args, () => {});
}

async function commandLogin(args) {
  if (args.includes('--tedu')) {
    const returnUri = 'radiotedu://auth/erp/linked';
    const result = await startErpLogin(returnUri);
    if (!result?.authorization_url) throw new Error('ERP login endpoint did not return an authorization URL.');
    console.log('Opening TEDÜ/ERP login in browser…'); openExternal(result.authorization_url);
    const callback = await prompt('Paste the final RadioTEDU callback URL: ');
    const url = new URL(callback);
    const code = url.searchParams.get('erp_code');
    if (!code) throw new Error('Callback URL did not contain erp_code.');
    console.log(`Signed in as ${(await exchangeErpCode(code)).display_name || 'RadioTEDU user'}.`);
    return;
  }
  const email = await prompt('Email: ');
  const password = await secretPrompt('Password: ');
  const user = await login(email, password);
  console.log(`Signed in as ${user?.display_name || user?.email || 'RadioTEDU user'}.`);
}

async function commandPlay(args) {
  const station = getStation(args[0]);
  const qualityArg = args.find(arg => arg.startsWith('--quality='));
  const quality = qualityArg ? qualityArg.split('=')[1] : 'normal';
  if (quality === 'flac' && !args.includes('--allow-metered')) {
    const answer = await prompt('FLAC may use substantial data. Continue? [y/N] ');
    if (answer.toLowerCase() !== 'y') return;
  }
  const url = streamUrl(station, quality);
  const player = new Player();
  player.start(url, station.name);
  console.log(`Playing ${station.name} · ${quality.toUpperCase()} · ${codecFor(quality)}`);
  let stopped = false;
  const update = async () => {
    const metadata = await readIcecastMetadata(url);
    if (metadata.title) process.stdout.write(`\r${station.name} — ${metadata.title}                                      `);
  };
  await update();
  const timer = setInterval(update, 30000);
  const stop = () => { if (stopped) return; stopped = true; clearInterval(timer); player.stop(); process.stdout.write('\n'); process.exitCode = 0; };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  await new Promise(resolve => { const wait = setInterval(() => { if (!player.playing) { clearInterval(wait); resolve(); } }, 500); });
  stop();
}

async function commandStudy(args) {
  const action = args[0] || 'status';
  if (action === 'status') {
    const current = loadStudy();
    if (!current) return console.log('No active Study session.');
    const minutes = Math.floor((Date.now() - current.startedAt) / 60000);
    return console.log(`Study · ${current.location} · ${minutes} minute${minutes === 1 ? '' : 's'} elapsed`);
  }
  if (action === 'stop' || action === 'finish') {
    const current = loadStudy();
    if (!current) return console.log('No active Study session.');
    await finishStudySession(current.id, current.nonce);
    clearStudy();
    return console.log(`Study finished · ${Math.floor((Date.now() - current.startedAt) / 60000)} minutes`);
  }
  if (action !== 'start') throw new Error('Use: radiotedu study start [library|chim-alan] [minutes], stop, or status.');
  if (!loadAuth()?.access_token) throw new Error('Sign in first with "radiotedu login".');
  if (loadStudy()) throw new Error('A Study session is already active. Use "radiotedu study stop".');
  const location = args[1] || 'library';
  const targetMinutes = Number(args[2] || 0) || undefined;
  const clientSessionId = crypto.randomUUID();
  const result = await startStudySession(location, clientSessionId, targetMinutes);
  const session = result.session || result;
  const current = {id: session.id, nonce: result.nonce || '', location, startedAt: Date.now(), lastHeartbeat: Date.now()};
  saveStudy(current);
  console.log(`Study started · ${location}${targetMinutes ? ` · target ${targetMinutes} minutes` : ''}`);
  const heartbeat = setInterval(async () => {
    const now = Date.now(); const delta = Math.floor((now - current.lastHeartbeat) / 1000); current.lastHeartbeat = now; saveStudy(current);
    try { await heartbeatStudySession(current.id, current.nonce, delta); } catch (error) { process.stderr.write(`\nHeartbeat warning: ${error.message}\n`); }
  }, 30000);
  const display = setInterval(() => process.stdout.write(`\rStudy · ${Math.floor((Date.now() - current.startedAt) / 60000)} minutes elapsed`), 1000);
  await new Promise(resolve => { const stop = async () => { clearInterval(heartbeat); clearInterval(display); process.off('SIGINT', stop); try { await finishStudySession(current.id, current.nonce); } finally { clearStudy(); process.stdout.write('\nStudy finished.\n'); resolve(); } }; process.once('SIGINT', stop); });
}

async function runInteractive() {
  const player = new Player();
  let activeStation = null;
  let quality = 'normal';
  let metadataTimer = null;
  await runTui({
    stations: listStations(),
    initialQuality: quality,
    onPlay: async (station, state) => {
      if (quality === 'flac' && !station.flac) quality = 'normal';
      const url = streamUrl(station, quality);
      if (station.liveCheck && !(await isLive(url))) { state.status = 'Station is not currently live.'; return; }
      if (quality === 'flac') state.status = 'FLAC selected · confirm data plan';
      if (metadataTimer) clearInterval(metadataTimer);
      player.start(url, station.name); activeStation = station; state.active = station; state.codec = codecFor(quality); state.metadata = (await readIcecastMetadata(url)).title || null; state.status = `Playing ${quality.toUpperCase()}`;
      metadataTimer = setInterval(async () => { if (state.active?.id === station.id) state.metadata = (await readIcecastMetadata(url)).title || state.metadata; }, 30000);
    },
    onQuality: state => {
      const station = activeStation || state.stations[state.selected];
      const choices = station.flac ? ['normal', 'low', 'flac'] : ['normal', 'low'];
      quality = choices[(choices.indexOf(quality) + 1) % choices.length];
      state.codec = codecFor(quality); return quality;
    },
    onPause: () => player.pause(),
    onStudy: async state => { const current = loadStudy(); return current ? Math.floor((Date.now() - current.startedAt) / 60000) : null; },
    onAccount: async () => { try { const user = await me(); return user?.display_name || user?.email || 'signed in'; } catch { return 'guest'; } },
    onQuit: () => { if (metadataTimer) clearInterval(metadataTimer); player.stop(); },
    onTick: () => {},
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) return runInteractive();
  const [command, ...rest] = args;
  if (command === '--version' || command === '-v') return console.log('RadioTEDU terminal 0.1.0');
  if (command === 'stations') return rest.includes('--json') ? console.log(JSON.stringify(listStations(), null, 2)) : listStations().forEach(item => console.log(`${item.id.padEnd(8)} ${item.name.padEnd(22)} ${item.qualities.join(', ')}`));
  if (command === 'login') return commandLogin(rest);
  if (command === 'logout') { await logout(); return console.log('Signed out.'); }
  if (command === 'account') return console.log(JSON.stringify(await me(), null, 2));
  if (command === 'play') return commandPlay(rest);
  if (command === 'study') return commandStudy(rest);
  if (command === 'help') return console.log('radiotedu [stations|play|login|logout|account|study]');
  throw new Error(`Unknown command: ${command}`);
}

main().catch(error => { console.error(`RadioTEDU: ${error.message}`); process.exitCode = 1; });
