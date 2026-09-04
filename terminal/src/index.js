#!/usr/bin/env node
const readline = require('node:readline');
const crypto = require('node:crypto');
const {execFile} = require('node:child_process');
const {STATIONS, getStation, streamUrl, codecFor, listStations} = require('./stations');
const {loadAuth, saveStudy, loadStudy, clearStudy} = require('./store');
const {login, me, gamificationHome, logout, startErpLogin, validateAuthorizationUrl, exchangeErpCode, verifyPairCode, initDeviceAuth, pollDeviceAuth, startStudySession, heartbeatStudySession, finishStudySession} = require('./api');
const {beginPendingErpLoginPkce, getPendingErpLoginPkce, clearPendingErpLoginPkce} = require('./pkce');
const {readIcecastMetadata, isLive} = require('./metadata');

function extractErpCode(callbackOrCode) {
  const input = String(callbackOrCode || '').trim();
  if (!input) throw new Error('Callback URL did not contain erp_code.');
  if (!input.includes('://') && !input.includes('erp_code=') && !input.includes('code=')) return input;
  let code = '';
  let status = '';
  try {
    const url = new URL(input);
    code = url.searchParams.get('erp_code') || url.searchParams.get('code') || '';
    status = url.searchParams.get('erp_status') || '';
  } catch {
    const match = input.match(/erp_code=([^&\s]+)/) || input.match(/code=([^&\s]+)/);
    if (match) code = decodeURIComponent(match[1]);
  }
  if (!code) throw new Error('Callback URL did not contain erp_code.');
  if (status && status !== 'success') throw new Error(`ERP login callback reported status: ${status}.`);
  return code;
}
const {Player, downloadPortablePlayer} = require('./player');
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
  return new Promise((resolve) => {
    try {
      if (process.platform === 'win32') {
        execFile('cmd.exe', ['/c', 'start', '""', url], (err) => {
          if (err) {
            execFile('rundll32', ['url.dll,FileProtocolHandler', url], () => resolve());
          } else {
            resolve();
          }
        });
      } else if (process.platform === 'darwin') {
        execFile('open', [url], () => resolve());
      } else {
        execFile('xdg-open', [url], () => resolve());
      }
    } catch {
      resolve();
    }
  });
}

