import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function uniqueMatches(source, pattern) {
  return [...new Set([...source.matchAll(pattern)].map(match => match[1]))];
}

export async function verifyReleaseVersion(tag, repositoryRoot = root) {
  const match = /^v?(\d+\.\d+\.\d+)$/.exec(tag ?? '');
  if (!match) throw new Error('Release tag must use vMAJOR.MINOR.PATCH format.');
  const version = match[1];
  const read = relative => readFile(path.join(repositoryRoot, relative), 'utf8');
  const [mobilePackage, mobileLock, terminalPackage, appGradle, tvGradle, wearGradle, xcodeProject] = await Promise.all([
    read('mobile/package.json'),
    read('mobile/package-lock.json'),
    read('terminal/package.json'),
    read('mobile/android/app/build.gradle'),
    read('mobile/android/tv/build.gradle'),
    read('mobile/android/wear/build.gradle'),
    read('mobile/ios/RadioTEDUMobile.xcodeproj/project.pbxproj'),
  ]);
  const versions = {
    'mobile/package.json': JSON.parse(mobilePackage).version,
    'mobile/package-lock.json': JSON.parse(mobileLock).version,
    'mobile/package-lock.json root package': JSON.parse(mobileLock).packages?.['']?.version,
    'terminal/package.json': JSON.parse(terminalPackage).version,
    'Android mobile': uniqueMatches(appGradle, /versionName\s+["']([^"']+)["']/g)[0],
    'Android TV': uniqueMatches(tvGradle, /versionName\s+["']([^"']+)["']/g)[0],
    'Android Wear': uniqueMatches(wearGradle, /versionName\s+["']([^"']+)["']/g)[0],
  };
  const iosVersions = uniqueMatches(xcodeProject, /MARKETING_VERSION\s*=\s*([^;\s]+);/g);
  if (iosVersions.length !== 1) throw new Error(`iOS MARKETING_VERSION is inconsistent: ${iosVersions.join(', ') || 'missing'}.`);
  versions.iOS = iosVersions[0];

  const mismatches = Object.entries(versions).filter(([, actual]) => actual !== version);
  if (mismatches.length) {
    throw new Error(`Release ${tag} does not match ${mismatches.map(([name, actual]) => `${name}=${actual ?? 'missing'}`).join(', ')}.`);
  }
  const [major, minor, patch] = version.split('.').map(Number);
  const baseCode = major * 10_000 + minor * 1_000 + patch * 10;
  if (minor > 9 || patch > 99 || !Number.isSafeInteger(baseCode) || baseCode <= 0 || baseCode + 2 > 2_100_000_000) {
    throw new Error('Release version cannot use the current Android versionCode allocation.');
  }
  for (const [label, source, offset] of [['mobile', appGradle, 0], ['TV', tvGradle, 1], ['Wear', wearGradle, 2]]) {
    const codes = uniqueMatches(source, /versionCode\s+(\d+)/g);
    if (codes.length !== 1 || Number(codes[0]) !== baseCode + offset) {
      throw new Error(`Android ${label} versionCode must be ${baseCode + offset} for ${tag}.`);
    }
  }
  const iosBuilds = uniqueMatches(xcodeProject, /CURRENT_PROJECT_VERSION\s*=\s*([^;\s]+);/g);
  if (iosBuilds.length !== 1 || Number(iosBuilds[0]) !== baseCode) {
    throw new Error(`iOS CURRENT_PROJECT_VERSION must be ${baseCode} for ${tag}.`);
  }
  return {tag: `v${version}`, version};
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const result = await verifyReleaseVersion(process.argv[2]);
  console.log(`PASS | release version | ${result.tag}`);
}
