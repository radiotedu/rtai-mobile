import {NativeModules, Platform, Linking} from 'react-native';

const {RadioTeduPipBridge} = NativeModules;

export interface PipStatus {
  supported: boolean;
  allowed: boolean;
}

/**
 * Checks if Picture-in-Picture is supported by the device OS.
 */
function getAndroidApiLevel(): number {
  const v = Platform.Version ?? (Platform.constants as any)?.Version;
  const num = Number(v);
  return isNaN(num) ? 33 : num;
}

/**
 * Checks if Picture-in-Picture is supported by the device OS.
 */
export async function isPipSupported(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  const bridge = NativeModules.RadioTeduPipBridge;
  if (bridge?.isPipSupported) {
    try {
      return await bridge.isPipSupported();
    } catch {
      return getAndroidApiLevel() >= 26;
    }
  }
  return getAndroidApiLevel() >= 26;
}

/**
 * Checks if Picture-in-Picture permission is currently allowed for this app.
 */
export async function isPipAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  const bridge = NativeModules.RadioTeduPipBridge;
  if (bridge?.isPipAllowed) {
    try {
      return await bridge.isPipAllowed();
    } catch {
      return true;
    }
  }
  return getAndroidApiLevel() >= 26;
}

/**
 * Requests PiP permission by opening the system special app access settings.
 */
export async function requestPipPermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  if (RadioTeduPipBridge?.requestPipPermission) {
    try {
      await RadioTeduPipBridge.requestPipPermission();
      return;
    } catch {
      // fallback to openSettings
    }
  }
  try {
    await Linking.openSettings();
  } catch {
    // Best-effort
  }
}

/**
 * Enters Android Picture-in-Picture mode with given aspect ratio.
 */
export async function enterPictureInPicture(
  numerator: number = 16,
  denominator: number = 9,
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  if (RadioTeduPipBridge?.enterPictureInPicture) {
    try {
      return await RadioTeduPipBridge.enterPictureInPicture(numerator, denominator);
    } catch {
      return false;
    }
  }
  return false;
}
