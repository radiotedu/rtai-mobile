const {WindowsSMTC} = require('./smtc');
const {LinuxMPRIS} = require('./mpris');
const {MediaControls} = require('./media-controls');
const {DspNormalization} = require('./dsp');
const {getWrappedSummary} = require('./wrapped');
const {getDiagnosticsSnapshot} = require('./diagnostics');

module.exports = {
  WindowsSMTC,
  LinuxMPRIS,
  MediaControls,
  DspNormalization,
  getWrappedSummary,
  getDiagnosticsSnapshot,
};
