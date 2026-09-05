const {test} = require('node:test');
const assert = require('node:assert/strict');
const {buildFrame, mouseAction, width, clean} = require('../src/layout');
const {listStations} = require('../src/stations');
const state = {stations: listStations(), selected: 8, quality: 'normal', volume: 80};

test('all views fit narrow, standard and wide terminal windows', () => {
  for (const columns of [20, 40, 60, 80, 100, 140]) {
    for (const rows of [12, 24, 40]) {
      for (const activeTab of [1, 2, 3, 4]) {
        const frame = buildFrame({...state, activeTab}, {columns, rows});
        assert.equal(frame.lines.length, rows - 1);
        assert.ok(frame.lines.every(line => width(line) === columns - 1));
        assert.ok(frame.hits.every(hit => hit.y <= rows - 1 && hit.endX <= columns - 1));
      }
    }
  }
});
test('scrolled station click selects the visible station, not an absolute row', () => {
  const frame = buildFrame(state, {columns: 60, rows: 16});
  const hit = frame.hits.find(item => item.station === 8);
  assert.ok(hit);
  assert.equal(mouseAction(frame, {button: 0, release: true, x: 3, y: hit.y}).station, 8);
  assert.equal(mouseAction(frame, {button: 0, release: false, x: 3, y: hit.y}), null);
});
test('Unicode labels and hostile metadata cannot overflow or control the terminal', () => {
  const frame = buildFrame({...state, metadata: '\x1b[2J中🎵e\u0301\nInjected', active: state.stations[0]}, {columns: 60, rows: 24});
  assert.ok(frame.lines.every(line => width(line) === 59));
  assert.equal(clean('\x1b[2Jtitle\x07'), 'title ');
  assert.equal(width('中🎵e\u0301'), 5);
});
test('credential view masks passwords and modal choices retain hit targets', () => {
  const secret = 'never-show-this-password';
  const frame = buildFrame({...state, modal: {type: 'creds', password: secret}}, {columns: 60, rows: 24});
  assert.ok(!frame.lines.join('').includes(secret));
  assert.ok(frame.hits.some(hit => hit.key === 'enter'));
  const choices = buildFrame({...state, modal: {type: 'choice'}}, {columns: 60, rows: 24});
  assert.deepEqual(choices.hits.slice(4, 7).map(hit => hit.key), ['1', '2', '3']);
});
