export type PlaybackIntent = 'play' | 'pause' | 'stop';

export interface RecoveryCandidate {
  url: string;
  quality: string;
}

let playbackIntent: PlaybackIntent = 'stop';

export function markPlaybackRequested(): void {
  playbackIntent = 'play';
}

export function markPlaybackPaused(): void {
  playbackIntent = 'pause';
}

export function markPlaybackStopped(): void {
  playbackIntent = 'stop';
}

export function shouldAutoRecoverPlayback(): boolean {
  return playbackIntent === 'play';
}

/**
 * Network recovery deliberately jumps straight to the station's low mount.
 * If low is already active, the next candidate may be the legacy mount.
 */
export function selectImmediateLowRecovery<T extends RecoveryCandidate>(
  fallbacks: readonly T[],
  currentUrl: string,
): T | undefined {
  const currentIndex = fallbacks.findIndex(item => item.url === currentUrl);
  const lowIndex = fallbacks.findIndex(item => item.quality === 'low');

  if (lowIndex !== -1 && currentIndex < lowIndex) {
    return fallbacks[lowIndex];
  }

  const next = fallbacks[currentIndex + 1];
  if (next) {
    return next;
  }

  // Some live channels (currently AI EN/FR) intentionally publish no low
  // mount. Re-opening the same URL is safer than synthesizing a dead `-low`.
  return lowIndex === -1 && currentIndex !== -1
    ? fallbacks[currentIndex]
    : undefined;
}

export function resetPlaybackIntentForTests(): void {
  playbackIntent = 'stop';
}
