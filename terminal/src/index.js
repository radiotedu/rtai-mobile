#!/usr/bin/env node
const readline = require('node:readline');
const crypto = require('node:crypto');
const {execFile} = require('node:child_process');
const {STATIONS, getStation, streamUrl, codecFor, listStations} = require('./stations');
const {loadAuth, saveStudy, loadStudy, clearStudy} = require('./store');
const {login, me, gamificationHome, logout, startErpLogin, exchangeErpCode, startStudySession, heartbeatStudySession, finishStudySession} = require('./api');
const {readIcecastMetadata, isLive} = require('./metadata');
const {Player} = require('./player');
const {ListeningGold} = require('./gold');
const {runTui} = require('./tui');
const {version} = require('../package.json');

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
      else if (key === '\u007f' || key === '\b') value = value.slice(0, -1);
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
    const user = await exchangeErpCode(code);
    console.log(`Signed in as ${user.display_name || 'RadioTEDU user'}.`);
    return user;
  }
  if (!args.length) {
    process.stdout.write('\n=== RadioTEDU Sign In ===\n[1] RadioTEDU Account (Email & Password)\n[2] TEDÜ / ERP SSO (Browser Login)\n');
    const choice = await prompt('Select login method [1/2] (default 1): ');
    if (choice === '2') {
      return commandLogin(['--tedu']);
    }
  }
  const email = await prompt('Email: ');
  const password = await secretPrompt('Password: ');
  const user = await login(email, password);
  console.log(`Signed in as ${user?.display_name || user?.email || 'RadioTEDU user'}.`);
  return user;
}

async function accountSummary() {
  if (!loadAuth()?.access_token) return {label: 'Guest', gold: null};
  const [user, home] = await Promise.all([me(), gamificationHome()]);
  return {label: user?.display_name || user?.email || 'RadioTEDU user', gold: Number(home?.points?.spendable_points ?? 0)};
}

