import {NativeEventEmitter, NativeModules, PermissionsAndroid, Platform} from 'react-native';

export interface NearbyJamBeacon {
  roomCode: string;
  channelId: string;
  channelName: string;
  hostName: string;
  timestamp: number;
}
const bridge = NativeModules.NearbyJam;
export const nearbyJamSupported = Platform.OS === 'android' && !!bridge;
let generation = 0;
export function generateTapToJamUrl(roomCode: string): string {
  if (!/^\d{6}$/.test(roomCode)) throw new Error('Invalid room code');
  return `radiotedu://jam?code=${roomCode}`;
}
export function parseTapToJamUrl(value: string): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (/^\d{6}$/.test(input)) return input;
  const match = /^(?:radiotedu:\/\/jam|https:\/\/radiotedu\.com\/jam)(?:\?code=(\d{6})|\/(\d{6}))$/.exec(input);
  return match ? match[1] || match[2] : null;
}
async function requestNearbyPermission(): Promise<void> {
  if (!nearbyJamSupported) throw new Error('Nearby unavailable');
  const p = PermissionsAndroid.PERMISSIONS;
  const api = Number(Platform.Version);
  const required = api >= 31 ? [p.BLUETOOTH_SCAN, p.BLUETOOTH_CONNECT, p.BLUETOOTH_ADVERTISE] : [];
  if (api <= 31) required.push(p.ACCESS_FINE_LOCATION, p.ACCESS_COARSE_LOCATION);
  if (api >= 33) required.push(p.NEARBY_WIFI_DEVICES);
  const result = await PermissionsAndroid.requestMultiple(required);
  if (required.some(permission => result[permission] !== PermissionsAndroid.RESULTS.GRANTED)) throw new Error('Nearby permission denied');
}
export async function startNearbyJamBroadcast(roomCode: string): Promise<void> {
  generateTapToJamUrl(roomCode);
  const request = ++generation;
  await requestNearbyPermission();
  if (request !== generation) return;
  await bridge.startAdvertising(roomCode);
}
export async function detectNearbyPeerJam(): Promise<void> {
  const request = ++generation;
  await requestNearbyPermission();
  if (request !== generation) return;
  await bridge.startDiscovery();
}
export function stopNearbyJamBroadcast(): void {
  generation++;
  bridge?.stop();
}
export function subscribeToNearbyBeacons(callback: (beacon: NearbyJamBeacon | null) => void): () => void {
  if (!nearbyJamSupported) return () => {};
  let currentEndpoint: string | null = null;
  const subscription = new NativeEventEmitter(bridge).addListener('NearbyJamBeacon', event => {
    if (!event.roomCode) {
      if (currentEndpoint === event.endpointId) { currentEndpoint = null; callback(null); }
      return;
    }
    if (!/^\d{6}$/.test(event.roomCode)) return;
    currentEndpoint = event.endpointId;
    callback({roomCode: event.roomCode, channelId: '', channelName: 'Jam', hostName: '', timestamp: Date.now()});
  });
  return () => subscription.remove();
}
