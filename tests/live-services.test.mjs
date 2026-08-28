import assert from 'node:assert/strict';
import test from 'node:test';

import {isBlockingFailure, loadConfiguredServices, probeService} from '../scripts/verify-live-services.mjs';

test('release health check covers every remote WebView and form-factor stream', async () => {
  const services = await loadConfiguredServices();
  assert.deepEqual(services.filter(item => item.kind === 'webview').map(item => item.name), [
    'juke-local',
    'voting',
    'study',
  ]);
  assert.deepEqual(services.filter(item => item.kind === 'stream').map(item => item.name), [
    'radio',
    'classic',
    'cazz',
    'lofi',
    'energize',
    'rock',
    'en',
    'fr',
  ]);
});

test('health probe rejects unavailable pages and non-audio stream responses', async () => {
  const html = {get: () => 'text/html; charset=UTF-8'};
  const text = {get: () => 'text/plain'};
  await assert.rejects(
    probeService({kind: 'webview', url: 'https://example.test'}, {fetchImpl: async () => ({ok: false, status: 404, headers: html})}),
    /HTTP 404/,
  );
  await assert.rejects(
    probeService({kind: 'stream', url: 'https://example.test'}, {fetchImpl: async () => ({ok: true, status: 200, headers: text})}),
    /unexpected content type/,
  );
});

test('release policy permits intentionally disabled streams and Voting only', () => {
  assert.equal(isBlockingFailure({kind: 'stream', ok: false}, {allowUnavailableStreams: true}), false);
  assert.equal(
    isBlockingFailure(
      {kind: 'webview', name: 'voting', ok: false},
      {allowUnavailableVoting: true},
    ),
    false,
  );
  assert.equal(
    isBlockingFailure(
      {kind: 'webview', name: 'study', ok: false},
      {allowUnavailableStreams: true, allowUnavailableVoting: true},
    ),
    true,
  );
  assert.equal(
    isBlockingFailure(
      {kind: 'webview', name: 'juke-local', ok: false},
      {allowUnavailableStreams: true, allowUnavailableVoting: true},
    ),
    true,
  );
});
