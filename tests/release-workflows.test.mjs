import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {verifyReleaseVersion} from '../scripts/verify-release-version.mjs';

test('release tag matches mobile, terminal, TV, Wear, and iOS versions', async () => {
  assert.deepEqual(await verifyReleaseVersion('v1.3.6'), {tag: 'v1.3.6', version: '1.3.6'});
  await assert.rejects(verifyReleaseVersion('v1.0.0'), /does not match/);
  await assert.rejects(verifyReleaseVersion('latest'), /vMAJOR\.MINOR\.PATCH/);
});

test('all Android release targets reject missing or wrong production signing', async () => {
  const policy = await readFile(new URL('../mobile/android/release-signing.gradle', import.meta.url), 'utf8');
  const workflow = await readFile(new URL('../.github/workflows/android-release.yml', import.meta.url), 'utf8');
  const pinned = /EXPECTED_ANDROID_CERT_SHA256:\s*([A-F0-9]{64})/.exec(workflow)?.[1];
  assert.ok(pinned);
  assert.ok(policy.includes(pinned));
  assert.match(policy, /propertiesFile\.isFile\(\)/);
  assert.match(policy, /KeyStore\.getInstance/);
  assert.match(policy, /isKeyEntry/);
  assert.match(policy, /getKey/);
  assert.match(policy, /actual != productionCertificateSha256/);
  assert.match(policy, /task\.name == 'preReleaseBuild'/);
  assert.match(policy, /task\.dependsOn\(verifyProductionSigning\)/);
  for (const module of ['app', 'tv', 'wear']) {
    const gradle = await readFile(new URL(`../mobile/android/${module}/build.gradle`, import.meta.url), 'utf8');
    assert.match(gradle, /apply from: rootProject\.file\('release-signing.gradle'\)/);
    assert.match(gradle, /signingConfig hasReleaseKeystore \? signingConfigs.release : null/);
    assert.doesNotMatch(gradle, /hasReleaseKeystore \? signingConfigs.release : signingConfigs.debug/);
  }
});

test('iOS release validates and uploads the signed IPA to TestFlight', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ios-release.yml', import.meta.url), 'utf8');
  for (const secret of [
    'APP_STORE_CONNECT_API_KEY_ID',
    'APP_STORE_CONNECT_API_ISSUER_ID',
    'APP_STORE_CONNECT_API_PRIVATE_KEY_BASE64',
  ]) {
    assert.match(workflow, new RegExp(`secrets\\.${secret}`));
  }
  assert.match(workflow, /xcrun altool --validate-app/);
  assert.match(workflow, /xcrun altool --upload-app/);
  assert.match(workflow, /--apiKey/);
  assert.match(workflow, /--apiIssuer/);
});

test('production releases are main-only and cannot reuse a tag for another commit', async () => {
  for (const name of ['android-release.yml', 'ios-release.yml']) {
    const workflow = await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');
    assert.match(workflow, /environment: production/);
    assert.match(workflow, /fetch-depth: 0/);
    assert.match(workflow, /GITHUB_REF.*refs\/heads\/main/);
    assert.match(workflow, /existing_commit.*GITHUB_SHA/s);
  }
});

test('Android release verifies AAB integrity without rejecting the pinned self-signed upload key', async () => {
  const workflow = await readFile(new URL('../.github/workflows/android-release.yml', import.meta.url), 'utf8');
  assert.match(workflow, /EXPECTED_ANDROID_CERT_SHA256/);
  assert.match(workflow, /jarsigner -verify "\$aab"/);
  assert.doesNotMatch(workflow, /jarsigner -verify -strict/);
  assert.match(workflow, /RadioTEDU-Terminal-\$\{RELEASE_TAG\}\.zip/);
  assert.match(workflow, /terminal_version/);
});

test('Android QA release is unmistakably debug-signed and includes Android Auto, TV, and Wear', async () => {
  const workflow = await readFile(new URL('../.github/workflows/android-qa-release.yml', import.meta.url), 'utf8');
  assert.match(workflow, /:app:assembleDebug/);
  assert.match(workflow, /:tv:assembleDebug/);
  assert.match(workflow, /:wear:assembleDebug/);
  assert.match(workflow, /Mobile-with-Android-Auto/);
  assert.match(workflow, /debug-signed/);
  assert.match(workflow, /prerelease: true/);
  assert.doesNotMatch(workflow, /bundleRelease|assembleRelease/);
});

test('terminal release publishes the radiotedu command to npm from main', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../terminal/package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.name, 'radiotedu');
  assert.equal(packageJson.bin.radiotedu, 'src/index.js');
  const workflow = await readFile(new URL('../.github/workflows/npm-terminal-release.yml', import.meta.url), 'utf8');
  assert.match(workflow, /npm publish \.\/terminal --access public/);
  assert.match(workflow, /secrets\.NPM_TOKEN/);
  assert.match(workflow, /origin\/main/);
});

test('device screenshots use native phone, tablet, TV, Wear, car, iPhone, and iPad hosts', async () => {
  const workflow = await readFile(new URL('../.github/workflows/device-screenshots.yml', import.meta.url), 'utf8');
  for (const expected of ['pixel_7', 'pixel_c', 'android-tv', 'android-wear', 'android-automotive']) {
    assert.match(workflow, new RegExp(expected));
  }
  const iosCapture = await readFile(new URL('../scripts/capture-ios-screenshots.sh', import.meta.url), 'utf8');
  assert.match(iosCapture, /ios-iphone\.png/);
  assert.match(iosCapture, /ios-ipad\.png/);

  const project = await readFile(
    new URL('../mobile/ios/RadioTEDUMobile.xcodeproj/project.pbxproj', import.meta.url),
    'utf8',
  );
  assert.match(project, /TARGETED_DEVICE_FAMILY = "1,2";/);
  const info = await readFile(new URL('../mobile/ios/RadioTEDUMobile/Info.plist', import.meta.url), 'utf8');
  assert.match(info, /UIWindowSceneSessionRoleApplication/);
  assert.match(info, /RadioTEDUSceneDelegate/);
});
