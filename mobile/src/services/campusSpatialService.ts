import {logSafeError} from '../utils/safeLog';

export interface CampusZone {
  id: string;
  key: 'library' | 'grass' | 'amphi' | 'sports';
  name: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  recommendedChannelId: string;
  recommendedChannelName: string;
  promptTitle: string;
  promptDescription: string;
  icon: string;
  accentColor: string;
}

export const TEDU_CAMPUS_ZONES: CampusZone[] = [
  {
    id: 'tedu-library',
    key: 'library',
    name: 'TEDÜ Kütüphanesi',
    subtitle: 'Sessiz Çalışma & Derin Odak Bölgesi',
    latitude: 39.92745,
    longitude: 32.86465,
    radiusMeters: 55,
    recommendedChannelId: 'radiotedu-lofi',
    recommendedChannelName: 'RadioTEDU Lo-Fi Focus',
    promptTitle: 'Kütüphane Odak Modu',
    promptDescription: 'Kütüphane bölgesindesiniz. Derin odaklanma için Lo-Fi akışına geçmek ister misiniz?',
    icon: 'book-open-page-variant',
    accentColor: '#38bdf8',
  },
  {
    id: 'tedu-grass',
    key: 'grass',
    name: 'TEDÜ Çim Alan',
    subtitle: 'Kampüs Bahçesi & Sosyal Dinlenme',
    latitude: 39.9272,
    longitude: 32.86415,
    radiusMeters: 65,
    recommendedChannelId: 'radiotedu-main',
    recommendedChannelName: 'RadioTEDU Flagship',
    promptTitle: 'Açık Hava & Çim Alan Modu',
    promptDescription: 'Çim alandasınız! Kampüsün enerjisine ana yayınla katılın.',
    icon: 'tree',
    accentColor: '#22c55e',
  },
  {
    id: 'tedu-amphi',
    key: 'amphi',
    name: 'Fatma-Semih Akbil Amfisi',
    subtitle: 'Akademik Seminer & Konferans Alanı',
    latitude: 39.92695,
    longitude: 32.8648,
    radiusMeters: 50,
    recommendedChannelId: 'radiotedu-classic',
    recommendedChannelName: 'RadioTEDU Klasik',
    promptTitle: 'Akademik Dinginlik Modu',
    promptDescription: 'Amfi bölgesindesiniz. Zihninizi tazelemek için Klasik istasyon öneriliyor.',
    icon: 'school',
    accentColor: '#eab308',
  },
  {
    id: 'tedu-sports',
    key: 'sports',
    name: 'TEDÜ Spor Merkezi',
    subtitle: 'Egzersiz & Yüksek Enerji Alanı',
    latitude: 39.92675,
    longitude: 32.86375,
    radiusMeters: 50,
    recommendedChannelId: 'radiotedu-energize',
    recommendedChannelName: 'RadioTEDU Energize',
    promptTitle: 'Yüksek Enerji Modu',
    promptDescription: 'Spor merkezindesiniz! Egzersiz ritmini yakalamak için Energize hazır.',
    icon: 'lightning-bolt',
    accentColor: '#f97316',
  },
];

let activeZone: CampusZone | null = null;
let dismissedZoneId: string | null = null;
const zoneSubscribers = new Set<(zone: CampusZone | null) => void>();

/**
 * Calculates geographic distance between two coordinates in meters (Haversine formula).
 * Computed 100% locally on the device (Zero GPS tracking / Zero server logging).
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function notifySubscribers(): void {
  zoneSubscribers.forEach(cb => {
    try {
      cb(activeZone);
    } catch (err) {
      logSafeError('campusSpatial.notify', err);
    }
  });
}

/**
 * Updates user coordinates and detects if user has entered a campus micro-zone
 */
export function updateUserCoordinates(latitude: number, longitude: number): CampusZone | null {
  // Overlapping micro-zones choose the nearest centre, not declaration order.
  const nearestZones = [...TEDU_CAMPUS_ZONES].sort((a, b) =>
    calculateHaversineDistance(latitude, longitude, a.latitude, a.longitude) -
    calculateHaversineDistance(latitude, longitude, b.latitude, b.longitude));
  for (const zone of nearestZones) {
    const distance = calculateHaversineDistance(
      latitude,
      longitude,
      zone.latitude,
      zone.longitude,
    );

    if (distance <= zone.radiusMeters) {
      if (dismissedZoneId === zone.id) {
        return null;
      }
      if (activeZone?.id !== zone.id) {
        activeZone = zone;
        notifySubscribers();
      }
      return zone;
    }
  }

  // Outside all zones
  if (activeZone !== null) {
    activeZone = null;
    notifySubscribers();
  }
  return null;
}

/**
 * Simulates entering a campus zone (for testing, demo, or offline simulation)
 */
export function simulateCampusZone(
  zoneKey: 'library' | 'grass' | 'amphi' | 'sports' | 'outside' | null,
): CampusZone | null {
  dismissedZoneId = null;
  if (!zoneKey || zoneKey === 'outside') {
    activeZone = null;
    notifySubscribers();
    return null;
  }

  const found = TEDU_CAMPUS_ZONES.find(z => z.key === zoneKey) || null;
  activeZone = found;
  notifySubscribers();
  return found;
}

/**
 * Dismisses the current zone banner for the active session
 */
export function dismissCurrentCampusZone(): void {
  if (activeZone) {
    dismissedZoneId = activeZone.id;
    activeZone = null;
    notifySubscribers();
  }
}

/**
 * Resets any dismissed zone state (e.g. for testing)
 */
export function resetCampusZoneState(): void {
  activeZone = null;
  dismissedZoneId = null;
  notifySubscribers();
}

/**
 * Returns currently active detected campus zone
 */
export function getActiveCampusZone(): CampusZone | null {
  return activeZone;
}

/**
 * Subscribes to campus spatial zone changes
 */
export function subscribeToCampusZone(callback: (zone: CampusZone | null) => void): () => void {
  zoneSubscribers.add(callback);
  callback(activeZone);
  return () => {
    zoneSubscribers.delete(callback);
  };
}
