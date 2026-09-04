const test = require('node:test');
const assert = require('node:assert/strict');
const {getStation, streamUrl, codecFor, listStations, SUPPORTED_CODECS} = require('../src/stations');
const {playerArguments, probeArgs} = require('../src/player');
const {rewardBalance} = require('../src/gold');
const {parseInput} = require('../src/tui');

test('quality mounts match RadioTEDU contract', () => {
  assert.equal(streamUrl('cazz', 'normal'), 'https://stream.radiotedu.com/cazz');
  assert.equal(streamUrl('cazz', 'low'), 'https://stream.radiotedu.com/cazz-low');
  assert.equal(streamUrl('cazz', 'flac'), 'https://stream.radiotedu.com/cazz-flac');
  assert.throws(() => streamUrl('lofi', 'flac'), /no FLAC/);
  assert.throws(() => streamUrl('spark', 'low'), /no LOW/);
  assert.equal(streamUrl('spark', 'normal'), 'https://stream.radiotedu.com/spark');
  assert.equal(codecFor('normal'), 'HE-AAC v2');
  assert.equal(codecFor('normal', 'spark'), 'Ogg/Opus');
  assert.equal(codecFor('flac'), 'FLAC');
  assert.deepEqual(SUPPORTED_CODECS, ['HE-AAC v2', 'AAC-LC', 'MP3', 'Ogg/Opus', 'FLAC']);
});

test('Voting stays last and uses its single live mount', () => {
  const stations = listStations();
  assert.equal(stations.at(-1).id, 'spark');
  assert.deepEqual(stations.at(-1).qualities, ['normal']);
});

test('ffplay is detected and launched as an audio-only player', () => {
  assert.deepEqual(probeArgs('ffplay'), ['-version']);
  assert.deepEqual(probeArgs('mpv'), ['--version']);
  assert.deepEqual(playerArguments('ffplay', 'https://stream.example/radio', 'Radio'), [
    '-nodisp', '-vn', '-hide_banner', '-loglevel', 'error', '-volume', '80', 'https://stream.example/radio',
  ]);
});

test('Gold balance only accepts a non-negative server integer', () => {
  assert.equal(rewardBalance({spendablePoints: 42}), 42);
  assert.equal(rewardBalance({points: {spendable_points: 43}}), 43);
  assert.equal(rewardBalance({spendablePoints: -1}), null);
});

test('station aliases keep cazz as the public mount', () => {
  assert.equal(getStation('jazz').mount, '/cazz');
  assert.equal(getStation('/cazz').id, 'cazz');
});

test('keyboard and SGR mouse input are recognized', () => {
  assert.deepEqual(parseInput(Buffer.from('\x1b[A')), {type: 'key', key: 'up'});
  assert.deepEqual(parseInput(Buffer.from(' ')), {type: 'key', key: 'space'});
  assert.deepEqual(parseInput(Buffer.from('\x1b[<64;1;1M')), {type: 'mouse', button: 64, x: 1, y: 1, release: false});
});

test('device pairing code formats 8 characters into 4-4 with hyphen', () => {
  const code = 'abcd1234';
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formatted = normalized.length === 8 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : code;
  assert.equal(formatted, 'ABCD-1234');
});
