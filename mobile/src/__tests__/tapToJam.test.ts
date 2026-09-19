import {NativeModules, PermissionsAndroid, Platform, DeviceEventEmitter} from 'react-native';
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');
NativeModules.NearbyJam = {startAdvertising: jest.fn().mockResolvedValue(null), startDiscovery: jest.fn().mockResolvedValue(null), stop: jest.fn(), addListener: jest.fn(), removeListeners: jest.fn()};
Platform.OS = 'android';
Object.defineProperty(Platform, 'Version', {value: 35, configurable: true});
const {generateTapToJamUrl, parseTapToJamUrl, startNearbyJamBroadcast, detectNearbyPeerJam, stopNearbyJamBroadcast, subscribeToNearbyBeacons} = require('../services/tapToJamService');
describe('real nearby adapter and invitations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockImplementation(async permissions => Object.fromEntries(permissions.map(p => [p, 'granted'])) as any);
  });
  afterEach(() => jest.restoreAllMocks());
  it('roundtrips exact links and rejects lookalike routes and malformed codes', () => {
    expect(parseTapToJamUrl(generateTapToJamUrl('123456'))).toBe('123456');
    expect(parseTapToJamUrl('https://radiotedu.com/jam/654321')).toBe('654321');
    for (const bad of ['radiotedu://jammer?code=123456', 'radiotedu://jam?code=1234567', 'https://radiotedu.com.evil/jam?code=123456', 'radiotedu://jam?code=123456&code=654321']) expect(parseTapToJamUrl(bad)).toBeNull();
    expect(() => generateTapToJamUrl('12x3456')).toThrow();
  });
  it('advertises and scans using native methods, without self-detection', async () => {
    const found = jest.fn(); const unsubscribe = subscribeToNearbyBeacons(found);
    await startNearbyJamBroadcast('123456'); await detectNearbyPeerJam();
    expect(NativeModules.NearbyJam.startAdvertising).toHaveBeenCalledWith('123456');
    expect(NativeModules.NearbyJam.startDiscovery).toHaveBeenCalled();
    expect(found).not.toHaveBeenCalled();
    DeviceEventEmitter.emit('NearbyJamBeacon', {endpointId: 'peer', roomCode: '654321'});
    expect(found).toHaveBeenCalledWith(expect.objectContaining({roomCode: '654321'}));
    DeviceEventEmitter.emit('NearbyJamBeacon', {endpointId: 'peer', roomCode: null});
    expect(found).toHaveBeenLastCalledWith(null);
    unsubscribe(); stopNearbyJamBroadcast(); expect(NativeModules.NearbyJam.stop).toHaveBeenCalled();
  });
  it('does not advertise when permission is denied', async () => {
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({});
    await expect(startNearbyJamBroadcast('123456')).rejects.toThrow();
    expect(NativeModules.NearbyJam.startAdvertising).not.toHaveBeenCalled();
  });
  it('cancels starts if the user closes during permission request', async () => {
    let resolve: any;
    (PermissionsAndroid.requestMultiple as jest.Mock).mockImplementation(permissions => new Promise(r => { resolve = () => r(Object.fromEntries(permissions.map((p: string) => [p, 'granted']))); }));
    const pending = startNearbyJamBroadcast('123456'); stopNearbyJamBroadcast(); resolve(); await pending;
    expect(NativeModules.NearbyJam.startAdvertising).not.toHaveBeenCalled();
  });
});
