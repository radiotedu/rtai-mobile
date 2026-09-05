const normalize = (value: unknown) => String(value ?? '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
  .replace(/\b(feat|featuring|ft)\.?\b.*$/i, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/** Enrich only the same song, never a newer broadcast or another station. */
export async function fetchStationArtwork(stationId: string, title: string, artist?: string): Promise<{
  artist: string; artwork: string;
} | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`https://radiotedu.com/wp-json/radiotedu/v1/stations/${encodeURIComponent(stationId)}/live?player=1`, {
      signal: controller.signal, headers: {Accept: 'application/json'},
    });
    if (!response.ok) {return null;}
    const data = await response.json();
    if (controller.signal.aborted || data.station_id !== stationId ||
      !normalize(title) || normalize(data.track) !== normalize(title) ||
      (artist && normalize(data.artist) !== normalize(artist))) {return null;}
    const artwork = String(data.artwork_url || '');
    if (!/^https:\/\//i.test(artwork) || !String(data.artist || '').trim()) {return null;}
    return {artist: String(data.artist).trim(), artwork};
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
