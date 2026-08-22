#!/usr/bin/env node
/**
 * Immutable Google Play screenshot evidence capture.
 * prepare installs one exact APK; capture records the visible real screen;
 * seal hashes the raw manifest before any marketing composition.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const command = process.argv[2];
const argv = process.argv.slice(3);

function parseArgs(values) {
  const out = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) throw new Error(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      index += 1;
    }
  }
  return out;
}

const args = parseArgs(argv);
const adb = process.env.ADB ?? 'adb';
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) =>
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {flag: 'wx'});

function run(binary, values, options = {}) {
  return execFileSync(binary, values, {
    encoding: options.binary ? undefined : 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
  });
}

function devices() {
  return String(run(adb, ['devices']))
    .split(/\r?\n/)
    .slice(1)
    .filter(line => /\tdevice$/.test(line))
    .map(line => line.split('\t')[0]);
}

function resolveSerial(requested) {
  const ready = devices();
  if (requested) {
    if (!ready.includes(requested)) throw new Error(`Android device is not ready: ${requested}`);
    return requested;
  }
  if (ready.length !== 1) throw new Error(`Pass --serial; found ${ready.length} ready devices.`);
  return ready[0];
}

function adbRun(serial, values, options = {}) {
  return run(adb, ['-s', serial, ...values], options);
}

function required(name) {
  const value = args[name];
  if (!value || value === true) throw new Error(`Missing --${name}`);
  return String(value);
}

function git(values) {
  return String(run('git', values)).trim();
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function normalizeComponent(component) {
  const [packageName, activity, extra] = String(component).split('/');
  if (!packageName || !activity || extra !== undefined) {
    throw new Error(`Invalid Android component: ${component}`);
  }
  const activityName = activity.startsWith('.') ? `${packageName}${activity}` : activity;
  return `${packageName}/${activityName}`;
}

function resolveComponent(serial, component) {
  const output = String(
    adbRun(serial, ['shell', 'cmd', 'package', 'resolve-activity', '--brief', '-n', component]),
  ).trim();
  const resolved = output
    .split(/\r?\n/)
    .map(line => line.trim())
    .reverse()
    .find(line => line.includes('/'));
  if (!resolved || normalizeComponent(resolved) !== normalizeComponent(component)) {
    throw new Error(`Installed APK does not resolve expected component: ${component}`);
  }
  return normalizeComponent(resolved);
}

function installedBaseApkPath(serial, packageName) {
  const output = String(adbRun(serial, ['shell', 'pm', 'path', packageName]));
  const paths = output
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^package:/, ''))
    .filter(Boolean);
  const baseApk = paths.find(file => /(?:^|\/)base\.apk$/.test(file));
  if (!baseApk) throw new Error(`Installed base.apk not found for ${packageName}.`);
  return baseApk;
}

function installedFileSha256(serial, file) {
  for (const command of [
    ['shell', 'sha256sum', file],
    ['shell', 'toybox', 'sha256sum', file],
  ]) {
    try {
      const digest = String(adbRun(serial, command)).match(/\b[0-9a-f]{64}\b/i)?.[0];
      if (digest) return digest.toLowerCase();
    } catch {
      // Try the explicit toybox applet before failing closed.
    }
  }
  throw new Error(`Cannot hash installed APK on device: ${file}`);
}

function inspectInstalledApp(serial, packageName, component) {
  const baseApkPath = installedBaseApkPath(serial, packageName);
  const packageDump = String(adbRun(serial, ['shell', 'dumpsys', 'package', packageName]));
  const versionName = packageDump.match(/versionName=([^\s]+)/)?.[1];
  const versionCode = packageDump.match(/versionCode=(\d+)/)?.[1];
  if (!versionName || !versionCode) {
    throw new Error(`Cannot verify installed package/version for ${packageName}.`);
  }
  return {
    packageName,
    component: resolveComponent(serial, component),
    versionName,
    versionCode,
    baseApkPath,
    baseApkSha256: installedFileSha256(serial, baseApkPath),
  };
}

function verifyInstalledApp(serial, session) {
  if (!fs.existsSync(session.apk.path)) {
    throw new Error(`Prepared APK is no longer available: ${session.apk.path}`);
  }
  const inputDigest = sha256(fs.readFileSync(session.apk.path));
  if (inputDigest !== session.apk.sha256) {
    throw new Error('Prepared APK file hash changed after session creation.');
  }
  const installed = inspectInstalledApp(serial, session.packageName, session.component);
  if (installed.baseApkSha256 !== session.apk.sha256) {
    throw new Error('Installed base.apk hash differs from the prepared APK.');
  }
  if (
    installed.versionName !== session.versionName ||
    installed.versionCode !== session.versionCode
  ) {
    throw new Error('Installed package version differs from the prepared session.');
  }
  return installed;
}

function signerInvocation(candidate) {
  if (!candidate) return null;
  const resolved = path.resolve(String(candidate));
  if (fs.existsSync(resolved) && resolved.toLowerCase().endsWith('.jar')) {
    return {binary: 'java', prefix: ['-jar', resolved]};
  }
  if (fs.existsSync(resolved) && resolved.toLowerCase().endsWith('.bat')) {
    const jar = path.join(path.dirname(resolved), 'lib', 'apksigner.jar');
    return fs.existsSync(jar) ? {binary: 'java', prefix: ['-jar', jar]} : null;
  }
  if (fs.existsSync(resolved)) return {binary: resolved, prefix: []};
  if (!String(candidate).includes('/') && !String(candidate).includes('\\')) {
    return {binary: String(candidate), prefix: []};
  }
  return null;
}

function findApkSigner() {
  const configured = process.env.APKSIGNER;
  const candidates = [];
  if (configured) candidates.push(signerInvocation(configured));

  const sdkRoots = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Library', 'Android', 'sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Android', 'Sdk'),
  ].filter(Boolean);
  for (const sdkRoot of [...new Set(sdkRoots.map(root => path.resolve(root)))]) {
    const buildTools = path.join(sdkRoot, 'build-tools');
    if (!fs.existsSync(buildTools)) continue;
    const versions = fs
      .readdirSync(buildTools, {withFileTypes: true})
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((left, right) => right.localeCompare(left, undefined, {numeric: true}));
    for (const version of versions) {
      candidates.push(
        signerInvocation(path.join(buildTools, version, 'lib', 'apksigner.jar')),
      );
    }
  }
  candidates.push({binary: 'apksigner', prefix: []});

  for (const candidate of candidates.filter(Boolean)) {
    try {
      const version = String(run(candidate.binary, [...candidate.prefix, 'version'])).trim();
      return {...candidate, version};
    } catch {
      // Continue through installed SDK candidates.
    }
  }
  if (configured) throw new Error('Configured APKSIGNER could not be executed.');
  return null;
}

function inspectApkSignature(apk) {
  const signer = findApkSigner();
  if (!signer) return {available: false, verified: null, certificateSha256: []};
  let output;
  try {
    output = String(
      run(signer.binary, [...signer.prefix, 'verify', '--verbose', '--print-certs', apk]),
    );
  } catch {
    throw new Error('APK signature verification failed.');
  }
  const certificateSha256 = [
    ...output.matchAll(/certificate SHA-256 digest:\s*([0-9a-f]+)/gi),
  ].map(match => match[1].toLowerCase());
  if (certificateSha256.length === 0) {
    throw new Error('apksigner verified the APK but reported no signer certificate.');
  }
  return {
    available: true,
    verified: true,
    tool: 'Android apksigner',
    toolVersion: signer.version,
    certificateSha256: [...new Set(certificateSha256)],
  };
}

function requestedEnglishLocale(value) {
  const locale = String(value).trim().replaceAll('_', '-');
  if (!/^en(?:-[A-Za-z0-9]+)*$/i.test(locale)) {
    throw new Error('Store evidence locale must be an English BCP-47 tag.');
  }
  return locale;
}

function localeMatches(observed, requested) {
  const actual = String(observed).trim().split(',')[0].replaceAll('_', '-').toLowerCase();
  const expected = String(requested).toLowerCase();
  return expected.includes('-') ? actual === expected : actual.split('-')[0] === expected;
}

function deviceLocale(serial) {
  const probes = [
    ['shell', 'settings', 'get', 'system', 'system_locales'],
    ['shell', 'getprop', 'persist.sys.locale'],
    ['shell', 'getprop', 'ro.product.locale'],
  ];
  for (const probe of probes) {
    try {
      const value = String(adbRun(serial, probe)).trim();
      if (value && value !== 'null') return value;
    } catch {
      // Continue through portable Android locale probes.
    }
  }
  throw new Error('Cannot read device locale.');
}

function appLocale(serial, packageName, apiLevel, fallback) {
  if (apiLevel < 33) return fallback;
  const output = String(
    adbRun(serial, ['shell', 'cmd', 'locale', 'get-app-locales', packageName, '--user', 'current']),
  );
  const locale = output.match(/\[([^\]]*)\]/)?.[1]?.trim();
  if (!locale) throw new Error(`Cannot verify application locale for ${packageName}.`);
  return locale;
}

function waitForBoot(serial, timeoutMs = 60_000) {
  adbRun(serial, ['wait-for-device']);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (String(adbRun(serial, ['shell', 'getprop', 'sys.boot_completed'])).trim() === '1') {
        return;
      }
    } catch {
      // Framework restart temporarily disconnects shell commands.
    }
    sleep(1_000);
  }
  throw new Error('Android did not finish restarting after locale change.');
}

function setAndVerifyLocales(serial, packageName, locale, apiLevel, emulator) {
  let observedDevice = deviceLocale(serial);
  if (!localeMatches(observedDevice, locale)) {
    if (!emulator) {
      throw new Error(`Physical device locale is ${observedDevice}; set it to ${locale} first.`);
    }
    let help = '';
    try {
      help = String(adbRun(serial, ['shell', 'cmd', 'locale', 'help']));
    } catch {
      // Android 12 and older have no locale manager shell command.
    }
    if (help.includes('set-device-locale')) {
      adbRun(serial, ['shell', 'cmd', 'locale', 'set-device-locale', locale]);
    } else {
      adbRun(serial, ['shell', 'setprop', 'persist.sys.locale', locale]);
      adbRun(serial, ['shell', 'stop']);
      sleep(2_000);
      adbRun(serial, ['shell', 'start']);
      waitForBoot(serial);
    }
    const deadline = Date.now() + 30_000;
    do {
      observedDevice = deviceLocale(serial);
      if (localeMatches(observedDevice, locale)) break;
      sleep(500);
    } while (Date.now() < deadline);
  }
  if (!localeMatches(observedDevice, locale)) {
    throw new Error(`Device locale is ${observedDevice}; expected ${locale}.`);
  }

  if (apiLevel >= 33) {
    adbRun(serial, [
      'shell',
      'cmd',
      'locale',
      'set-app-locales',
      packageName,
      '--user',
      'current',
      '--locales',
      locale,
    ]);
  }
  const observedApp = appLocale(serial, packageName, apiLevel, observedDevice);
  if (!localeMatches(observedApp, locale)) {
    throw new Error(`Application locale is ${observedApp}; expected ${locale}.`);
  }
  return {requested: locale, device: observedDevice, app: observedApp};
}

function verifyLocales(serial, session) {
  const observedDevice = deviceLocale(serial);
  const observedApp = appLocale(serial, session.packageName, session.apiLevel, observedDevice);
  if (
    !localeMatches(observedDevice, session.locale) ||
    !localeMatches(observedApp, session.locale)
  ) {
    throw new Error(
      `English locale verification failed (device=${observedDevice}, app=${observedApp}).`,
    );
  }
  return {requested: session.locale, device: observedDevice, app: observedApp};
}

function pngInfo(buffer) {
  if (buffer.length < 33 || buffer.subarray(1, 4).toString('ascii') !== 'PNG') {
    throw new Error('ADB did not return a valid PNG.');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
  };
}

function parseSize(value) {
  const text = String(value);
  const match =
    text.match(/Override size:\s*(\d+)x(\d+)/i) ??
    text.match(/Physical size:\s*(\d+)x(\d+)/i) ??
    text.match(/(\d+)x(\d+)/);
  if (!match) throw new Error(`Cannot parse display size: ${value}`);
  return {width: Number(match[1]), height: Number(match[2])};
}

function currentFocus(serial) {
  const activity = String(adbRun(serial, ['shell', 'dumpsys', 'activity', 'activities']));
  const activityMatch = activity.match(
    /(?:mResumedActivity|topResumedActivity)[^\n]*\s([A-Za-z0-9_.]+)\//,
  );
  if (activityMatch) return activityMatch[1];
  const windows = String(adbRun(serial, ['shell', 'dumpsys', 'window', 'windows']));
  return windows.match(/mCurrentFocus[^\n]*\s([A-Za-z0-9_.]+)\//)?.[1] ?? null;
}

function waitForFocus(serial, allowedPackages, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const focused = currentFocus(serial);
    if (focused && allowedPackages.includes(focused)) return focused;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error(`Expected foreground package: ${allowedPackages.join(' or ')}`);
}

function parseInsets(serial, width, height, manual) {
  if (manual) {
    const parts = String(manual).split(',').map(Number);
    if (parts.length !== 4 || parts.some(value => !Number.isInteger(value) || value < 0)) {
      throw new Error('--insets must be top,right,bottom,left integers.');
    }
    return {
      top: parts[0],
      right: parts[1],
      bottom: parts[2],
      left: parts[3],
      source: 'reviewed-cli',
    };
  }

  const dump = String(adbRun(serial, ['shell', 'dumpsys', 'window', 'displays']));
  const contentBounds = dump.match(
    /mStable=Rect\((\d+),\s*(\d+)\s*-\s*(\d+),\s*(\d+)\)/,
  );
  if (contentBounds) {
    const [left, top, right, bottom] = contentBounds.slice(1).map(Number);
    if (right > width / 2 && bottom > height / 2) {
      return {
        top,
        right: width - right,
        bottom: height - bottom,
        left,
        source: 'dumpsys-mStable',
      };
    }
  }
  const stableInsets = dump.match(
    /mStableInsets=Rect\((\d+),\s*(\d+)\s*-\s*(\d+),\s*(\d+)\)/,
  );
  if (stableInsets) {
    const [left, top, right, bottom] = stableInsets.slice(1).map(Number);
    return {top, right, bottom, left, source: 'dumpsys-mStableInsets'};
  }
  throw new Error(
    'Could not determine OS bars. Review dumpsys and pass --insets top,right,bottom,left.',
  );
}

function prepare() {
  const apk = path.resolve(required('apk'));
  if (args.aab) {
    throw new Error('--aab is not accepted: capture provenance covers the exact installed APK.');
  }
  const component = normalizeComponent(required('component'));
  const packageName = component.split('/')[0];
  const outputDir = path.resolve(required('out'));
  const serial = resolveSerial(args.serial && String(args.serial));
  const requestedSize = parseSize(required('size'));
  const requestedDensity = Number(required('density'));
  const locale = requestedEnglishLocale(required('locale'));
  if (!fs.existsSync(apk)) throw new Error(`APK not found: ${apk}`);
  if (git(['status', '--porcelain', '--untracked-files=all'])) {
    throw new Error(
      'Worktree has tracked or untracked changes. Commit verified source before preparing evidence.',
    );
  }

  const sessionPath = path.join(outputDir, 'session.json');
  if (fs.existsSync(sessionPath)) throw new Error(`Session already exists: ${sessionPath}`);
  fs.mkdirSync(outputDir, {recursive: true});

  const apiLevel = Number(
    String(adbRun(serial, ['shell', 'getprop', 'ro.build.version.sdk'])).trim(),
  );
  const emulator = serial.startsWith('emulator-');
  const apkBytes = fs.readFileSync(apk);
  const apkDigest = sha256(apkBytes);
  const signature = inspectApkSignature(apk);

  adbRun(serial, ['shell', 'wm', 'size', `${requestedSize.width}x${requestedSize.height}`]);
  adbRun(serial, ['shell', 'wm', 'density', String(requestedDensity)]);
  const installOutput = String(adbRun(serial, ['install', '-r', apk]));
  if (!/\bSuccess\b/i.test(installOutput)) throw new Error('ADB did not confirm APK installation.');
  const localeVerification = setAndVerifyLocales(
    serial,
    packageName,
    locale,
    apiLevel,
    emulator,
  );
  adbRun(serial, ['shell', 'am', 'force-stop', packageName]);
  const launchOutput = String(adbRun(serial, ['shell', 'am', 'start', '-W', '-n', component]));
  if (!/Status:\s*ok/i.test(launchOutput)) {
    throw new Error(`Expected component failed to launch: ${component}`);
  }
  waitForFocus(serial, [packageName]);

  const actualSize = parseSize(String(adbRun(serial, ['shell', 'wm', 'size'])));
  const densityText = String(adbRun(serial, ['shell', 'wm', 'density']));
  const actualDensity = Number(
    densityText.match(/Override density:\s*(\d+)/)?.[1] ??
      densityText.match(/Physical density:\s*(\d+)/)?.[1],
  );
  if (actualSize.width !== requestedSize.width || actualSize.height !== requestedSize.height) {
    throw new Error(
      `Display is ${actualSize.width}x${actualSize.height}, expected ${requestedSize.width}x${requestedSize.height}.`,
    );
  }
  if (actualDensity !== requestedDensity) {
    throw new Error(`Display density is ${actualDensity}, expected ${requestedDensity}.`);
  }

  const installed = inspectInstalledApp(serial, packageName, component);
  if (installed.baseApkSha256 !== apkDigest) {
    throw new Error('Installed base.apk hash differs from the exact input APK.');
  }
  const session = {
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
    gitSha: git(['rev-parse', 'HEAD']),
    packageName,
    component,
    versionName: installed.versionName,
    versionCode: installed.versionCode,
    locale,
    localeVerification,
    serial,
    emulator,
    model: String(adbRun(serial, ['shell', 'getprop', 'ro.product.model'])).trim(),
    apiLevel,
    width: actualSize.width,
    height: actualSize.height,
    density: actualDensity,
    apk: {path: apk, sha256: apkDigest, bytes: apkBytes.length, signature},
    installedBaseApk: {
      path: installed.baseApkPath,
      sha256: installed.baseApkSha256,
    },
  };
  writeJson(sessionPath, session);
  console.log(`Prepared immutable capture session: ${sessionPath}`);
}

function capture() {
  const sessionPath = path.resolve(required('session'));
  const session = readJson(sessionPath);
  if (session.schemaVersion !== 2) {
    throw new Error('Capture requires a schemaVersion 2 verified APK session.');
  }
  if (fs.existsSync(path.join(path.dirname(sessionPath), 'raw-manifest.sha256'))) {
    throw new Error('Raw evidence is sealed; no further captures are allowed.');
  }
  const serial = resolveSerial(args.serial ? String(args.serial) : session.serial);
  if (serial !== session.serial) throw new Error('Capture serial differs from prepared session.');
  const installed = verifyInstalledApp(serial, session);
  const localeVerification = verifyLocales(serial, session);
  const surface = String(args.surface ?? 'app');
  const allowed =
    surface === 'system-media'
      ? [session.packageName, 'com.android.systemui']
      : [session.packageName];
  const focusedPackage = waitForFocus(serial, allowed, 5_000);
  const png = adbRun(serial, ['exec-out', 'screencap', '-p'], {binary: true});
  const info = pngInfo(png);
  if (info.width !== session.width || info.height !== session.height) {
    throw new Error(
      `Screenshot is ${info.width}x${info.height}; session requires ${session.width}x${session.height}.`,
    );
  }
  if (png.length < 10_000) throw new Error('Screenshot is suspiciously small.');

  const root = path.dirname(sessionPath);
  const relativeOutput = required('output').replaceAll('\\', '/');
  if (path.isAbsolute(relativeOutput) || relativeOutput.startsWith('../')) {
    throw new Error('--output must stay inside the session directory.');
  }
  const output = path.resolve(root, relativeOutput);
  if (!output.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new Error('Output escapes session directory.');
  }
  if (fs.existsSync(output)) throw new Error(`Refusing to overwrite raw capture: ${output}`);
  fs.mkdirSync(path.dirname(output), {recursive: true});

  const insets = parseInsets(serial, info.width, info.height, args.insets);
  fs.writeFileSync(output, png, {flag: 'wx'});
  const manifestPath = path.join(root, 'raw-manifest.json');
  const manifest = fs.existsSync(manifestPath)
    ? readJson(manifestPath)
    : {schemaVersion: 2, session: 'session.json', captures: []};
  const id = required('id');
  const digest = sha256(png);
  if (
    manifest.captures.some(
      item => item.id === id || item.file === relativeOutput || item.sha256 === digest,
    )
  ) {
    throw new Error('Duplicate capture id, file or image hash.');
  }
  manifest.captures.push({
    id,
    claim: required('claim'),
    state: required('state'),
    route: required('route'),
    surface,
    file: relativeOutput,
    width: info.width,
    height: info.height,
    bitDepth: info.bitDepth,
    colorType: info.colorType,
    sha256: digest,
    source: 'adb exec-out screencap -p',
    focusedPackage,
    verification: {
      packageName: installed.packageName,
      component: installed.component,
      versionName: installed.versionName,
      versionCode: installed.versionCode,
      baseApkSha256: installed.baseApkSha256,
      locale: localeVerification,
    },
    insets,
    capturedAt: new Date().toISOString(),
  });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Captured real screen: ${output}`);
}

function seal() {
  const sessionPath = path.resolve(required('session'));
  const root = path.dirname(sessionPath);
  const manifestPath = path.join(root, 'raw-manifest.json');
  const sealPath = path.join(root, 'raw-manifest.sha256');
  if (!fs.existsSync(manifestPath)) throw new Error('No raw-manifest.json to seal.');
  if (fs.existsSync(sealPath)) throw new Error(`Raw evidence is already sealed: ${sealPath}`);
  const manifest = readJson(manifestPath);
  if (manifest.session !== path.basename(sessionPath)) {
    throw new Error('Raw manifest does not reference the prepared session file.');
  }
  for (const item of manifest.captures) {
    const file = path.resolve(root, item.file);
    if (!fs.existsSync(file) || sha256(fs.readFileSync(file)) !== item.sha256) {
      throw new Error(`Raw evidence hash mismatch: ${item.file}`);
    }
  }
  fs.writeFileSync(
    sealPath,
    `${sha256(fs.readFileSync(manifestPath))}  raw-manifest.json\n${sha256(
      fs.readFileSync(sessionPath),
    )}  ${path.basename(sessionPath)}\n`,
    {flag: 'wx'},
  );
  console.log(`Sealed raw evidence: ${sealPath}`);
}

if (command === 'prepare') prepare();
else if (command === 'capture') capture();
else if (command === 'seal') seal();
else {
  console.error(
    'Usage: capture-android-store-screenshot.mjs <prepare|capture|seal> [--key value ...]',
  );
  process.exit(2);
}
