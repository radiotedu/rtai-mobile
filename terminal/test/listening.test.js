const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {visibleStations, moveSelection, initialFavorites, toggleFavorite, cycleSleep, consumeSleep} = require('../src/listening');
const {buildFrame, mouseAction} = require('../src/layout');
const stations = [{id:'main',name:'RadioTEDU'}, {id:'fr',name:'Français'}, {id:'jazz',name:'Jazz'}];

test('interactive keys search, play, schedule sleep and preserve sign-in navigation', () => {
  const {spawnSync} = require('node:child_process');
  const script = `
    const {runTui} = require('./src/tui');
    let state; let plays = 0;
    const run = runTui({stations:${JSON.stringify(stations)}, onPlay:async(station,s)=>{state=s;s.active=station;plays++;}, onQuit:()=>{}, onTick:()=>false});
    (async()=>{
      for(const key of ['/jazz','\\r','\\r','z','?','\\x1b','4','l','\\x1b','3','t','q']) {
        process.stdin.emit('data',Buffer.from(key));
        await new Promise(resolve=>setTimeout(resolve,25));
      }
      await run;
      console.log('RESULT:'+JSON.stringify({id:state.active.id,plays,sleep:state.sleepMinutes,focus:state.pomodoro.running,modal:state.modal}));
    })();
  `;
  const result = spawnSync(process.execPath, ['-e', script], {cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:5000});
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout.match(/RESULT:(\{[^\n]+\})/)[1]);
  assert.deepEqual(data, {id:'jazz',plays:1,sleep:15,focus:true,modal:null});
  assert.ok(result.stdout.includes('SIGN IN / CONNECTION'));
});

test('search ignores accents and filtered navigation preserves real station indexes', () => {
  const state = {stations, selected:0, search:'francais', favorites:[]};
  moveSelection(state, 1);
  assert.equal(state.selected, 1);
  assert.equal(visibleStations(state)[0].station.id, 'fr');
  const frame = buildFrame(state, {columns:90, rows:28});
  const hit = frame.hits.find(item => item.station === 1);
  assert.equal(mouseAction(frame, {button:0,release:true,x:4,y:hit.y}).station, 1);
  state.search = 'no match';
  assert.deepEqual(visibleStations(state), []);
  assert.ok(!buildFrame(state).hits.some(item => item.station !== undefined));
});

test('sleep uses a deadline, expires once and never resumes a paused stream', () => {
  const state = {active:stations[0], paused:false};
  cycleSleep(state, 1000);
  assert.equal(state.sleepDeadline, 901000);
  assert.equal(consumeSleep(state, 900999), false);
  assert.equal(consumeSleep(state, 1000000), true);
  assert.equal(consumeSleep(state, 1000001), false);
  cycleSleep(state, 2000000);
  state.paused = true;
  assert.equal(consumeSleep(state, 3000000), false);
  assert.equal(state.sleepDeadline, null);
});

test('sleep presets cycle through off without depending on tick counts', () => {
  const state = {};
  for (const expected of [15,30,60,90,0]) { cycleSleep(state, 1000); assert.equal(state.sleepMinutes, expected); }
  assert.equal(state.sleepDeadline, null);
});

test('favorite persistence is isolated from authentication and rejects stale ids', () => {
  if (process.platform === 'darwin') return; // No writes to the real macOS application-support directory.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'radiotedu-listening-'));
  const key = process.platform === 'win32' ? 'APPDATA' : 'XDG_CONFIG_HOME';
  const previous = process.env[key]; process.env[key] = dir;
  try {
    const store = require('../src/store');
    const auth = {sentinel:'unchanged'};
    store.saveAuth(auth);
    const state = {stations,selected:1,favorites:[],favoritesOnly:false};
    toggleFavorite(state);
    assert.deepEqual(initialFavorites(stations), ['fr']);
    state.favoritesOnly = true;
    toggleFavorite(state);
    assert.deepEqual(visibleStations(state), []);
    store.savePreferences({favorites:['removed','jazz','jazz']});
    assert.deepEqual(initialFavorites(stations), ['jazz']);
    assert.deepEqual(store.loadAuth(), auth);
    store.savePreferences({favorites:'invalid'});
    assert.deepEqual(initialFavorites(stations), []);
  } finally {
    if (previous === undefined) delete process.env[key]; else process.env[key] = previous;
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('radiotedu-listening-'));
    fs.rmSync(dir, {recursive:true,force:true});
  }
});
