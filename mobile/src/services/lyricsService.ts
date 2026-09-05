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
  if (wantedArtist && (!resultArtist || !(resultArtist === wantedArtist ||
    resultArtist.includes(wantedArtist) || wantedArtist.includes(resultArtist)))) {
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

export const LRCLIB_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) RadioTEDU/1.3.7 (https://radiotedu.com)',
};

export async function fetchScrollableLyrics({
  track,
  artist = '',
  signal,
}: LyricsRequest): Promise<string[]> {
  const checkAborted = () => {
    if (signal?.aborted) {
      const error = new Error('Lyrics request cancelled');
      error.name = 'AbortError';
      throw error;
    }
  };
  checkAborted();
  const cleanTrack = String(track).trim();
  const cleanArtist = String(artist).trim();
  const baseTrack = cleanTrack.replace(/\s*(?:\[|\().*$/, '').trim();
  const unquotedTrack = cleanTrack.replace(/["“”'‘’]/g, '').trim();
  const strippedTrack = cleanTrack
    .replace(/\s*(?:\[|\().*?(?:remaster|live|mono|stereo|version|mix|edit|deluxe|bonus|anniversary).*?(?:\]|\))/gi, '')
    .trim();

  // Fast direct get for exact artist + track match (try baseTrack then cleanTrack)
  if (cleanArtist) {
    const directVariants = [baseTrack, cleanTrack, strippedTrack].filter(
      (t, idx, arr) => t && arr.indexOf(t) === idx,
    );
    for (const directTrack of directVariants) {
      try {
        const getParams = new URLSearchParams({
          track_name: directTrack,
          artist_name: cleanArtist,
        });
        const getRes = await fetch(`https://lrclib.net/api/get?${getParams.toString()}`, {
          signal,
          headers: LRCLIB_HEADERS,
        });
        if (getRes.ok) {
          const getBody = (await getRes.json()) as LrcLibCandidate;
          checkAborted();
          if (
            matchScore(getBody, cleanTrack, cleanArtist) >= 4 &&
            !getBody.instrumental &&
            (getBody.plainLyrics || getBody.syncedLyrics)
          ) {
            const parsed = parseScrollableLyrics(getBody.plainLyrics || getBody.syncedLyrics);
            if (parsed.length > 0) {
              return parsed;
            }
          }
        }
      } catch {
        checkAborted();
        // Continue to next direct variant or search
      }
    }
  }

  const searches = [
    {track: cleanTrack, artist: cleanArtist},
    {track: baseTrack, artist: cleanArtist},
    {track: strippedTrack, artist: cleanArtist},
    {track: unquotedTrack, artist: cleanArtist},
    {track: baseTrack, artist: ''},
  ];
  const seenSearches = new Set<string>();
  const candidates = new Map<string, LrcLibCandidate>();

  const fetchPromises = searches.map(async search => {
    // Match normalization removes album suffixes; query deduplication must not.
    const searchKey = `${search.artist.toLocaleLowerCase('en-US')}\n${search.track.toLocaleLowerCase('en-US')}`;
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
        headers: LRCLIB_HEADERS,
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
  checkAborted();

  const match = [...candidates.values()]
    .filter(candidate => !candidate.instrumental && (candidate.plainLyrics || candidate.syncedLyrics))
    .map(candidate => ({candidate, score: matchScore(candidate, cleanTrack, cleanArtist)}))
    .filter(entry => entry.score >= 4)
    .sort((left, right) => right.score - left.score)[0]?.candidate;

  const lrclibLyrics = parseScrollableLyrics(match?.plainLyrics || match?.syncedLyrics);
  if (lrclibLyrics.length > 0) {
    return lrclibLyrics;
  }

  // Secondary fallback: lyrics.ovh (free open lyrics API)
  if (cleanArtist && (baseTrack || cleanTrack)) {
    try {
      const ovhArtist = encodeURIComponent(cleanArtist);
      const ovhTrack = encodeURIComponent(baseTrack || cleanTrack);
      const ovhRes = await fetch(`https://api.lyrics.ovh/v1/${ovhArtist}/${ovhTrack}`, {
        signal,
        headers: {Accept: 'application/json'},
      });
      if (ovhRes.ok) {
        const ovhBody = (await ovhRes.json()) as {lyrics?: string};
        checkAborted();
        if (ovhBody.lyrics) {
          const ovhParsed = parseScrollableLyrics(ovhBody.lyrics);
          if (ovhParsed.length > 0) {
            return ovhParsed;
          }
        }
      }
    } catch {
      checkAborted();
    }
  }

  return [];
}
