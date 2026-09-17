import {
  generateTapToJamUrl,
  parseTapToJamUrl,
  startNearbyJamBroadcast,
  stopNearbyJamBroadcast,
  getActiveBroadcastCode,
  detectNearbyPeerJam,
  subscribeToNearbyBeacons,
} from '../services/tapToJamService';

describe('Tap-to-Jam Service (NFC & Acoustic Nearby Sync)', () => {
  beforeEach(() => {
    stopNearbyJamBroadcast();
  });

  it('generates standard deep link URL from room code', () => {
    const url = generateTapToJamUrl('123456');
    expect(url).toBe('radiotedu://jam?code=123456');
  });

  it('parses room code from various payload formats', () => {
    // 1. Deep link query param
    expect(parseTapToJamUrl('radiotedu://jam?code=654321')).toBe('654321');

    // 2. Deep link path
    expect(parseTapToJamUrl('radiotedu://jam/987654')).toBe('987654');

    // 3. Web URL
    expect(parseTapToJamUrl('https://radiotedu.com/jam?code=112233')).toBe('112233');

    // 4. Raw 6-digit code
    expect(parseTapToJamUrl('554433')).toBe('554433');

    // 5. Invalid inputs
    expect(parseTapToJamUrl('')).toBeNull();
    expect(parseTapToJamUrl('invalid')).toBeNull();
    expect(parseTapToJamUrl('123')).toBeNull();
  });

  it('manages nearby beacon broadcast state and subscriber notification', () => {
    expect(getActiveBroadcastCode()).toBeNull();

    startNearbyJamBroadcast('456789');
    expect(getActiveBroadcastCode()).toBe('456789');

    const received: any[] = [];
    const unsub = subscribeToNearbyBeacons(b => {
      if (b) received.push(b);
    });

    const detected = detectNearbyPeerJam();
    expect(detected).toBeTruthy();
    expect(detected?.roomCode).toBe('456789');
    expect(received.length).toBe(1);
    expect(received[0].roomCode).toBe('456789');

    unsub();
    stopNearbyJamBroadcast();
    expect(getActiveBroadcastCode()).toBeNull();
  });
});
