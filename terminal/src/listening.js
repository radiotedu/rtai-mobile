const {loadPreferences, savePreferences} = require('./store');

function visibleStations(state) {
  const query = (state.search || '').normalize('NFKD').replace(/\p{Mark}/gu, '').toLowerCase();
  return state.stations.map((station, index) => ({station, index})).filter(({station}) =>
    (!state.favoritesOnly || state.favorites?.includes(station.id)) &&
    `${station.name} ${station.description || ''}`.normalize('NFKD').replace(/\p{Mark}/gu, '').toLowerCase().includes(query));
}

function moveSelection(state, direction = 0) {
  const visible = visibleStations(state);
  if (!visible.length) return;
  const current = visible.findIndex(item => item.index === state.selected);
  const next = current < 0 ? 0 : (current + direction + visible.length) % visible.length;
  state.selected = visible[next].index;
}

function initialFavorites(stations) {
  const stored = loadPreferences()?.favorites;
  return Array.isArray(stored) ? stations.filter(station => stored.includes(station.id)).map(station => station.id) : [];
}

function toggleFavorite(state) {
  const selected = visibleStations(state).find(item => item.index === state.selected);
  if (!selected) return;
  const id = selected.station.id;
  const next = state.favorites.includes(id) ? state.favorites.filter(item => item !== id) : [...state.favorites, id];
  // Persist first: a disk error must not pretend the preference was saved.
  savePreferences({favorites: next});
  state.favorites = next;
  moveSelection(state);
}

function cycleSleep(state, now = Date.now()) {
  const presets = [0, 15, 30, 60, 90];
  const current = state.sleepDeadline > now ? state.sleepMinutes : 0;
  state.sleepMinutes = presets[(presets.indexOf(current) + 1) % presets.length];
  state.sleepDeadline = state.sleepMinutes ? now + state.sleepMinutes * 60000 : null;
}

function consumeSleep(state, now = Date.now()) {
  if (!state.sleepDeadline || now < state.sleepDeadline) return false;
  state.sleepDeadline = null;
  state.sleepMinutes = 0;
  return Boolean(state.active && !state.paused);
}

module.exports = {visibleStations, moveSelection, initialFavorites, toggleFavorite, cycleSleep, consumeSleep};
