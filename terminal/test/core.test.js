const test = require('node:test');
const assert = require('node:assert/strict');
const {getStation, streamUrl, codecFor} = require('../src/stations');
const {parseInput} = require('../src/tui');

test('quality mounts match RadioTEDU contract', () => {
  assert.equal(streamUrl('cazz', 'normal'), 'https://stream.radiotedu.com/cazz');
  assert.equal(streamUrl('cazz', 'low'), 'https://stream.radiotedu.com/cazz-low');
  assert.equal(streamUrl('cazz', 'flac'), 'https://stream.radiotedu.com/cazz-flac');
  assert.throws(() => streamUrl('lofi', 'flac'), /no FLAC/);
  assert.equal(codecFor('normal'), 'HE-AAC v1');
  assert.equal(codecFor('flac'), 'FLAC');
});

test('station aliases keep cazz as the public mount', () => {
  assert.equal(getStation('jazz').mount, '/cazz');
  assert.equal(getStation('/cazz').id, 'cazz');
});

test('keyboard and SGR mouse input are recognized', () => {
  assert.deepEqual(parseInput(Buffer.from('\x1b[A')), {type: 'key', key: 'up'});
  assert.deepEqual(parseInput(Buffer.from('\x1b[<64;1;1M')), {type: 'mouse', button: 64, x: 1, y: 1, release: false});
});
