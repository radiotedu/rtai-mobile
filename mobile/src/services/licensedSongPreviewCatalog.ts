export const LICENSED_PREVIEW_LIMIT_MS = 7_000;

export type LicensedSongPreview = Readonly<{
  id: string;
  title: string;
  artist: string;
  artwork?: string;
  url: string;
}>;

type ItunesResult = Readonly<{
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
}>;

type FetchLike = (
  input: string,
  init?: {signal?: AbortSignal},
) => Promise<{ok: boolean; json(): Promise<unknown>}>;

const normalize = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export async function resolveLicensedSongPreview(
  input: Readonly<{title: string; artist: string}>,
  fetcher: FetchLike = fetch,
): Promise<LicensedSongPreview | null> {
  const query = encodeURIComponent(`${input.title} ${input.artist}`);
  const response = await fetcher(
    `https://itunes.apple.com/search?term=${query}&entity=song&limit=10&country=tr`,
  );
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {results?: ItunesResult[]};
  const title = normalize(input.title);
  const artist = normalize(input.artist);
  const candidates = Array.isArray(payload.results)
    ? payload.results.filter(item => typeof item.previewUrl === 'string')
    : [];
  const selected = candidates
    .map(item => ({
      item,
      score:
        (normalize(item.trackName ?? '') === title ? 4 : 0) +
        (normalize(item.artistName ?? '') === artist ? 3 : 0) +
        (normalize(item.trackName ?? '').includes(title) ? 1 : 0),
    }))
    .sort((left, right) => right.score - left.score)[0];
  if (!selected || selected.score < 4 || !selected.item.previewUrl) {
    return null;
  }

  return {
    id: `apple-preview:${selected.item.trackId ?? `${title}:${artist}`}`,
    title: selected.item.trackName ?? input.title,
    artist: selected.item.artistName ?? input.artist,
    artwork: selected.item.artworkUrl100?.replace('100x100bb', '600x600bb'),
    url: selected.item.previewUrl,
  };
}
