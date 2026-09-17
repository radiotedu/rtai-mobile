import {NativeModules, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {logSafeError} from '../utils/safeLog';

export interface WidgetPlaybackState {
  stationName: string;
  trackTitle: string;
  isPlaying: boolean;
  updatedAt: number;
}

const WIDGET_STORAGE_KEY = '@radiotedu/widget_state_v1';

let currentWidgetState: WidgetPlaybackState = {
  stationName: 'RadioTEDU',
  trackTitle: 'TED Üniversitesi Radyosu',
  isPlaying: false,
  updatedAt: Date.now(),
};

const widgetListeners = new Set<(state: WidgetPlaybackState) => void>();

export function getAppWidgetState(): WidgetPlaybackState {
  return {...currentWidgetState};
}

export function subscribeToWidgetState(
  callback: (state: WidgetPlaybackState) => void,
): () => void {
  widgetListeners.add(callback);
  callback(getAppWidgetState());
  return () => {
    widgetListeners.delete(callback);
  };
}

/**
 * Updates the Android home screen widget with the latest playback information.
 * On Android, if a native module is registered, it triggers an instant RemoteViews refresh.
 */
export async function updateAppWidget(
  stationName: string,
  trackTitle: string,
  isPlaying: boolean,
): Promise<WidgetPlaybackState> {
  const safeStation = stationName && stationName.trim() ? stationName.trim() : 'RadioTEDU';
  const safeTrack = trackTitle && trackTitle.trim() ? trackTitle.trim() : 'Canlı Yayın';

  currentWidgetState = {
    stationName: safeStation,
    trackTitle: safeTrack,
    isPlaying,
    updatedAt: Date.now(),
  };

  // Notify JS subscribers
  widgetListeners.forEach(listener => {
    try {
      listener(getAppWidgetState());
    } catch (err) {
      logSafeError('widgetBridge.notify', err);
    }
  });

  // Persist latest state
  try {
    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(currentWidgetState));
  } catch (err) {
    logSafeError('widgetBridge.persist', err);
  }

  // Native Android Widget Update
  if (Platform.OS === 'android') {
    try {
      const bridge = NativeModules.RadioTeduWidgetBridge;
      if (bridge && typeof bridge.updateWidgetData === 'function') {
        bridge.updateWidgetData(safeStation, safeTrack, isPlaying);
      }
    } catch (err) {
      logSafeError('widgetBridge.nativeUpdate', err);
    }
  }

  return getAppWidgetState();
}

/**
 * Restores widget state from AsyncStorage upon app launch
 */
export async function initAppWidget(): Promise<WidgetPlaybackState> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.stationName === 'string') {
        currentWidgetState = {
          stationName: parsed.stationName,
          trackTitle: parsed.trackTitle || 'Canlı Yayın',
          isPlaying: !!parsed.isPlaying,
          updatedAt: parsed.updatedAt || Date.now(),
        };
      }
    }
  } catch (err) {
    logSafeError('widgetBridge.init', err);
  }
  return getAppWidgetState();
}
