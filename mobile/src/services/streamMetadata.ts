export type ParsedStreamMetadata = {
  title: string;
  artist?: string;
  artwork?: string;
};

const cleanText = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .trim()
    .replace(/^StreamTitle=['"]?/i, '')
    .replace(/['"]?;?$/, '')
    .trim();
};

const splitArtistAndTitle = (value: string) => {
  const separator = value.indexOf(' - ');
  if (separator <= 0 || separator >= value.length - 3) {
    return {title: value};
  }
  return {
    artist: value.slice(0, separator).trim(),
    title: value.slice(separator + 3).trim(),
  };
};

export function parseTrackPlayerMetadataEvent(
  event: Record<string, any>,
): ParsedStreamMetadata | null {
  let title = cleanText(event.title);
  let artist = cleanText(event.artist);
  let artwork = cleanText(event.artworkUri || event.artwork);
  const metadataItems = Array.isArray(event.metadata)
    ? event.metadata
    : event.metadata && typeof event.metadata === 'object'
      ? [event.metadata]
      : [];

  for (const item of metadataItems) {
    title ||= cleanText(item?.title);
    artist ||= cleanText(item?.artist);
    artwork ||= cleanText(item?.artworkUri);

    for (const raw of Array.isArray(item?.raw) ? item.raw : []) {
      const key = cleanText(raw?.key || raw?.commonKey).toLowerCase();
      if (!title && (key.includes('streamtitle') || key === 'title')) {
        title = cleanText(raw?.value);
      }
      if (!artist && key === 'artist') {
        artist = cleanText(raw?.value);
      }
    }
  }

  if (!title) {
    return null;
  }
  if (!artist) {
    const split = splitArtistAndTitle(title);
    title = split.title;
    artist = split.artist || '';
  }

  return {
    title,
    ...(artist ? {artist} : {}),
    ...(artwork ? {artwork} : {}),
  };
}
