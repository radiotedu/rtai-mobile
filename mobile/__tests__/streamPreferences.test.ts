import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  automaticQualityForNetwork,
  DEFAULT_STREAM_PREFERENCES,
  loadStreamPreferences,
  normalizeStreamPreferences,
  resetStreamPreferencesCacheForTests,
  saveStreamPreferences,
  STREAM_PREFERENCES_STORAGE_KEY,
} from '../src/services/streamPreferences';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

describe('stream preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStreamPreferencesCacheForTests();
  });

  it('defaults to recommended normal quality and migrates legacy medium', () => {
    expect(normalizeStreamPreferences(null)).toEqual(
      DEFAULT_STREAM_PREFERENCES,
    );
    expect(
      normalizeStreamPreferences({quality: 'medium', language: 'fr'}),
    ).toEqual({quality: 'normal'});
  });

  it('selects a conservative quality automatically without choosing FLAC', () => {
    expect(
      automaticQualityForNetwork({
        type: 'cellular',
        isConnected: true,
        details: {cellularGeneration: '2g'},
      }),
    ).toBe('low');
    expect(
      automaticQualityForNetwork({
        type: 'cellular',
        isConnected: true,
        details: {cellularGeneration: '4g'},
      }),
    ).toBe('normal');
    expect(
      automaticQualityForNetwork({
        type: 'cellular',
        isConnected: true,
        details: {cellularGeneration: '5g'},
      }),
    ).toBe('high');
    expect(
      automaticQualityForNetwork({type: 'wifi', isConnected: true}),
    ).toBe('high');
    expect(
      automaticQualityForNetwork({type: 'none', isConnected: false}),
    ).toBe('low');
  });

  it('persists the selected quality', async () => {
    const getItem = AsyncStorage.getItem as jest.MockedFunction<
      typeof AsyncStorage.getItem
    >;
    const setItem = AsyncStorage.setItem as jest.MockedFunction<
      typeof AsyncStorage.setItem
    >;
    getItem.mockResolvedValueOnce(
      JSON.stringify({quality: 'high', language: 'en'}),
    );

    await expect(loadStreamPreferences()).resolves.toEqual({
      quality: 'high',
    });
    await saveStreamPreferences({quality: 'flac'});
    expect(setItem).toHaveBeenCalledWith(
      STREAM_PREFERENCES_STORAGE_KEY,
      JSON.stringify({quality: 'flac'}),
    );
  });
});
