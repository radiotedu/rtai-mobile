import {
  calculateHaversineDistance,
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

  it('chooses the nearest overlapping zone and clears a previous zone on dismissed re-entry', () => {
    expect(updateUserCoordinates(39.9272, 32.86415)?.id).toBe('tedu-grass');
    dismissCurrentCampusZone();
    expect(updateUserCoordinates(39.92745, 32.86465)?.id).toBe('tedu-library');
    expect(updateUserCoordinates(39.9272, 32.86415)).toBeNull();
    expect(getActiveCampusZone()).toBeNull();
  });

  it('calculates Haversine distance accurately on device without network', () => {
    // Distance between library (39.92745, 32.86465) and grass (39.9272, 32.86415) is roughly 50-60m
    const dist = calculateHaversineDistance(39.92745, 32.86465, 39.9272, 32.86415);
    expect(dist).toBeGreaterThan(30);
    expect(dist).toBeLessThan(80);

    // Distance to same point is 0
    expect(calculateHaversineDistance(39.92745, 32.86465, 39.92745, 32.86465)).toBe(0);
  });

  it('detects library zone when user is at library coordinates', () => {
    // Exactly at library coordinates
    const zone = updateUserCoordinates(39.92745, 32.86465);
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
    const rechecked = updateUserCoordinates(39.92745, 32.86465);
    expect(rechecked).toBeNull();
  });
});
