import {Linking} from 'react-native';
import {logSafeError} from '../utils/safeLog';

export interface NearbyJamBeacon {
  roomCode: string;
  channelId: string;
  channelName: string;
  hostName: string;
  signalStrength: number; // 0 to 1
  timestamp: number;
}

const JAM_DEEP_LINK_SCHEME = 'radiotedu://jam';
const JAM_WEB_LINK_PREFIX = 'https://radiotedu.com/jam';

let activeBroadcastCode: string | null = null;
const beaconListeners = new Set<(beacon: NearbyJamBeacon | null) => void>();

/**
 * Generates official deep link and web URL for Tap-to-Jam NFC tag or QR/beam payload
 */
export function generateTapToJamUrl(roomCode: string): string {
  const clean = roomCode.trim().replace(/[^0-9]/g, '').slice(0, 6);
  return `${JAM_DEEP_LINK_SCHEME}?code=${clean}`;
}

/**
 * Parses deep link, NFC payload or web URL to extract the 6-digit Jam Room code
 */
export function parseTapToJamUrl(urlOrPayload: string): string | null {
  if (!urlOrPayload || typeof urlOrPayload !== 'string') {
    return null;
  }

  const trimmed = urlOrPayload.trim();

  // 1. Check radiotedu://jam?code=123456 or radiotedu://jam/123456
  if (trimmed.startsWith(JAM_DEEP_LINK_SCHEME)) {
    const codeMatch = trimmed.match(/[?&]code=([0-9]{6})/i) || trimmed.match(/jam\/([0-9]{6})/i);
    if (codeMatch && codeMatch[1]) {
      return codeMatch[1];
    }
  }

  // 2. Check https://radiotedu.com/jam?code=123456 or /jam/123456
  if (trimmed.startsWith(JAM_WEB_LINK_PREFIX)) {
    const webMatch = trimmed.match(/[?&]code=([0-9]{6})/i) || trimmed.match(/jam\/([0-9]{6})/i);
    if (webMatch && webMatch[1]) {
      return webMatch[1];
    }
  }

  // 3. Raw 6-digit code
  if (/^[0-9]{6}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Starts broadcasting simulated local acoustic / NFC beacon for peer devices
 */
export function startNearbyJamBroadcast(roomCode: string): void {
  activeBroadcastCode = roomCode;
}

/**
 * Stops broadcasting local beacon
 */
export function stopNearbyJamBroadcast(): void {
  activeBroadcastCode = null;
}

/**
 * Returns currently broadcasting room code if any
 */
export function getActiveBroadcastCode(): string | null {
  return activeBroadcastCode;
}

/**
 * Simulates finding a nearby peer device broadcasting a Jam session
 */
export function detectNearbyPeerJam(simulatedBeacon?: NearbyJamBeacon): NearbyJamBeacon | null {
  if (simulatedBeacon) {
    beaconListeners.forEach(l => l(simulatedBeacon));
    return simulatedBeacon;
  }

  if (activeBroadcastCode) {
    const beacon: NearbyJamBeacon = {
      roomCode: activeBroadcastCode,
      channelId: 'radiotedu-main',
      channelName: 'RadioTEDU',
      hostName: 'TEDÜ Dinleyicisi',
      signalStrength: 0.95,
      timestamp: Date.now(),
    };
    beaconListeners.forEach(l => l(beacon));
    return beacon;
  }

  return null;
}

/**
 * Subscribes to nearby detected Jam beacons
 */
export function subscribeToNearbyBeacons(
  callback: (beacon: NearbyJamBeacon | null) => void,
): () => void {
  beaconListeners.add(callback);
  return () => {
    beaconListeners.delete(callback);
  };
}
