/**
 * DSP Loudness Normalization Module for RadioTEDU
 * 
 * Implements EBU R 128 / ITU-R BS.1770-5 loudness normalization and true-peak limiting.
 * Target: -16 LUFS integrated loudness, -1.5 dBFS true-peak ceiling, LRA 11
 * Broadcast Reference: -23 LUFS / -1 dBFS ceiling
 */
class DspNormalization {
  constructor(options = {}) {
    this.enabled = options.enabled ?? false;
    this.targetLufs = options.targetLufs || -16;
    this.truePeak = options.truePeak || -1.5;
    this.lra = options.lra || 11;
    this.standard = 'EBU R128 / ITU-R BS.1770-5';
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
    return this.enabled;
  }

  getAudioFilter(playerType = 'ffplay') {
    if (!this.enabled) return null;
    return `loudnorm=I=${this.targetLufs}:TP=${this.truePeak}:LRA=${this.lra}`;
  }

  getPlayerArguments(command) {
    if (!this.enabled) return [];
    const lower = String(command || '').toLowerCase();
    if (lower.includes('ffplay')) {
      return ['-af', this.getAudioFilter('ffplay')];
    }
    if (lower.includes('mpv')) {
      return [`--af=${this.getAudioFilter('mpv')}`];
    }
    return [];
  }

  getStatusString() {
    return this.enabled
      ? `ON (${this.standard} · ${this.targetLufs} LUFS)`
      : 'OFF (Bypass)';
  }
}

module.exports = {DspNormalization};
