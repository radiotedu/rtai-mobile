import {beforeEach, describe, expect, it} from '@jest/globals';
import {
  markPlaybackPaused,
  markPlaybackRequested,
  markPlaybackStopped,
  resetPlaybackIntentForTests,
  selectImmediateLowRecovery,
  shouldAutoRecoverPlayback,
} from '../src/services/playbackIntent';

const fallbacks = [
  {quality: 'flac', url: 'https://stream.radiotedu.com/radio-flac'},
  {quality: 'normal', url: 'https://stream.radiotedu.com/radio'},
  {quality: 'low', url: 'https://stream.radiotedu.com/radio-low'},
  {quality: 'legacy', url: 'https://legacy.radiotedu.com/radio'},
] as const;

describe('playback recovery intent', () => {
  beforeEach(resetPlaybackIntentForTests);

  it('recovers only while playback is requested', () => {
    expect(shouldAutoRecoverPlayback()).toBe(false);
    markPlaybackRequested();
    expect(shouldAutoRecoverPlayback()).toBe(true);
    markPlaybackPaused();
    expect(shouldAutoRecoverPlayback()).toBe(false);
    markPlaybackRequested();
    markPlaybackStopped();
    expect(shouldAutoRecoverPlayback()).toBe(false);
  });

  it('jumps from FLAC or normal directly to the same station low mount', () => {
    expect(selectImmediateLowRecovery(fallbacks, fallbacks[0].url)).toBe(fallbacks[2]);
    expect(selectImmediateLowRecovery(fallbacks, fallbacks[1].url)).toBe(fallbacks[2]);
  });

  it('uses the next legacy candidate only after low is already active', () => {
    expect(selectImmediateLowRecovery(fallbacks, fallbacks[2].url)).toBe(fallbacks[3]);
    expect(selectImmediateLowRecovery(fallbacks, fallbacks[3].url)).toBeUndefined();
  });
});
