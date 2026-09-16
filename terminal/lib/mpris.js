const EventEmitter = require('node:events');

/**
 * Linux MPRIS (Media Player Remote Interfacing Specification) Controller & Stub
 * 
 * Implements org.mpris.MediaPlayer2 and org.mpris.MediaPlayer2.Player D-Bus specs.
 * Allows Linux desktop environments (GNOME, KDE, Sway, Waybar, playerctl)
 * and media keys to inspect and control RadioTEDU playback.
 */
class LinuxMPRIS extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.isLinux = process.platform === 'linux';
    this.identity = 'RadioTEDU Terminal';
    this.desktopEntry = 'radiotedu';
    this.playbackStatus = 'Stopped'; // 'Playing', 'Paused', 'Stopped'
    this.metadata = {
      'mpris:trackid': '/org/radiotedu/track/0',
      'xesam:title': 'RadioTEDU',
      'xesam:artist': ['RadioTEDU'],
      'xesam:album': 'RadioTEDU Live Stream',
      'xesam:url': 'https://radiotedu.com',
      'xesam:comment': ['RadioTEDU Ankara Studios'],
    };
    this.canControl = true;
    this.canPlay = true;
    this.canPause = true;
    this.canGoNext = true;
    this.canGoPrevious = true;
    this.volume = 0.8;
    this._destroyed = false;
  }

  isAvailable() {
    return this.isLinux;
  }

  setPlaybackStatus(status) {
    if (this._destroyed) return this;
    const s = String(status || '').toLowerCase();
    this.playbackStatus = (s === 'playing' || s === 'active') ? 'Playing' : s === 'paused' ? 'Paused' : 'Stopped';
    this.emit('playbackStatusChanged', this.playbackStatus);
    return this;
  }

  setMetadata(meta = {}) {
    if (this._destroyed) return this;
    this.metadata = {
      'mpris:trackid': `/org/radiotedu/track/${Date.now()}`,
      'xesam:title': meta.title || 'RadioTEDU',
      'xesam:artist': [meta.artist || meta.station || 'RadioTEDU'],
      'xesam:album': meta.album || 'RadioTEDU Live Stream',
      'xesam:url': meta.url || 'https://radiotedu.com',
      'xesam:comment': ['RadioTEDU Ankara Studios'],
    };
    this.emit('metadataChanged', this.metadata);
    return this;
  }

  setVolume(vol) {
    if (this._destroyed) return this.volume;
    this.volume = Math.max(0, Math.min(1, vol / 100));
    this.emit('volumeChanged', this.volume);
    return this.volume;
  }

  // D-Bus method call handlers (used by playerctl or media keys)
  Play() { this.emit('play'); }
  Pause() { this.emit('pause'); }
  PlayPause() { this.emit('toggle'); }
  Stop() { this.emit('stop'); }
  Next() { this.emit('next'); }
  Previous() { this.emit('previous'); }

  getState() {
    return {
      available: this.isAvailable(),
      platform: process.platform,
      identity: this.identity,
      playbackStatus: this.playbackStatus,
      metadata: {...this.metadata},
      canControl: this.canControl,
      volume: this.volume,
    };
  }

  destroy() {
    this._destroyed = true;
    this.removeAllListeners();
  }
}

module.exports = {LinuxMPRIS};