async function commandLogin(args) {
  const codeArg = args.find(arg => arg.startsWith('--code='));
  const codeIdx = args.indexOf('--code');
  const directCode = codeArg ? codeArg.split('=')[1] : (codeIdx !== -1 && args[codeIdx + 1] ? args[codeIdx + 1] : null);
  if (directCode) {
    const user = await verifyPairCode(directCode);
    console.log(`Signed in as ${user.display_name || user.email || 'RadioTEDU user'} via device pairing.`);
    return user;
  }

  if (args.includes('--pair') || args.includes('--device')) {
    console.log('Opening https://radiotedu.com/erp/device in browser…');
    openExternal('https://radiotedu.com/erp/device');
    const inputCode = await prompt('Enter 8-character pairing code (e.g. AAAA-BBBB): ');
    const user = await verifyPairCode(inputCode);
    console.log(`Signed in as ${user.display_name || user.email || 'RadioTEDU user'} via device pairing.`);
    return user;
  }

  if (args.includes('--tedu')) {
    const returnUri = 'radiotedu://auth/erp/linked';
    const pkce = beginPendingErpLoginPkce();
    let result;
    try {
      result = await startErpLogin(returnUri, pkce);
    } catch (err) {
      clearPendingErpLoginPkce(pkce.verifier);
      throw err;
    }
    if (!result?.authorization_url) {
      clearPendingErpLoginPkce(pkce.verifier);
      throw new Error('ERP login endpoint did not return an authorization URL.');
    }
    let authorizationUrl;
    try {
      authorizationUrl = validateAuthorizationUrl(result.authorization_url);
    } catch (err) {
      clearPendingErpLoginPkce(pkce.verifier);
      throw err;
    }
    console.log('Opening TEDÜ/ERP login in browser…'); openExternal(authorizationUrl);
    const callback = await prompt('Paste the final RadioTEDU callback URL: ');
    const code = extractErpCode(callback);
    try {
      const user = await exchangeErpCode(code, pkce.verifier);
      clearPendingErpLoginPkce(pkce.verifier);
      console.log(`Signed in as ${user.display_name || 'RadioTEDU user'}.`);
      return user;
    } catch (err) {
      clearPendingErpLoginPkce(pkce.verifier);
      throw err;
    }
  }
  if (args.includes('--web') || args.includes('--flow') || (!args.length && !args.includes('--pair') && !args.includes('--tedu') && !args.includes('--creds'))) {
    process.stdout.write('\n=== RadioTEDU Sign In ===\n');
    process.stdout.write('[1] 🌐 Web ile Oturum Aç (Otomatik Onay / GitHub CLI Stili) [Önerilen]\n');
    process.stdout.write('[2] 📧 RadioTEDU Hesabı (E-Posta & Şifre)\n');
    process.stdout.write('[3] 🏛️ TEDÜ / ERP Manuel Kod (radiotedu.com/erp/device)\n');
    process.stdout.write('[4] 🏛️ TEDÜ / ERP SSO (Browser Login)\n');
    const choice = await prompt('Seçiminiz [1/2/3/4] (varsayılan 1): ');

    if (!choice || choice === '1') {
      const initData = await initDeviceAuth();
      console.log(`\n! Oturum Onay Kodu: \x1b[1;32m${initData.userCode}\x1b[0m`);
      console.log(`! Onay sayfası tarayıcınızda açılıyor: \x1b[36m${initData.verificationUrl}\x1b[0m`);
      console.log('Tarayıcınızda "Onayla" butonuna bastığınızda terminal otomatik bağlanacaktır...\n');
      openExternal(initData.verificationUrl);

      process.stdout.write('⏳ Tarayıcıda onay bekleniyor (iptal için Ctrl+C)...');
      while (true) {
        await new Promise(r => setTimeout(r, (initData.interval || 2) * 1000));
        const poll = await pollDeviceAuth(initData.deviceToken);
        if (poll.status === 'approved') {
          const name = poll.user?.display_name || poll.user?.email || 'RadioTEDU Kullanıcısı';
          console.log(`\n✅ Başarıyla giriş yapıldı: ${name}!`);
          return poll.user;
        }
        if (poll.status === 'denied') {
          console.log('\n❌ Oturum isteği tarayıcıda reddedildi.');
          return null;
        }
        if (poll.status === 'expired') {
          console.log('\n❌ Oturum onay süresi doldu.');
          return null;
        }
        process.stdout.write('.');
      }
    }
    if (choice === '3') {
      return commandLogin(['--pair']);
    }
    if (choice === '4') {
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
  if (!player.command && process.platform === 'win32') {
    const downloaded = downloadPortablePlayer();
    if (downloaded) {
      player.command = downloaded;
    }
  }
  let activeStation = null;
  let quality = 'normal';
  let metadataTimer = null;
  let activeState = null;
  const ensureAudioEngine = (state) => {
    if (player.command) return player.command;
    if (process.platform === 'win32') {
      if (state) {
        state.status = 'Ses motoru (ffplay) hazırlanıyor...';
        state.requestRender?.();
      }
      const exe = downloadPortablePlayer((msg) => {
        if (state) {
          state.status = msg;
          if (state.modal) state.modal.status = msg;
          state.requestRender?.();
        }
      });
      if (exe) {
        player.command = exe;
        if (state) {
          state.playerName = player.name;
          state.status = 'Ses motoru hazır';
          state.requestRender?.();
        }
        return exe;
      }
    }
    return null;
  };
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
  player.onExitError = (err) => {
    if (activeState) {
      activeState.status = `⚠️ ${err.message}`;
      activeState.requestRender?.();
    }
  };
  await runTui({
    stations: listStations(),
    initialQuality: quality,
    initialAccount: await accountSummary().catch(() => ({label: 'Guest', gold: null})),
    playerName: player.name,
    autoPlay: false,
    onEnsureAudio: ensureAudioEngine,
    onPlay: async (station, state) => {
      activeState = state;
      if (!station.qualities.includes(quality)) quality = 'normal';
      const url = streamUrl(station, quality);
      if (station.liveCheck && !(await isLive(url))) { state.status = 'Station is not currently live.'; return; }
      if (quality === 'flac') state.status = 'FLAC selected · confirm data plan';
      if (metadataTimer) clearInterval(metadataTimer);
      gold.stop();
      if (!player.command) {
        if (state) {
          state.status = 'Downloading portable audio engine (ffplay)...';
          state.requestRender?.();
        }
        ensureAudioEngine(state);
      }
      try {
        player.start(url, station.name);
      } catch (err) {
        state.status = `Audio error: ${err.message}`;
        if (!player.command) {
          state.modal = {type: 'audio_engine_missing'};
        }
        state.requestRender?.();
        return;
      }
      activeStation = station;
      state.active = station;
      state.playerName = player.name;
      state.streamStartedAt = Date.now();
      state.streamElapsedBeforePause = 0;
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
      state.quality = quality;
      state.status = `Quality: ${quality.toUpperCase()}`;
      if (state.active) {
        state.codec = codecFor(quality, state.active);
        const url = streamUrl(state.active, quality);
        try { player.start(url, state.active.name); } catch {}
      }
      return quality;
    },
    onPause: async state => {
      const paused = player.pause();
      state.paused = paused;
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
    onLoginPairStart: async () => {
      await openExternal('https://radiotedu.com/erp/device');
    },
    onLoginPairCode: async (code) => {
      await verifyPairCode(code);
      return accountSummary();
    },
    onLoginDeviceStart: async () => {
      const initData = await initDeviceAuth();
      try {
        await openExternal(initData.verificationUrl);
      } catch (err) {}
      return initData;
    },
    onLoginDevicePoll: async (deviceToken) => {
      const poll = await pollDeviceAuth(deviceToken);
      if (poll.status === 'approved') {
        const acc = await accountSummary().catch(() => ({
          label: poll.user?.display_name || poll.user?.email || 'RadioTEDU Member',
          gold: poll.user?.gold_balance || 0,
        }));
        return {status: 'approved', user: acc};
      }
      return poll;
    },
    onOpenExternal: async (url) => {
      await openExternal(url);
    },
    onLogout: async () => { gold.stop(); await logout(); return {label: 'Guest', gold: null}; },
    onQuit: () => { if (metadataTimer) clearInterval(metadataTimer); gold.stop(); player.stop(); },
    onTick: state => { activeState = state; },
  });
}

async function commandSetupAudio() {
  console.log('\n📻 RadioTEDU Audio Engine Setup\n');
  const player = new Player();
  if (player.command) {
    console.log(`✅ Audio decoder is already available: ${player.command}`);
    console.log(`   Engine: ${player.name}`);
    console.log('   You can start listening immediately with: radiotedu\n');
    return;
  }
  console.log('⚠️ No audio decoder (ffplay/mpv/vlc) was found on your system PATH.\n');
  if (process.platform === 'win32') {
    console.log('[*] Downloading portable RadioTEDU audio engine (ffplay)...');
    const exe = downloadPortablePlayer();
    if (exe) {
      console.log(`\n✅ Portable audio engine installed successfully!`);
      console.log(`   Path: ${exe}`);
      console.log('   Run "radiotedu" to start listening to live radio streams.\n');
      return;
    }
    console.log('Checking for Windows Package Manager (winget)...');
    try {
      const {spawnSync} = require('node:child_process');
      const probeWinget = spawnSync('winget', ['--version'], {encoding: 'utf8'});
      if (!probeWinget.error && probeWinget.status === 0) {
        console.log(`[+] Detected winget ${probeWinget.stdout.trim()}`);
        console.log('[*] Installing Gyan.FFmpeg via winget...');
        const inst = spawnSync('winget', ['install', 'Gyan.FFmpeg', '--accept-package-agreements', '--accept-source-agreements'], {stdio: 'inherit'});
        if (inst.status === 0) {
          console.log('\n✅ FFmpeg successfully installed! Run "radiotedu" to start listening.\n');
          return;
        }
      }
    } catch (err) {
      console.log(`[!] winget automated install: ${err.message}`);
    }
    console.log('To install an audio decoder manually on Windows, run one of the following:');
    console.log('  winget install Gyan.FFmpeg');
    console.log('  winget install mpv.mpv');
    console.log('  choco install ffmpeg\n');
  } else if (process.platform === 'darwin') {
    console.log('To install an audio decoder on macOS, run:');
    console.log('  brew install mpv\n');
  } else {
    console.log('To install an audio decoder on Linux, run:');
    console.log('  sudo apt install mpv   (Ubuntu/Debian)');
    console.log('  sudo pacman -S mpv     (Arch)\n');
  }
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
  if (command === 'setup-audio' || command === 'audio') return commandSetupAudio();
  if (command === 'help') return console.log('radiotedu [stations|play|login [--code=AAAA-BBBB|--pair|--tedu]|logout|account|gold|study|setup-audio]');
  throw new Error(`Unknown command: ${command}`);
}

main().catch(error => { console.error(`RadioTEDU: ${error.message}`); process.exitCode = 1; });
