const {spawn, spawnSync} = require('node:child_process');

function findPlayer() {
  const configured = process.env.RADIOTEDU_PLAYER;
  const candidates = configured ? [configured] : (process.platform === 'win32' ? ['mpv.com', 'mpv', 'ffplay'] : ['mpv', 'ffplay']);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], {stdio: 'ignore', shell: false});
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
}

class Player {
  constructor() { this.process = null; this.command = findPlayer(); }
  start(url, title) {
    if (!this.command) throw new Error('No player found. Install mpv (recommended) or ffplay, then run again.');
    this.stop();
    const args = this.command.toLowerCase().includes('ffplay')
      ? ['-nodisp', '-loglevel', 'warning', url]
      : ['--no-video', '--force-window=no', '--input-terminal=yes', `--title=RadioTEDU - ${title}`, url];
    this.process = spawn(this.command, args, {stdio: ['pipe', 'ignore', 'ignore']});
    this.process.once('exit', () => { this.process = null; });
  }
  sendKey(key) { if (this.process?.stdin?.writable) this.process.stdin.write(key); }
  pause() { this.sendKey('p'); }
  stop() { if (this.process) { this.process.kill(); this.process = null; } }
  get playing() { return Boolean(this.process); }
}

module.exports = {Player, findPlayer};
