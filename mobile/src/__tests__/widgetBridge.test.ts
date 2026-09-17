import {
  getAppWidgetState,
  updateAppWidget,
  subscribeToWidgetState,
  initAppWidget,
  WidgetPlaybackState,
} from '../services/widgetBridge';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] || null),
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    clear: jest.fn(async () => {
      store = {};
    }),
  };
});

describe('Android AppWidget Bridge Service', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('retrieves default initial widget state', () => {
    const state = getAppWidgetState();
    expect(state).toBeTruthy();
    expect(state.stationName).toBe('RadioTEDU');
    expect(typeof state.isPlaying).toBe('boolean');
  });

  it('updates widget state and notifies subscribers', async () => {
    const receivedStates: WidgetPlaybackState[] = [];
    const unsubscribe = subscribeToWidgetState(s => {
      receivedStates.push(s);
    });

    const updated = await updateAppWidget('RadioTEDU Jazz', 'Miles Davis - So What', true);

    expect(updated.stationName).toBe('RadioTEDU Jazz');
    expect(updated.trackTitle).toBe('Miles Davis - So What');
    expect(updated.isPlaying).toBe(true);

    expect(receivedStates.length).toBeGreaterThanOrEqual(2); // initial + updated
    expect(receivedStates[receivedStates.length - 1].stationName).toBe('RadioTEDU Jazz');

    unsubscribe();
  });

  it('persists and restores widget state via AsyncStorage', async () => {
    await updateAppWidget('RadioTEDU Classical', 'Beethoven - Symphony No. 9', false);

    expect(AsyncStorage.setItem).toHaveBeenCalled();

    const restored = await initAppWidget();
    expect(restored.stationName).toBe('RadioTEDU Classical');
    expect(restored.trackTitle).toBe('Beethoven - Symphony No. 9');
    expect(restored.isPlaying).toBe(false);
  });
});
