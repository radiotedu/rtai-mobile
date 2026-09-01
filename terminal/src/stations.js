const STREAM_ORIGIN = process.env.RADIOTEDU_STREAM_ORIGIN || 'https://stream.radiotedu.com';
const SUPPORTED_CODECS = Object.freeze(['HE-AAC v2', 'AAC-LC', 'MP3', 'Ogg/Opus', 'FLAC']);

const STATIONS = [
  {id: 'radio', name: 'RadioTEDU', mount: '/radio', description: 'Main channel', qualities: ['normal', 'low']},
  {id: 'classic', name: 'Classical', mount: '/classic', description: 'Classical music', qualities: ['normal', 'low', 'flac']},
  {id: 'cazz', name: 'Jazz', mount: '/cazz', description: 'Jazz music', qualities: ['normal', 'low', 'flac'], goldId: 'jazz'},
  {id: 'lofi', name: 'Lo-Fi', mount: '/lofi', description: 'Lo-Fi beats', qualities: ['normal', 'low']},
  {id: 'energize', name: 'Energize', mount: '/energize', description: 'High energy', qualities: ['normal', 'low']},
  {id: 'rock', name: 'Rock', mount: '/rock', description: 'Rock music', qualities: ['normal', 'low']},
  {id: 'en', name: 'RadioTEDU English', mount: '/en', description: 'English broadcast', qualities: ['normal'], codec: 'MP3', liveCheck: true},
  {id: 'fr', name: 'RadioTEDU Français', mount: '/fr', description: 'French broadcast', qualities: ['normal'], codec: 'MP3', liveCheck: true},
  // Voting has one Ogg mount and must stay at the bottom when live.
  {id: 'spark', name: 'RadioTEDU Voting', mount: '/spark', description: 'Interactive voting radio', qualities: ['normal'], codec: 'Ogg/Opus', liveCheck: true},
];

function getStation(id) {
  const normalized = String(id || '').toLowerCase().replace(/^\//, '');
  const aliases = {jazz: 'cazz', 'lo-fi': 'lofi', main: 'radio', french: 'fr', english: 'en'};
  const station = STATIONS.find(item => item.id === (aliases[normalized] || normalized));
  if (!station) throw new Error(`Unknown station: ${id}. Use "radiotedu stations".`);
  return station;
}

function streamUrl(station, quality = 'normal') {
  const item = typeof station === 'string' ? getStation(station) : station;
  if (!['low', 'normal', 'flac'].includes(quality)) throw new Error('Quality must be low, normal, or flac.');
  if (!item.qualities.includes(quality)) throw new Error(`${item.name} has no ${quality.toUpperCase()} mount.`);
  const suffix = quality === 'normal' ? '' : `-${quality}`;
  return `${STREAM_ORIGIN}${item.mount}${suffix}`;
}

function codecFor(quality, station) {
  const item = station ? (typeof station === 'string' ? getStation(station) : station) : null;
  return quality === 'flac' ? 'FLAC' : (item?.codec || 'HE-AAC v2');
}

function listStations() {
  return STATIONS.map(item => ({...item, flac: item.qualities.includes('flac')}));
}

module.exports = {STREAM_ORIGIN, SUPPORTED_CODECS, STATIONS, getStation, streamUrl, codecFor, listStations};
