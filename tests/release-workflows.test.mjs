import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {verifyReleaseVersion} from '../scripts/verify-release-version.mjs';

test('release tag matches mobile, TV, Wear, and iOS versions', async () => {
  assert.deepEqual(await verifyReleaseVersion('v1.1.0'), {tag: 'v1.1.0', version: '1.1.0'});
  await assert.rejects(verifyReleaseVersion('v1.0.0'), /does not match/);
  await assert.rejects(verifyReleaseVersion('latest'), /vMAJOR\.MINOR\.PATCH/);
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
