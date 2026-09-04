const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawn, spawnSync} = require('node:child_process');

function probeArgs(command) {
  const lower = String(command || '').toLowerCase();
  if (lower.includes('ffplay')) return ['-version'];
  if (lower.includes('vlc')) return ['--version'];
  return ['--version'];
}

function getWindowsCandidatePaths() {
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const progData = process.env.ProgramData || 'C:\\ProgramData';

  const paths = [
    // WinGet Links symlink folder
    path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'ffplay.exe'),
    path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'mpv.exe'),
    // Chocolatey
    path.join(progData, 'chocolatey', 'bin', 'ffplay.exe'),
    path.join(progData, 'chocolatey', 'bin', 'mpv.exe'),
    // Scoop
    path.join(home, 'scoop', 'shims', 'ffplay.exe'),
    path.join(home, 'scoop', 'shims', 'mpv.exe'),
    // Standard system installations
    'C:\\ffmpeg\\bin\\ffplay.exe',
    path.join(progFiles, 'ffmpeg', 'bin', 'ffplay.exe'),
    path.join(progFilesX86, 'ffmpeg', 'bin', 'ffplay.exe'),
    path.join(progFiles, 'mpv', 'mpv.exe'),
    path.join(progFilesX86, 'mpv', 'mpv.exe'),
    // VideoLAN VLC
    path.join(progFiles, 'VideoLAN', 'VLC', 'vlc.exe'),
    path.join(progFilesX86, 'VideoLAN', 'VLC', 'vlc.exe'),
    // User local tools
    path.join(home, '.radiotedu', 'bin', 'ffplay.exe'),
    path.join(home, '.radiotedu', 'bin', 'mpv.exe'),
  ];

  // Also check WinGet Packages directory in case Links weren't populated yet
  try {
    const wingetPkgs = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(wingetPkgs)) {
      const entries = fs.readdirSync(wingetPkgs);
      for (const entry of entries) {
        if (entry.toLowerCase().includes('ffmpeg')) {
          const subDir = path.join(wingetPkgs, entry);
          const findInDir = (dir, depth = 0) => {
            if (depth > 3) return null;
            try {
              const files = fs.readdirSync(dir, {withFileTypes: true});
              for (const f of files) {
                const full = path.join(dir, f.name);
                if (f.isFile() && (f.name.toLowerCase() === 'ffplay.exe' || f.name.toLowerCase() === 'mpv.exe')) {
                  return full;
                }
                if (f.isDirectory()) {
                  const res = findInDir(full, depth + 1);
                  if (res) return res;
                }
              }
            } catch {}
            return null;
          };
          const found = findInDir(subDir);
          if (found) paths.unshift(found);
        }
      }
    }
  } catch {}

  return paths;
}

function findPlayer(configured = process.env.RADIOTEDU_PLAYER) {
  if (configured) return configured;
  if (process.platform === 'win32') {
    for (const name of ['mpv.com', 'mpv', 'ffplay', 'vlc']) {
      try {
        const where = spawnSync('where.exe', [name], {encoding: 'utf8'});
        if (!where.error && where.stdout) {
          const lines = where.stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          if (lines.length > 0) return lines[0];
        }
      } catch {}
    }
    const winCandidates = getWindowsCandidatePaths();
    for (const candidatePath of winCandidates) {
      try {
        if (fs.existsSync(candidatePath)) return candidatePath;
      } catch {}
    }
  }
  const candidates = process.platform === 'win32' ? ['mpv.com', 'mpv', 'ffplay', 'vlc'] : ['mpv', 'ffplay', 'vlc'];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, probeArgs(candidate), {stdio: 'ignore', shell: false});
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
}

function playerArguments(command, url, title, volume = 80) {
  const lower = String(command || '').toLowerCase();
  if (lower.includes('ffplay')) {
    return ['-nodisp', '-vn', '-hide_banner', '-loglevel', 'error', '-volume', String(volume), url];
  }
  if (lower.includes('vlc')) {
    return ['-I', 'dummy', '--no-video', url];
  }
  return ['--no-video', '--force-window=no', '--input-terminal=yes', `--title=RadioTEDU - ${title}`, `--volume=${volume}`, url];
}

