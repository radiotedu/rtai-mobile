#!/usr/bin/env node
/** Capture a real RadioTEDU screen from an attached Android device/emulator.
 * This intentionally has no mock/synthetic rendering path.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const [apk, component, output, claim = path.basename(output ?? 'capture')] = process.argv.slice(2);
if (!apk || !component || !output) {
  console.error('Usage: node scripts/capture-android-store-screenshot.mjs <apk> <package/.Activity> <output.png> <claim>');
  process.exit(2);
}

const adb = process.env.ADB ?? 'adb';
const run = (args, options = {}) => execFileSync(adb, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options}).trim();
const devices = run(['devices']).split(/\r?\n/).slice(1).filter(line => /\tdevice$/.test(line));
if (devices.length !== 1) {
  throw new Error(`Expected exactly one ready Android device; found ${devices.length}. Refusing to fabricate a capture.`);
}

fs.mkdirSync(path.dirname(output), {recursive: true});
run(['install', '-r', apk]);
run(['shell', 'input', 'keyevent', '82']);
run(['shell', 'wm', 'dismiss-keyguard']);
run(['shell', 'am', 'force-stop', component.split('/')[0]]);
run(['shell', 'am', 'start', '-W', '-n', component]);
await new Promise(resolve => setTimeout(resolve, 15000));
const png = execFileSync(adb, ['exec-out', 'screencap', '-p']);
if (png.length < 100) throw new Error('ADB returned an empty screenshot.');
fs.writeFileSync(output, png);

// PNG IHDR stores width/height at byte offsets 16 and 20.
if (png.readUInt32BE(16) !== 1080 || png.readUInt32BE(20) !== 1920) {
  throw new Error(`Store capture must be 1080x1920; got ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}.`);
}
const manifestPath = path.join(path.dirname(output), 'evidence-manifest.json');
const existing = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {captures: []};
// Host-side hash avoids trusting a device shell implementation.
const crypto = await import('node:crypto');
existing.captures.push({claim, file: path.basename(output), width: 1080, height: 1920, sha256: crypto.createHash('sha256').update(png).digest('hex'), source: 'adb screencap', apk: path.resolve(apk), component});
fs.writeFileSync(manifestPath, `${JSON.stringify(existing, null, 2)}\n`);
console.log(`Captured real 1080x1920 screen: ${output}`);
