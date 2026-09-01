import {useEffect, useState} from 'react';
import TrackPlayer from 'react-native-track-player';
import {pausePlaybackByUser} from './playbackQueue';
import {logSafeError} from '../utils/safeLog';

type SleepTimerListener = (remainingSeconds: number | null) => void;

let timerInterval: ReturnType<typeof setInterval> | null = null;
let targetTimestamp: number | null = null;
const listeners = new Set<SleepTimerListener>();

function notifyListeners(remaining: number | null) {
  listeners.forEach(listener => {
    try {
      listener(remaining);
    } catch (e) {
      logSafeError('sleepTimer.listener', e);
    }
  });
}

/**
 * Start or update the sleep timer.
 * @param minutes Duration in minutes. If <= 0, cancels the timer.
 */
export function setSleepTimer(minutes: number): void {
  cancelSleepTimer();

  if (minutes <= 0) {
    return;
  }

  targetTimestamp = Date.now() + minutes * 60 * 1000;
  const initialRemaining = minutes * 60;
  notifyListeners(initialRemaining);

  timerInterval = setInterval(async () => {
    if (!targetTimestamp) {
      cancelSleepTimer();
      return;
    }

    const remainingMs = targetTimestamp - Date.now();
    if (remainingMs <= 0) {
      cancelSleepTimer();
      try {
        // Gently ramp volume down before pause
        await TrackPlayer.setVolume(0.4).catch(() => {});
        await new Promise(r => setTimeout(r, 250));
        await TrackPlayer.setVolume(0.1).catch(() => {});
        await new Promise(r => setTimeout(r, 250));
        await pausePlaybackByUser();
        await TrackPlayer.setVolume(1.0).catch(() => {});
      } catch (err) {
        logSafeError('sleepTimer.expire', err);
        await pausePlaybackByUser().catch(() => {});
      }
      return;
    }

    notifyListeners(Math.ceil(remainingMs / 1000));
  }, 1000);
}

/**
 * Cancel the active sleep timer.
 */
export function cancelSleepTimer(): void {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  targetTimestamp = null;
  notifyListeners(null);
}

/**
 * Get remaining sleep timer seconds, or null if no timer is active.
 */
export function getRemainingSleepTimerSeconds(): number | null {
  if (!targetTimestamp) {
    return null;
  }
  const remainingMs = targetTimestamp - Date.now();
  if (remainingMs <= 0) {
    return null;
  }
  return Math.ceil(remainingMs / 1000);
}

/**
 * Subscribe to sleep timer changes.
 */
export function subscribeSleepTimer(listener: SleepTimerListener): () => void {
  listeners.add(listener);
  listener(getRemainingSleepTimerSeconds());
  return () => {
    listeners.delete(listener);
  };
}

/**
 * React hook for consuming sleep timer state.
 */
export function useSleepTimer(): {
  remainingSeconds: number | null;
  setTimer: (minutes: number) => void;
  cancelTimer: () => void;
  isActive: boolean;
} {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    getRemainingSleepTimerSeconds(),
  );

  useEffect(() => {
    return subscribeSleepTimer(setRemainingSeconds);
  }, []);

  return {
    remainingSeconds,
    setTimer: setSleepTimer,
    cancelTimer: cancelSleepTimer,
    isActive: remainingSeconds !== null && remainingSeconds > 0,
  };
}
