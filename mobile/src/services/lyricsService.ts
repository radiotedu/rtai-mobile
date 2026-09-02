export interface LyricsRequest {
  track: string;
  artist?: string;
  signal?: AbortSignal;
}

interface LrcLibCandidate {
  id?: number;
  trackName?: string;
  artistName?: string;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const normalize = (value: unknown): string =>
  String(value ?? '')
    .toLocaleLowerCase('en-US')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(feat|featuring|ft)\.?\b.*$/i, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const matchScore = (candidate: LrcLibCandidate, track: string, artist: string): number => {
  const wantedTrack = normalize(track);
  const wantedArtist = normalize(artist);
  const resultTrack = normalize(candidate.trackName);
  const resultArtist = normalize(candidate.artistName);
  if (!wantedTrack || !resultTrack) {
    return -1;
  }

  let score = resultTrack === wantedTrack
    ? 12
    : resultTrack.includes(wantedTrack) || wantedTrack.includes(resultTrack)
      ? 5
      : -8;
  if (wantedArtist) {
    score += resultArtist === wantedArtist
      ? 8
      : resultArtist.includes(wantedArtist) || wantedArtist.includes(resultArtist)
        ? 3
        : -5;
  }
  return score;
};

export const parseScrollableLyrics = (source: unknown): string[] =>
  String(source ?? '')
    .split(/\r?\n/)
    .map(line => line.replace(/\[(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim())
    .filter(Boolean)
    .slice(0, 500);

export async function fetchScrollableLyrics({
  track,
  artist = '',
  signal,
}: LyricsRequest): Promise<string[]> {
  const cleanTrack = String(track).trim();
  const cleanArtist = String(artist).trim();
  // Fast direct get for exact artist + track match
  if (cleanTrack && cleanArtist) {
    try {
      const getParams = new URLSearchParams({
        track_name: cleanTrack,
        artist_name: cleanArtist,
      });
      const getRes = await fetch(`https://lrclib.net/api/get?${getParams.toString()}`, {
        signal,
        headers: {Accept: 'application/json'},
      });
      if (getRes.ok) {
        const getBody = (await getRes.json()) as LrcLibCandidate;
        if (!getBody.instrumental && (getBody.plainLyrics || getBody.syncedLyrics)) {
          const parsed = parseScrollableLyrics(getBody.plainLyrics || getBody.syncedLyrics);
          if (parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch {
      // Fallback to fuzzy search below
    }
  }

  const baseTrack = cleanTrack.replace(/\s*(?:\[|\().*$/, '').trim();
  const searches = [
    {track: cleanTrack, artist: cleanArtist},
    {track: baseTrack, artist: cleanArtist},
    {track: baseTrack, artist: ''},
  ];
  const seenSearches = new Set<string>();
  const candidates = new Map<string, LrcLibCandidate>();

  const fetchPromises = searches.map(async search => {
    const searchKey = `${normalize(search.artist)}\n${normalize(search.track)}`;
    if (!search.track || seenSearches.has(searchKey)) {
      return;
    }
    seenSearches.add(searchKey);

    const params = new URLSearchParams({track_name: search.track});
    if (search.artist) {
      params.set('artist_name', search.artist);
    }
    try {
      const response = await fetch(`https://lrclib.net/api/search?${params.toString()}`, {
        signal,
        headers: {Accept: 'application/json'},
      });
      if (response.ok) {
        const body = await response.json();
        if (Array.isArray(body)) {
          body.forEach((candidate: LrcLibCandidate) => {
            const key = String(candidate.id ?? `${candidate.artistName}\n${candidate.trackName}`);
            candidates.set(key, candidate);
          });
        }
      }
    } catch {
      // Ignore network abort or transient search failure
    }
  });

  await Promise.allSettled(fetchPromises);

  const match = [...candidates.values()]
    .filter(candidate => !candidate.instrumental && (candidate.plainLyrics || candidate.syncedLyrics))
    .map(candidate => ({candidate, score: matchScore(candidate, cleanTrack, cleanArtist)}))
    .filter(entry => entry.score >= 4)
    .sort((left, right) => right.score - left.score)[0]?.candidate;

  return parseScrollableLyrics(match?.plainLyrics || match?.syncedLyrics);
}
