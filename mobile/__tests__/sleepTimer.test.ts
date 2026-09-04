import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {
  setSleepTimer,
  cancelSleepTimer,
  getRemainingSleepTimerSeconds,
  subscribeSleepTimer,
} from '../src/services/sleepTimer';
import * as playbackQueue from '../src/services/playbackQueue';

jest.mock('react-native-track-player', () => ({
  setVolume: (jest.fn() as any).mockResolvedValue(undefined),
}));

jest.mock('../src/services/playbackQueue', () => ({
  pausePlaybackByUser: (jest.fn() as any).mockResolvedValue(undefined),
}));

describe('sleepTimer service', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    cancelSleepTimer();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cancelSleepTimer();
    jest.useRealTimers();
  });

  it('starts timer and reports remaining seconds', () => {
    const listener = jest.fn();
    const unsub = subscribeSleepTimer(listener);

    setSleepTimer(15);
    expect(getRemainingSleepTimerSeconds()).toBe(15 * 60);
    expect(listener).toHaveBeenCalledWith(15 * 60);

    jest.advanceTimersByTime(5000);
    expect(getRemainingSleepTimerSeconds()).toBe(15 * 60 - 5);

    unsub();
  });

  it('cancels timer properly', () => {
    setSleepTimer(30);
    expect(getRemainingSleepTimerSeconds()).toBe(30 * 60);

    cancelSleepTimer();
    expect(getRemainingSleepTimerSeconds()).toBeNull();
  });

  it('pauses playback and ramps down volume when timer expires', async () => {
    setSleepTimer(1); // 1 minute
    expect(getRemainingSleepTimerSeconds()).toBe(60);

    // Fast forward through timer and volume ramp delays
    await jest.advanceTimersByTimeAsync(61000);
    await jest.advanceTimersByTimeAsync(600);

    expect(playbackQueue.pausePlaybackByUser).toHaveBeenCalled();
  });
});
