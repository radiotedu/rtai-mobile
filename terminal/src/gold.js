const crypto = require('node:crypto');
const {loadAuth} = require('./store');
const {startListening, heartbeatListening} = require('./api');

function rewardBalance(reward) {
  const value = Number(reward?.spendablePoints ?? reward?.spendable_points ?? reward?.points?.spendable_points);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

class ListeningGold {
  constructor({isPlaying, onUpdate = () => {}}) {
    this.isPlaying = isPlaying;
    this.onUpdate = onUpdate;
    this.timer = null;
    this.proof = null;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.proof = null;
  }

  async start(channelId) {
    this.stop();
    if (!loadAuth()?.access_token) return false;
    const result = await startListening(channelId, crypto.randomUUID());
    this.proof = {sessionId: result.session.id, nonce: result.nonce, inFlight: false};
    const seconds = Math.max(15, Math.min(120, Number(result.heartbeat_after_seconds) || 25));
    this.timer = setInterval(
      () => this.heartbeat().catch(error => this.onUpdate({reward: null, balance: null, error})),
      seconds * 1000,
    );
    this.timer.unref?.();
    return true;
  }

  async heartbeat() {
    const proof = this.proof;
    if (!proof || proof.inFlight || !this.isPlaying()) return;
    proof.inFlight = true;
    try {
      const result = await heartbeatListening(proof.sessionId, proof.nonce);
      proof.nonce = result.nonce;
      this.onUpdate({reward: result.reward || null, balance: rewardBalance(result.reward)});
    } finally {
      proof.inFlight = false;
    }
  }
}

module.exports = {ListeningGold, rewardBalance};
