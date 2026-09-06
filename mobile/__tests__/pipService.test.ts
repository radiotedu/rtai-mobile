import {Platform, Linking} from 'react-native';
import {
  isPipSupported,
  isPipAllowed,
  requestPipPermission,
  enterPictureInPicture,
} from '../src/services/pipService';

describe('pipService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reports not supported on non-android platforms', async () => {
    Platform.OS = 'ios';
    expect(await isPipSupported()).toBe(false);
    expect(await isPipAllowed()).toBe(false);
    expect(await enterPictureInPicture()).toBe(false);
  });

  test('reports supported on Android API >= 26', async () => {
    Platform.OS = 'android';
    Object.defineProperty(Platform, 'Version', {value: 34, configurable: true});
    expect(await isPipSupported()).toBe(true);
    expect(await isPipAllowed()).toBe(true);
  });

  test('requests permission via settings fallback', async () => {
    Platform.OS = 'android';
    const openSettingsSpy = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

    await requestPipPermission();
    expect(openSettingsSpy).toHaveBeenCalled();
  });
});