async function commandPlay(args) {
  const station = getStation(args[0]);
  const qualityArg = args.find(arg => arg.startsWith('--quality='));
  const playerArg = args.find(arg => arg.startsWith('--player='));
  const quality = qualityArg ? qualityArg.split('=')[1] : 'normal';
  if (quality === 'flac' && !args.includes('--allow-metered')) {
    const answer = await prompt('FLAC may use substantial data. Continue? [y/N] ');
    if (answer.toLowerCase() !== 'y') return;
  }
  const url = streamUrl(station, quality);
  if (station.liveCheck && !(await isLive(url))) throw new Error(`${station.name} is not currently live.`);
  const player = new Player(playerArg?.split('=')[1]);
  const gold = new ListeningGold({
    isPlaying: () => player.playing,
    onUpdate: ({reward, balance, error}) => {
      if (error) return process.stderr.write(`\nGold heartbeat warning: ${error.message}\n`);
      if (reward?.applied) process.stdout.write(`\n+${reward.awarded} Gold${balance !== null ? ` · balance ${balance}` : ''}\n`);
    },
  });
  player.start(url, station.name);
  await gold.start(station.goldId || station.id).catch(() => false);
  console.log(`Playing ${station.name} · ${quality.toUpperCase()} · ${codecFor(quality, station)} · ${player.name}`);
  let stopped = false;
  const update = async () => {
    const metadata = await readIcecastMetadata(url);
    if (metadata.title) process.stdout.write(`\r${station.name} — ${metadata.title}                                      `);
  };
  await update();
  const timer = setInterval(update, 30000);
  const stop = () => { if (stopped) return; stopped = true; clearInterval(timer); gold.stop(); player.stop(); process.stdout.write('\n'); process.exitCode = 0; };
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
  let activeState = null;
  const gold = new ListeningGold({
    isPlaying: () => player.playing,
    onUpdate: ({reward, balance, error}) => {
      if (!activeState) return;
      if (error) { activeState.status = `Gold sync warning: ${error.message}`; activeState.requestRender?.(); return; }
      if (balance !== null && activeState.account) activeState.account.gold = balance;
      if (reward?.applied) activeState.status = `+${reward.awarded} Gold earned by listening`;
      activeState.requestRender?.();
    },
  });
  await runTui({
    stations: listStations(),
    initialQuality: quality,
    initialAccount: await accountSummary().catch(() => ({label: 'Guest', gold: null})),
    playerName: player.name,
    autoPlay: true,
    onPlay: async (station, state) => {
      activeState = state;
      if (!station.qualities.includes(quality)) quality = 'normal';
      const url = streamUrl(station, quality);
      if (station.liveCheck && !(await isLive(url))) { state.status = 'Station is not currently live.'; return; }
      if (quality === 'flac') state.status = 'FLAC selected · confirm data plan';
      if (metadataTimer) clearInterval(metadataTimer);
      gold.stop();
      try {
        player.start(url, station.name);
      } catch (err) {
        state.status = `Audio error: ${err.message}`;
        state.requestRender?.();
        return;
      }
      activeStation = station;
      state.active = station;
      state.codec = codecFor(quality, station);
      state.status = `Playing ${station.name} (${quality.toUpperCase()})`;
      state.requestRender?.();

      readIcecastMetadata(url).then(meta => {
        if (state.active?.id === station.id && meta?.title) {
          state.metadata = meta.title;
          state.requestRender?.();
        }
      }).catch(() => {});

      await gold.start(station.goldId || station.id).catch(() => { state.status += ' · sign in to earn Gold'; });
      metadataTimer = setInterval(async () => {
        if (state.active?.id === station.id) {
          const meta = await readIcecastMetadata(url);
          if (meta?.title) {
            state.metadata = meta.title;
            state.requestRender?.();
          }
        }
      }, 30000);
    },
    onQuality: state => {
      const station = activeStation || state.stations[state.selected];
      const choices = station.qualities;
      quality = choices[(choices.indexOf(quality) + 1) % choices.length];
      state.codec = codecFor(quality, station); return quality;
    },
    onPause: async state => {
      if (!state.active) {
        const station = state.stations[state.selected] || state.stations[0];
        if (station) {
          await activeState?.onPlay?.(station, state);
          state.paused = false;
          return false;
        }
      }
      const paused = player.pause();
      gold.stop();
      if (!paused && activeStation) await gold.start(activeStation.goldId || activeStation.id).catch(() => false);
      state.status = paused ? 'Paused' : 'Playback resumed';
      return paused;
    },
    onVolume: (delta, state) => {
      const newVol = player.setVolume((player.volume || 80) + delta);
      state.status = `Volume: ${newVol}%`;
      return newVol;
    },
    onSetVolume: (vol, state) => {
      const newVol = player.setVolume(vol);
      state.status = `Volume: ${newVol}%`;
      return newVol;
    },
    onStudy: async state => { const current = loadStudy(); return current ? Math.floor((Date.now() - current.startedAt) / 60000) : null; },
    onAccount: async () => accountSummary().catch(() => ({label: 'Guest', gold: null})),
    onLogin: async () => { await commandLogin([]); return accountSummary(); },
    onLoginCreds: async (email, password) => {
      await login(email, password);
      return accountSummary();
    },
    onLoginSsoStart: async () => {
      const returnUri = 'radiotedu://auth/erp/linked';
      const result = await startErpLogin(returnUri);
      if (!result?.authorization_url) throw new Error('ERP login endpoint did not return an authorization URL.');
      openExternal(result.authorization_url);
      return result.authorization_url;
    },
    onLoginSsoExchange: async (callbackOrCode) => {
      let code = callbackOrCode?.trim();
      if (code && code.includes('erp_code=')) {
        try {
          const url = new URL(code);
          code = url.searchParams.get('erp_code') || code;
        } catch {
          const match = code.match(/erp_code=([^&]+)/);
          if (match) code = match[1];
        }
      }
      if (!code) throw new Error('Callback URL did not contain erp_code.');
      await exchangeErpCode(code);
      return accountSummary();
    },
    onLogout: async () => { gold.stop(); await logout(); return {label: 'Guest', gold: null}; },
    onQuit: () => { if (metadataTimer) clearInterval(metadataTimer); gold.stop(); player.stop(); },
    onTick: state => { activeState = state; },
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) return runInteractive();
  const [command, ...rest] = args;
  if (command === '--version' || command === '-v') return console.log(`RadioTEDU terminal ${version}`);
  if (command === 'stations') return rest.includes('--json') ? console.log(JSON.stringify(listStations(), null, 2)) : listStations().forEach(item => console.log(`${item.id.padEnd(8)} ${item.name.padEnd(22)} ${item.qualities.join(', ')}`));
  if (command === 'login') return commandLogin(rest);
  if (command === 'logout') { await logout(); return console.log('Signed out.'); }
  if (command === 'account' || command === 'gold') return console.log(JSON.stringify(await accountSummary(), null, 2));
  if (command === 'play') return commandPlay(rest);
  if (command === 'study') return commandStudy(rest);
  if (command === 'help') return console.log('radiotedu [stations|play|login|logout|account|gold|study]');
  throw new Error(`Unknown command: ${command}`);
}

main().catch(error => { console.error(`RadioTEDU: ${error.message}`); process.exitCode = 1; });
