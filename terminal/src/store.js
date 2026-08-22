const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function dataDir() {
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'RadioTEDU');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'RadioTEDU');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'radiotedu');
}

function filePath(name) {
  return path.join(dataDir(), name);
}

function readJson(name, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath(name), 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(name, value) {
  fs.mkdirSync(dataDir(), {recursive: true, mode: 0o700});
  const target = filePath(name);
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  try { fs.chmodSync(target, 0o600); } catch {}
}

function loadAuth() { return readJson('auth.json', null); }
function saveAuth(value) { writeJson('auth.json', value); }
function clearAuth() {
  try { fs.unlinkSync(filePath('auth.json')); } catch {}
}
function loadStudy() { return readJson('study.json', null); }
function saveStudy(value) { writeJson('study.json', value); }
function clearStudy() {
  try { fs.unlinkSync(filePath('study.json')); } catch {}
}

module.exports = {dataDir, loadAuth, saveAuth, clearAuth, loadStudy, saveStudy, clearStudy};
