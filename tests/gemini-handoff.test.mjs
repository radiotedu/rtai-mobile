import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const handoff = await readFile(new URL('../GEMINI.md', import.meta.url), 'utf8');

test('Antigravity handoff documents the current ecosystem architecture', () => {
  assert.match(handoff, /## System map/);
  assert.match(handoff, /## Website structure/);
  assert.match(handoff, /## Mobile architecture/);
  assert.match(handoff, /## Account and Gold rules/);
  assert.match(handoff, /## Juke-Local and voting/);
  assert.match(handoff, /## Safe website deployment procedure/);
  assert.match(handoff, /## Troubleshooting order/);
});

test('handoff preserves production safety boundaries', () => {
  assert.match(handoff, /Never delete, reset, truncate, reseed, or bulk-rewrite a production database/);
  assert.match(handoff, /ERP is read-only/);
  assert.match(handoff, /Do not change the Audio Library/);
  assert.match(handoff, /Do not build Android on this machine/);
  assert.match(handoff, /Never place passwords, tokens, private keys/);
});

test('handoff points to maintained source and verification commands', () => {
  assert.match(handoff, /website\/wordpress-overlay\/wp-content\/themes\/radiotedu/);
  assert.match(handoff, /node scripts\\android-publish-audit\.js/);
  assert.match(handoff, /npm test -- --runInBand/);
  assert.match(handoff, /verify-live-services\.mjs/);
  assert.doesNotMatch(handoff, /verify-android-publish-readiness\.mjs/);
});

test('repository handoff does not contain the private kiosk credential table', () => {
  assert.doesNotMatch(handoff, /<th>Parola<\/th>/i);
  assert.doesNotMatch(handoff, /password\s*[:=]\s*[^<\s]+/i);
  assert.match(handoff, /Consult the private desktop guide/);
});
