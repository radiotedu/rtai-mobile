const STREAM_ORIGIN = process.env.RADIOTEDU_STREAM_ORIGIN || 'https://stream.radiotedu.com';
const SUPPORTED_CODECS = Object.freeze(['HE-AAC v2', 'AAC-LC', 'MP3', 'Ogg/Opus', 'FLAC']);

const STATIONS = [
  {id: 'radio', name: 'RadioTEDU', mount: '/radio', description: 'Main channel', flac: false},
  {id: 'classic', name: 'Classic', mount: '/classic', description: 'Classical music', flac: true},
  {id: 'cazz', name: 'Jazz', mount: '/cazz', description: 'Jazz music', flac: true},
  {id: 'lofi', name: 'Lo-Fi', mount: '/lofi', description: 'Lo-Fi beats', flac: false},
  {id: 'energize', name: 'Energize', mount: '/energize', description: 'High energy', flac: false},
  {id: 'rock', name: 'Rock', mount: '/rock', description: 'Rock music', flac: false},
  {id: 'spark', name: 'Spark', mount: '/spark', description: 'rtAI host', flac: false, liveCheck: true},
  {id: 'en', name: 'RadioTEDU English', mount: '/en', description: 'English broadcast', flac: false, liveCheck: true},
  {id: 'fr', name: 'RadioTEDU Français', mount: '/fr', description: 'French broadcast', flac: false, liveCheck: true},
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
  if (quality === 'flac' && !item.flac) throw new Error(`${item.name} has no FLAC mount.`);
  if (!['low', 'normal', 'flac'].includes(quality)) throw new Error('Quality must be low, normal, or flac.');
  const suffix = quality === 'normal' ? '' : `-${quality}`;
  return `${STREAM_ORIGIN}${item.mount}${suffix}`;
}

function codecFor(quality) {
  return quality === 'flac' ? 'FLAC' : 'HE-AAC v2';
}

function listStations() {
  return STATIONS.map(item => ({...item, qualities: item.flac ? ['normal', 'low', 'flac'] : ['normal', 'low']}));
}

module.exports = {STREAM_ORIGIN, SUPPORTED_CODECS, STATIONS, getStation, streamUrl, codecFor, listStations};
