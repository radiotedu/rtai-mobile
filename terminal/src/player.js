const {spawn, spawnSync} = require('node:child_process');

function probeArgs(command) {
  return command.toLowerCase().includes('ffplay') ? ['-version'] : ['--version'];
}

function findPlayer(configured = process.env.RADIOTEDU_PLAYER) {
  const candidates = configured ? [configured] : (process.platform === 'win32' ? ['mpv.com', 'mpv', 'ffplay'] : ['mpv', 'ffplay']);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, probeArgs(candidate), {stdio: 'ignore', shell: false});
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
}

function playerArguments(command, url, title, volume = 80) {
  return command.toLowerCase().includes('ffplay')
    ? ['-nodisp', '-vn', '-hide_banner', '-loglevel', 'error', '-volume', String(volume), url]
    : ['--no-video', '--force-window=no', '--input-terminal=yes', `--title=RadioTEDU - ${title}`, `--volume=${volume}`, url];
}

class Player {
  constructor(configured) {
    this.process = null;
    this.command = findPlayer(configured);
    this.last = null;
    this.paused = false;
    this.volume = 80;
  }
  launch() {
    const child = spawn(this.command, playerArguments(this.command, this.last.url, this.last.title, this.volume), {stdio: ['pipe', 'ignore', 'ignore']});
    this.process = child;
    this.paused = false;
    child.once('exit', () => { if (this.process === child) this.process = null; });
  }
  start(url, title) {
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

module.exports = {Player, findPlayer, playerArguments, probeArgs};
