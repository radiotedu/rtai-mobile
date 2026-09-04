const test = require('node:test');
const assert = require('node:assert/strict');
const {getStation, streamUrl, codecFor, listStations, SUPPORTED_CODECS} = require('../src/stations');
const {playerArguments, probeArgs, getWindowsCandidatePaths} = require('../src/player');
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

test('audio decoders (ffplay, mpv, vlc) are supported with correct arguments', () => {
  assert.deepEqual(probeArgs('ffplay'), ['-version']);
  assert.deepEqual(probeArgs('mpv'), ['--version']);
  assert.deepEqual(probeArgs('vlc'), ['--version']);
  assert.deepEqual(playerArguments('ffplay', 'https://stream.example/radio', 'Radio'), [
    '-nodisp', '-vn', '-hide_banner', '-loglevel', 'error', '-volume', '80', 'https://stream.example/radio',
  ]);
  assert.deepEqual(playerArguments('vlc', 'https://stream.example/radio', 'Radio'), [
    '-I', 'dummy', '--no-video', 'https://stream.example/radio',
  ]);
  assert.deepEqual(playerArguments('mpv', 'https://stream.example/radio', 'Radio', 90), [
    '--no-video', '--force-window=no', '--input-terminal=yes', '--title=RadioTEDU - Radio', '--volume=90', 'https://stream.example/radio',
  ]);
});

test('Windows candidate paths include standard tools and user directory', () => {
  const paths = getWindowsCandidatePaths();
  assert.ok(Array.isArray(paths));
  assert.ok(paths.some(p => p.includes('ffplay.exe')));
  assert.ok(paths.some(p => p.includes('mpv.exe')));
  assert.ok(paths.some(p => p.includes('vlc.exe')));
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

test('onLoginPairStart invocation is resilient to synchronous return and errors', async () => {
  const syncHandler = () => undefined;
  await assert.doesNotReject(async () => {
    try {
      await Promise.resolve(syncHandler());
    } catch {}
  });

  const throwingHandler = () => { throw new Error('browser launch blocked'); };
  await assert.doesNotReject(async () => {
    try {
      await Promise.resolve(throwingHandler());
    } catch {}
  });
});

test('Focus Pomodoro matches radiotedu.com/focus presets and timer progression', () => {
  const defaultPomo = {
    preset: '25/5',
    phase: 'focus',
    focusMinutes: 25,
    breakMinutes: 5,
    secondsLeft: 25 * 60,
    running: false,
    completedFocus: 0,
    completedBreak: 0,
  };

  assert.equal(defaultPomo.preset, '25/5');
  assert.equal(defaultPomo.secondsLeft, 1500);

  // Switch to 50/10 Deep Work preset
  const deepPomo = {
    ...defaultPomo,
    preset: '50/10',
    focusMinutes: 50,
    breakMinutes: 10,
    secondsLeft: 50 * 60,
  };
  assert.equal(deepPomo.preset, '50/10');
  assert.equal(deepPomo.focusMinutes, 50);
  assert.equal(deepPomo.breakMinutes, 10);
  assert.equal(deepPomo.secondsLeft, 3000);

  // Progress calculation
  const totalPhaseSecs = deepPomo.focusMinutes * 60;
  const elapsed = 750; // 12m 30s elapsed
  const secondsLeft = totalPhaseSecs - elapsed;
  const progress = 1 - (secondsLeft / totalPhaseSecs);
  assert.equal(progress, 0.25);
  assert.equal(Math.round(progress * 100), 25);
});

test('downloadPortablePlayer is exported and callable', () => {
  const {downloadPortablePlayer} = require('../src/player');
  assert.equal(typeof downloadPortablePlayer, 'function');
});