function downloadPortablePlayer() {
  if (process.platform !== 'win32') return null;
  const home = os.homedir();
  const targetDir = path.join(home, '.radiotedu', 'bin');
  const targetExe = path.join(targetDir, 'ffplay.exe');
  if (fs.existsSync(targetExe)) {
    try {
      if (fs.statSync(targetExe).size > 10000000) return targetExe;
    } catch {}
  }

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, {recursive: true});
    }
    const tempExe = path.join(targetDir, `ffplay_${Date.now()}.tmp`);
    const dlScript = `
const https = require('https');
const http = require('http');
const fs = require('fs');

function download(url, dest, cb) {
  const mod = url.startsWith('https:') ? https : http;
  mod.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return download(res.headers.location, dest, cb);
    }
    if (res.statusCode !== 200) {
      return cb(new Error('HTTP ' + res.statusCode));
    }
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => {
      file.close(() => cb(null));
    });
    file.on('error', (err) => {
      try { fs.unlinkSync(dest); } catch {}
      cb(err);
    });
  }).on('error', cb);
}

download('https://radiotedu.com/tui/tools/ffplay.exe', process.argv[1], (err) => {
  if (err) process.exit(1);
  process.exit(0);
});
`;
    const res = spawnSync(process.execPath, ['-e', dlScript, tempExe], {
      windowsHide: true,
      timeout: 120000,
    });
    if (res.status === 0 && fs.existsSync(tempExe) && fs.statSync(tempExe).size > 10000000) {
      if (fs.existsSync(targetExe)) {
        try { fs.unlinkSync(targetExe); } catch {}
      }
      fs.renameSync(tempExe, targetExe);
      return targetExe;
    }
    if (fs.existsSync(tempExe)) {
      try { fs.unlinkSync(tempExe); } catch {}
    }
  } catch {}
  return null;
}


class Player {
  constructor(configured) {
    this.process = null;
    this.command = findPlayer(configured);
    this.last = null;
    this.paused = false;
    this.volume = 80;
    this.lastError = null;
    this.lastExitCode = null;
  }
  launch() {
    if (!this.command || !this.last) return;
    const child = spawn(this.command, playerArguments(this.command, this.last.url, this.last.title, this.volume), {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    this.process = child;
    this.paused = false;
    let stderrBuffer = '';
    child.stderr?.on('data', (chunk) => {
      stderrBuffer = (stderrBuffer + chunk.toString()).slice(-2000);
    });
    child.once('exit', (code) => {
      if (this.process === child) {
        this.process = null;
        if (code !== 0 && code !== null) {
          this.lastExitCode = code;
          if (stderrBuffer.includes('No audio device found') ||
              stderrBuffer.includes('Element not found') ||
              stderrBuffer.includes('WASAPI') ||
              stderrBuffer.includes('DirectSoundCreate8') ||
              stderrBuffer.includes('audio open failed') ||
              stderrBuffer.includes('Unsupported audio format')) {
            this.lastError = new Error('Ses donanımı bulunamadı (ses kartı/hoparlör yok)');
          } else {
            this.lastError = new Error(`Ses motoru kapandı (kod: ${code})`);
          }
          this.onExitError?.(this.lastError);
        }
      }
    });
    child.on('error', (err) => {
      this.lastError = err;
      if (this.process === child) this.process = null;
      this.onExitError?.(err);
    });
  }
  start(url, title) {
    if (!this.command) {
      this.command = downloadPortablePlayer() || findPlayer();
    }
    if (!this.command) throw new Error('No player found. Install mpv (recommended) or ffplay, then run again.');
    this.stop();
    this.last = {url, title};
    this.launch();
  }
  pause() {
    if (!this.last) return false;
    if (this.paused) this.launch();
    else { if (this.process) this.process.kill(); this.process = null; this.paused = true; }
    return this.paused;
  }
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(100, Math.round(vol)));
    if (this.process && !this.paused && this.last) {
      const last = this.last;
      this.stop();
      this.last = last;
      this.launch();
    }
    return this.volume;
  }
  stop() { if (this.process) this.process.kill(); this.process = null; this.last = null; this.paused = false; }
  get playing() { return Boolean(this.process); }
  get name() { return this.command ? this.command.replace(/^.*[\\/]/, '') : null; }
}

module.exports = {Player, findPlayer, playerArguments, probeArgs, getWindowsCandidatePaths, downloadPortablePlayer};

