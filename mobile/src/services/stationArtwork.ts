const normalize = (value: unknown) => String(value ?? '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
  .replace(/\b(feat|featuring|ft)\.?\b.*$/i, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim();

export function mapStationIdToApiId(stationId: string): string {
  if (stationId === 'radiotedu-energize') {
    return 'radiotedu-spark';
  }
  return stationId;
}

/** Enrich only the same song, never a newer broadcast or another station. */
export async function fetchStationArtwork(stationId: string, title: string, artist?: string): Promise<{
  artist: string; artwork: string;
} | null> {
  const apiId = mapStationIdToApiId(stationId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`https://radiotedu.com/wp-json/radiotedu/v1/stations/${encodeURIComponent(apiId)}/live?player=1`, {
      signal: controller.signal, headers: {Accept: 'application/json'},
    });
    if (!response.ok) {return null;}
    const data = await response.json();
    const matchesStation = data.station_id === stationId || data.station_id === apiId;
    if (controller.signal.aborted || !matchesStation ||
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

/** Fetch current live song, artist, and cover art directly from the station endpoint. */
export async function fetchStationLiveMetadata(
  stationId: string,
  signal?: AbortSignal,
): Promise<{ title: string; artist: string; artwork: string } | null> {
  const apiId = mapStationIdToApiId(stationId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(
      `https://radiotedu.com/wp-json/radiotedu/v1/stations/${encodeURIComponent(apiId)}/live?player=1`,
      {
        signal: signal || controller.signal,
        headers: {Accept: 'application/json'},
      },
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (!data || !data.online || !data.track) {
      return null;
    }
    const track = String(data.track || '').trim();
    if (!track) {
      return null;
    }
    const artist = String(data.artist || '').trim();
    const artwork = String(data.artwork_url || '').trim();
    return {
      title: track,
      artist: artist || 'RadioTEDU',
      artwork,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
