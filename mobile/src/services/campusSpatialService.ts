import {logSafeError} from '../utils/safeLog';

export type CampusContext = 'library' | 'grass' | 'amphi' | 'sports';
export interface CampusZone {
  id: string; key: CampusContext; name: string; subtitle: string;
  recommendedChannelId: string; recommendedChannelName: string;
  promptTitle: string; promptDescription: string; icon: string; accentColor: string;
}
// Official TEDU map viewport, used only as a broad campus-nearby area, never an
// indoor/micro-zone fix: https://www.tedu.edu.tr/haritada-tedu (2026-09-19).
export const CAMPUS_AREA = {latitude: 39.92370734329771, longitude: 32.859381801554065, radiusMeters: 500};
export const CAMPUS_CONTEXTS: CampusZone[] = [
  {id: 'tedu-library', key: 'library', name: 'Odak', subtitle: '', recommendedChannelId: 'radiotedu-lofi', recommendedChannelName: 'Lo-Fi', promptTitle: 'Kampüs · Odak', promptDescription: 'Seçtiğiniz odak modu için Lo-Fi öneriliyor.', icon: 'book-open-page-variant', accentColor: '#38bdf8'},
  {id: 'tedu-grass', key: 'grass', name: 'Sosyal', subtitle: '', recommendedChannelId: 'radiotedu-main', recommendedChannelName: 'RadioTEDU', promptTitle: 'Kampüs · Sosyal', promptDescription: 'Kampüs yakınındasınız. Ana yayına katılın.', icon: 'tree', accentColor: '#22c55e'},
  {id: 'tedu-amphi', key: 'amphi', name: 'Akademik', subtitle: '', recommendedChannelId: 'radiotedu-classic', recommendedChannelName: 'Classical', promptTitle: 'Kampüs · Akademik', promptDescription: 'Seçtiğiniz akademik mod için Klasik öneriliyor.', icon: 'school', accentColor: '#eab308'},
  {id: 'tedu-sports', key: 'sports', name: 'Spor', subtitle: '', recommendedChannelId: 'radiotedu-energize', recommendedChannelName: 'Energize', promptTitle: 'Kampüs · Spor', promptDescription: 'Seçtiğiniz spor modu için Energize öneriliyor.', icon: 'lightning-bolt', accentColor: '#f97316'},
];
let activeZone: CampusZone | null = null;
let dismissedZoneId: string | null = null;
let selectedContext: CampusContext = 'grass';
let nearby = false;
const subscribers = new Set<(zone: CampusZone | null) => void>();
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * radians / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin((lon2 - lon1) * radians / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function notify(): void {
  subscribers.forEach(callback => { try { callback(activeZone); } catch (error) { logSafeError('campusSpatial.notify', error); } });
}
function refresh(): CampusZone | null {
  const candidate = nearby ? CAMPUS_CONTEXTS.find(mode => mode.key === selectedContext) || null : null;
  const next = candidate?.id === dismissedZoneId ? null : candidate;
  if (next !== activeZone) { activeZone = next; notify(); }
  return activeZone;
}
export function selectCampusContext(context: CampusContext): void {
  selectedContext = context;
  refresh();
}
export function updateUserCoordinates(latitude: number, longitude: number): CampusZone | null {
  nearby = Number.isFinite(latitude) && Number.isFinite(longitude) && calculateHaversineDistance(latitude, longitude, CAMPUS_AREA.latitude, CAMPUS_AREA.longitude) <= CAMPUS_AREA.radiusMeters;
  return refresh();
}
/** Test/demo hook; production detection calls updateUserCoordinates. */
export function simulateCampusZone(context: CampusContext | 'outside' | null): CampusZone | null {
  dismissedZoneId = null;
  nearby = !!context && context !== 'outside';
  if (context && context !== 'outside') selectedContext = context;
  return refresh();
}
export function dismissCurrentCampusZone(): void { dismissedZoneId = activeZone?.id || null; refresh(); }
export function resetCampusZoneState(): void { activeZone = null; dismissedZoneId = null; selectedContext = 'grass'; nearby = false; notify(); }
export function getActiveCampusZone(): CampusZone | null { return activeZone; }
export function subscribeToCampusZone(callback: (zone: CampusZone | null) => void): () => void { subscribers.add(callback); callback(activeZone); return () => { subscribers.delete(callback); }; }
