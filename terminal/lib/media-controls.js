const EventEmitter = require('node:events');
const {WindowsSMTC} = require('./smtc');
const {LinuxMPRIS} = require('./mpris');

/**
 * Unified Media Controls Dispatcher
 * Bridges Windows SMTC, Linux MPRIS, and hardware keyboard media keys.
 */
class MediaControls extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.smtc = new WindowsSMTC(options);
    this.mpris = new LinuxMPRIS(options);

    // Forward events from either provider
    const forward = (event) => {
      this.smtc.on(event, (...args) => this.emit(event, ...args));
      this.mpris.on(event, (...args) => this.emit(event, ...args));
    };
    ['play', 'pause', 'toggle', 'next', 'previous', 'stop'].forEach(forward);
  }

  getActiveProvider() {
    if (process.platform === 'win32') return 'Windows SMTC';
    if (process.platform === 'linux') return 'Linux MPRIS';
    return 'Generic Media Transport';
  }

  updatePlayback({status, station, trackTitle, artist, album, volume}) {
    const title = trackTitle || (station ? station.name : 'RadioTEDU');
    const artistName = artist || (station ? station.name : 'RadioTEDU');
    const albumName = album || 'RadioTEDU Live Stream';

    // Update Windows SMTC
    this.smtc.setPlaybackStatus(status);
    this.smtc.setMetadata({
      title,
      artist: artistName,
      album: albumName,
      station: station?.name || 'RadioTEDU',
    });
    this.smtc.setTimeline({isLive: true});

    // Update Linux MPRIS
    this.mpris.setPlaybackStatus(status);
    this.mpris.setMetadata({
      title,
      artist: artistName,
      album: albumName,
      station: station?.name || 'RadioTEDU',
    });
    if (typeof volume === 'number') {
      this.mpris.setVolume(volume);
    }
  }

  handleMediaKey(key) {
    const k = String(key || '').toLowerCase();
    if (k === 'mediaplaypause' || k === 'playpause') this.emit('toggle');
    else if (k === 'mediaplay' || k === 'play') this.emit('play');
    else if (k === 'mediapause' || k === 'pause') this.emit('pause');
    else if (k === 'medianext' || k === 'next') this.emit('next');
    else if (k === 'mediaprev' || k === 'previous') this.emit('previous');
    else if (k === 'mediastop' || k === 'stop') this.emit('stop');
  }

  destroy() {
    this.smtc.destroy();
    this.mpris.destroy();
    this.removeAllListeners();
  }
}

module.exports = {MediaControls};
