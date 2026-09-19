import Geolocation from '@react-native-community/geolocation';
import {AppState, PermissionsAndroid, Platform} from 'react-native';
import {updateUserCoordinates} from './campusSpatialService';

/** Opt-in, foreground-only coordinates. Coordinates never leave this service. */
export async function startCampusLocation(onError: () => void): Promise<() => void> {
  Geolocation.setRNConfiguration({skipPermissionRequests: true, authorizationLevel: 'whenInUse', enableBackgroundLocationUpdates: false, locationProvider: 'android'});
  if (Platform.OS === 'android') {
    const p = PermissionsAndroid.PERMISSIONS;
    const result = await PermissionsAndroid.requestMultiple([p.ACCESS_FINE_LOCATION, p.ACCESS_COARSE_LOCATION]);
    if (result[p.ACCESS_FINE_LOCATION] !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Precise location required');
  } else if (Platform.OS === 'ios') {
    await new Promise<void>((resolve, reject) => Geolocation.requestAuthorization(resolve, reject));
  } else { throw new Error('Location unavailable'); }
  let watch: number | undefined;
  let epoch = 0;
  const clear = () => {
    epoch++;
    if (watch !== undefined) Geolocation.clearWatch(watch);
    watch = undefined;
    updateUserCoordinates(NaN, NaN);
  };
  const start = () => {
    if (watch !== undefined) return;
    const request = ++epoch;
    watch = Geolocation.watchPosition(position => {
      if (request !== epoch || AppState.currentState !== 'active') return;
      const {latitude, longitude, accuracy} = position.coords;
      if (!Number.isFinite(accuracy) || accuracy > 50 || Date.now() - position.timestamp > 60000) {
        updateUserCoordinates(NaN, NaN);
        return;
      }
      updateUserCoordinates(latitude, longitude);
    }, () => { if (request === epoch) { clear(); onError(); } }, {enableHighAccuracy: true, distanceFilter: 15, interval: 15000, fastestInterval: 10000, maximumAge: 30000});
  };
  const sub = AppState.addEventListener('change', state => { if (state === 'active') start(); else clear(); });
  if (AppState.currentState === 'active') start();
  return () => { sub.remove(); clear(); };
}
