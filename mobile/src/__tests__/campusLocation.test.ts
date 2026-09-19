import Geolocation from '@react-native-community/geolocation';
import {AppState, PermissionsAndroid, Platform} from 'react-native';
import {startCampusLocation} from '../services/campusLocationService';
import {getActiveCampusZone, resetCampusZoneState} from '../services/campusSpatialService';

describe('foreground campus location', () => {
  beforeEach(() => {
    jest.clearAllMocks(); resetCampusZoneState(); Platform.OS = 'android';
    AppState.currentState = 'active';
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockImplementation(async permissions =>
      Object.fromEntries(permissions.map(p => [p, 'granted'])) as any);
  });
  afterEach(() => jest.restoreAllMocks());
  it('uses a real fix, clears on background, restarts on foreground and unsubscribes', async () => {
    let stateChanged: any;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => { stateChanged = callback; return {remove}; });
    const stop = await startCampusLocation(jest.fn());
    const position = (Geolocation.watchPosition as jest.Mock).mock.calls[0][0];
    position({coords: {latitude: 39.92745, longitude: 32.86465, accuracy: 10}, timestamp: Date.now()});
    expect(getActiveCampusZone()?.id).toBe('tedu-library');
    AppState.currentState = 'background'; stateChanged('background');
    expect(Geolocation.clearWatch).toHaveBeenCalledWith(1);
    expect(getActiveCampusZone()).toBeNull();
    position({coords: {latitude: 39.92745, longitude: 32.86465, accuracy: 10}, timestamp: Date.now()});
    expect(getActiveCampusZone()).toBeNull();
    AppState.currentState = 'active'; stateChanged('active');
    expect(Geolocation.watchPosition).toHaveBeenCalledTimes(2);
    stop(); expect(remove).toHaveBeenCalled();
  });
  it('does not start location when precise permission is denied', async () => {
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({});
    await expect(startCampusLocation(jest.fn())).rejects.toThrow();
    expect(Geolocation.watchPosition).not.toHaveBeenCalled();
  });
  it('ignores inaccurate and stale fixes', async () => {
    const stop = await startCampusLocation(jest.fn());
    const position = (Geolocation.watchPosition as jest.Mock).mock.calls[0][0];
    position({coords: {latitude: 39.92745, longitude: 32.86465, accuracy: 500}, timestamp: Date.now()});
    expect(getActiveCampusZone()).toBeNull();
    position({coords: {latitude: 39.92745, longitude: 32.86465, accuracy: 10}, timestamp: Date.now() - 120000});
    expect(getActiveCampusZone()).toBeNull(); stop();
  });
});
