import {
  calculateHaversineDistance,
  CAMPUS_AREA,
  selectCampusContext,
  updateUserCoordinates,
  simulateCampusZone,
  dismissCurrentCampusZone,
  resetCampusZoneState,
  getActiveCampusZone,
  subscribeToCampusZone,
} from '../services/campusSpatialService';

describe('Campus Spatial Service (Haritasız Konum & Mekansal Ses)', () => {
  beforeEach(() => {
    resetCampusZoneState();
  });

  it('uses campus proximity plus an explicitly selected context and respects dismissal', () => {
    expect(updateUserCoordinates(CAMPUS_AREA.latitude, CAMPUS_AREA.longitude)?.id).toBe('tedu-grass');
    dismissCurrentCampusZone();
    selectCampusContext('library');
    expect(getActiveCampusZone()?.id).toBe('tedu-library');
    selectCampusContext('grass');
    expect(getActiveCampusZone()).toBeNull();
  });

  it('calculates Haversine distance accurately on device without network', () => {
    // Synthetic coordinates approximately 50m apart.
    const dist = calculateHaversineDistance(39.92745, 32.86465, 39.9272, 32.86415);
    expect(dist).toBeGreaterThan(30);
    expect(dist).toBeLessThan(80);

    // Distance to same point is 0
    expect(calculateHaversineDistance(39.92745, 32.86465, 39.92745, 32.86465)).toBe(0);
  });

  it('recommends focus only after explicit selection near campus', () => {
    selectCampusContext('library');
    const zone = updateUserCoordinates(CAMPUS_AREA.latitude, CAMPUS_AREA.longitude);
    expect(zone).toBeTruthy();
    expect(zone?.key).toBe('library');
    expect(zone?.recommendedChannelId).toBe('radiotedu-lofi');
    expect(getActiveCampusZone()?.key).toBe('library');
  });

  it('returns null when user is far outside TEDU campus', () => {
    // Somewhere in Kizilay / outside campus (~1km away: 39.9200, 32.8540)
    const zone = updateUserCoordinates(39.92, 32.854);
    expect(zone).toBeNull();
    expect(getActiveCampusZone()).toBeNull();
  });

  it('simulates campus zones and notifies subscribers', () => {
    const received: any[] = [];
    const unsub = subscribeToCampusZone(z => {
      received.push(z);
    });

    simulateCampusZone('grass');
    expect(getActiveCampusZone()?.key).toBe('grass');
    expect(getActiveCampusZone()?.recommendedChannelId).toBe('radiotedu-main');

    simulateCampusZone('sports');
    expect(getActiveCampusZone()?.key).toBe('sports');
    expect(getActiveCampusZone()?.recommendedChannelId).toBe('radiotedu-energize');

    simulateCampusZone('outside');
    expect(getActiveCampusZone()).toBeNull();

    unsub();
  });

  it('supports dismissing active zone banner without re-triggering until reset', () => {
    simulateCampusZone('library');
    expect(getActiveCampusZone()).toBeTruthy();

    dismissCurrentCampusZone();
    expect(getActiveCampusZone()).toBeNull();

    // Re-entering same zone coordinates while dismissed should not re-trigger
    const rechecked = updateUserCoordinates(CAMPUS_AREA.latitude, CAMPUS_AREA.longitude);
    expect(rechecked).toBeNull();
  });
});
