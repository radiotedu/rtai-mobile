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
  const [mobilePackage, terminalPackage, appGradle, tvGradle, wearGradle, xcodeProject] = await Promise.all([
    read('mobile/package.json'),
    read('terminal/package.json'),
    read('mobile/android/app/build.gradle'),
    read('mobile/android/tv/build.gradle'),
    read('mobile/android/wear/build.gradle'),
    read('mobile/ios/RadioTEDUMobile.xcodeproj/project.pbxproj'),
  ]);
  const versions = {
    'mobile/package.json': JSON.parse(mobilePackage).version,
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
  return {tag: `v${version}`, version};
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const result = await verifyReleaseVersion(process.argv[2]);
  console.log(`PASS | release version | ${result.tag}`);
}
