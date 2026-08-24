import {XMLParser} from 'fast-xml-parser';

import api from './api';

export interface Podcast {
  id: string;
  title: string;
  date: string;
  description: string;
  audioUrl?: string;
  externalUrl?: string;
  imageUrl?: string;
  feedTitle?: string;
}

interface PodcastApiRecord {
  id: string | number;
  title?: string;
  description?: string;
  excerpt?: string;
  audio_url?: string;
  external_url?: string;
  image_url?: string;
  published_at?: string;
  feed_title?: string;
}

interface PodcastApiResponse {
  items?: PodcastApiRecord[];
  total?: number;
  total_pages?: number;
}

interface OfficialPodcastShow {
  id: string;
  title?: string;
  description?: string;
  url?: string;
  image?: string;
}

interface OfficialPodcastEpisode {
  id: string;
  title?: string;
  excerpt?: string;
  url?: string;
  image?: string;
  audio_url?: string;
  external_url?: string;
  published_at?: string;
}

interface OfficialEpisodePage {
  items?: OfficialPodcastEpisode[];
  page?: number;
  pages?: number;
}

type ParsedRssItem = Record<string, unknown>;

interface ParsedRssChannel extends Record<string, unknown> {
  title?: unknown;
  image?: unknown;
  item?: ParsedRssItem | ParsedRssItem[];
}

interface ParsedRssDocument {
  rss?: {
    channel?: ParsedRssChannel;
  };
  channel?: ParsedRssChannel;
}

const PODCAST_DATE_LOCALE = 'tr-TR';
const PODCAST_DESCRIPTION_LIMIT = 180;
const PODCAST_PAGE_SIZE = 15;
const OFFICIAL_PODCAST_API =
  'https://radiotedu.com/wp-json/radiotedu/v1/podcasts';
const RSS_XML_PARSER = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  textNodeName: '#text',
  trimValues: true,
});

// The real RadioTEDU podcast shows, hosted on Spotify for Podcasters (anchor.fm)
// and surfaced on radiotedu.com. Their RSS feeds carry direct MP3 enclosures, so
// episodes play in-app (the anchor URL redirects to the CloudFront audio, which
// react-native-track-player / ExoPlayer follows).
const RADIOTEDU_PODCAST_FEEDS = [
  'https://anchor.fm/s/1115478bc/podcast/rss', // Keşke Biri Bana Söyleseydi!
  'https://anchor.fm/s/fb73f70c/podcast/rss', // hemen bi'şey söyle
  'https://anchor.fm/s/101050774/podcast/rss', // Zıt Kutuplar
];

// Cached, date-sorted merge of all RadioTEDU episodes (refreshed on page 1).
let cachedFeedEpisodes: Podcast[] | null = null;

export async function fetchPodcasts(page: number = 1): Promise<{
  items: Podcast[];
  total: number;
  totalPages: number;
}> {
  // Primary source: RadioTEDU's complete public catalog (all series), not the
  // three legacy feeds previously hardcoded in the client.
  if (page <= 1 || !cachedFeedEpisodes) {
    const episodes = await fetchOfficialPodcastEpisodes();
    if (episodes.length > 0) {
      cachedFeedEpisodes = episodes;
    }
  }

  if (cachedFeedEpisodes && cachedFeedEpisodes.length > 0) {
    return paginatePodcasts(cachedFeedEpisodes, page);
  }

  // Fallback: backend-managed registry, then the three historical RSS feeds.
  try {
    const backend = await fetchPodcastsFromBackend(page);
    if (backend.items.length > 0) {
      return backend;
    }
  } catch {
    // Continue to RSS fallback.
  }

  const rssEpisodes = await fetchRadioteduFeedEpisodes();
  return paginatePodcasts(rssEpisodes, page);
}

export async function fetchAllPodcasts(): Promise<Podcast[]> {
  if (cachedFeedEpisodes) {
    return [...cachedFeedEpisodes];
  }
  const firstPage = await fetchPodcasts(1);
  return cachedFeedEpisodes ? [...cachedFeedEpisodes] : firstPage.items;
}

export function resolvePodcastLaunchUrl(
  podcast: Pick<Podcast, 'audioUrl' | 'externalUrl'> & { url?: string },
): string | null {
  return podcast.audioUrl || podcast.externalUrl || podcast.url || null;
}

function paginatePodcasts(
  all: Podcast[],
  page: number,
): {items: Podcast[]; total: number; totalPages: number} {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * PODCAST_PAGE_SIZE;
  return {
    items: all.slice(start, start + PODCAST_PAGE_SIZE),
    total: all.length,
    totalPages: Math.max(1, Math.ceil(all.length / PODCAST_PAGE_SIZE)),
  };
}

async function fetchRadioteduFeedEpisodes(): Promise<Podcast[]> {
  try {
    const perFeed = await Promise.all(RADIOTEDU_PODCAST_FEEDS.map(fetchFeedEpisodes));
    return perFeed
      .flat()
      .sort((a, b) => b.ts - a.ts)
      .map(entry => entry.podcast);
  } catch {
    return [];
  }
}

async function fetchOfficialPodcastEpisodes(): Promise<Podcast[]> {
  try {
    const response = await fetch(OFFICIAL_PODCAST_API);
    if (!response.ok) {
      return [];
    }
    const shows = (await response.json()) as OfficialPodcastShow[];
    if (!Array.isArray(shows)) {
      return [];
    }
    const perShow = await Promise.all(shows.map(fetchOfficialShowEpisodes));
    return perShow
      .flat()
      .sort((a, b) => b.ts - a.ts)
      .map(entry => entry.podcast);
  } catch {
    return [];
  }
}

async function fetchOfficialShowEpisodes(
  show: OfficialPodcastShow,
): Promise<Array<{podcast: Podcast; ts: number}>> {
  const firstPage = await fetchOfficialEpisodePage(show.id, 1);
  if (!firstPage) {
    return [];
  }
  const pageCount = Math.max(1, Number(firstPage.pages) || 1);
  const remaining = await Promise.all(
    Array.from({length: pageCount - 1}, (_, index) =>
      fetchOfficialEpisodePage(show.id, index + 2),
    ),
  );
  return [firstPage, ...remaining.filter((page): page is OfficialEpisodePage => !!page)]
    .flatMap(page => (Array.isArray(page.items) ? page.items : []))
    .map(item => mapOfficialEpisode(item, show))
    .filter((entry): entry is {podcast: Podcast; ts: number} => entry !== null);
}

async function fetchOfficialEpisodePage(
  showId: string,
  page: number,
): Promise<OfficialEpisodePage | null> {
  try {
    const response = await fetch(
      `${OFFICIAL_PODCAST_API}/${encodeURIComponent(showId)}/episodes?page=${page}`,
    );
    return response.ok ? ((await response.json()) as OfficialEpisodePage) : null;
  } catch {
    return null;
  }
}

function mapOfficialEpisode(
  item: OfficialPodcastEpisode,
  show: OfficialPodcastShow,
): {podcast: Podcast; ts: number} | null {
  if (!item.audio_url) {
    return null;
  }
  const published = item.published_at ?? '';
  const podcast: Podcast = {
    id: item.id,
    title: normalizePodcastTitle(decodeHtmlEntities(item.title ?? '')),
    date: formatPodcastDate(published),
    description: shapePodcastDescription(item.excerpt),
    audioUrl: item.audio_url,
    externalUrl: item.external_url || item.url || show.url,
    imageUrl: item.image || show.image,
    feedTitle: decodeHtmlEntities(show.title ?? 'RadioTEDU Podcasts'),
  };
  return {podcast, ts: Date.parse(published) || 0};
}

async function fetchFeedEpisodes(
  url: string,
): Promise<Array<{podcast: Podcast; ts: number}>> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }
    const xml = await response.text();
    const feed = RSS_XML_PARSER.parse(xml) as ParsedRssDocument;
    const channel = resolveRssChannel(feed);
    if (!channel) {
      return [];
    }
    const showImage = readChannelImage(channel);
    const showTitle = textValue(channel.title);

    return toArray(channel.item)
      .map(item => {
        const published = readItemPublished(item);
        const podcast = mapFeedItem(item, showTitle, showImage, published);
        if (!podcast) {
          return null;
        }
        return {podcast, ts: Date.parse(published) || 0};
      })
      .filter((entry): entry is {podcast: Podcast; ts: number} => entry !== null);
  } catch {
    return [];
  }
}

function mapFeedItem(
  item: ParsedRssItem,
  showTitle: string,
  showImage: string,
  published: string,
): Podcast | null {
  const enclosures = toArray(item.enclosure)
    .map(asRecord)
    .filter((entry): entry is Record<string, unknown> => entry !== null);
  const audioEnclosure =
    enclosures.find(entry => attributeValue(entry, 'type').startsWith('audio')) ||
    enclosures[0];
  const audio = attributeValue(audioEnclosure, 'url');

  if (!audio) {
    return null; // episode without playable audio
  }

  const podcast: Podcast = {
    id: textValue(item.guid) || audio,
    title: normalizePodcastTitle(textValue(item.title)),
    date: formatPodcastDate(published),
    description: shapePodcastDescription(
      textValue(item['itunes:summary']) || textValue(item.description),
    ),
    audioUrl: audio,
  };

  if (showTitle) {
    podcast.feedTitle = showTitle;
  }

  const image = readItemImage(item) || showImage;
  if (image) {
    podcast.imageUrl = image;
  }

  const link = firstUrl(item.link);
  if (link) {
    podcast.externalUrl = link;
  }

  return podcast;
}

function resolveRssChannel(feed: ParsedRssDocument): ParsedRssChannel | null {
  return (asRecord(feed.rss)?.channel as ParsedRssChannel | undefined) ?? feed.channel ?? null;
}

function readChannelImage(channel: ParsedRssChannel): string {
  const image = asRecord(channel.image);
  return (
    textValue(image?.url) ||
    attributeValue(channel['itunes:image'], 'href') ||
    textValue(channel['itunes:image'])
  );
}

function readItemImage(item: ParsedRssItem): string {
  return attributeValue(item['itunes:image'], 'href') || textValue(item['itunes:image']);
}

function readItemPublished(item: ParsedRssItem): string {
  return textValue(item.pubDate) || textValue(item.published) || textValue(item.isoDate);
}

function firstUrl(value: unknown): string {
  for (const entry of toArray(value)) {
    const direct = textValue(entry);
    if (direct) {
      return direct;
    }

    const href = attributeValue(entry, 'href') || attributeValue(entry, 'url');
    if (href) {
      return href;
    }
  }

  return '';
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function attributeValue(value: unknown, name: string): string {
  return textValue(asRecord(value)?.[`@_${name}`]);
}

function textValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  const record = asRecord(value);
  if (record) {
    return textValue(record['#text']);
  }

  return '';
}

async function fetchPodcastsFromBackend(page: number): Promise<{
  items: Podcast[];
  total: number;
  totalPages: number;
}> {
  const response = await api.get('/podcasts', {
    params: {
      page,
      per_page: 10,
    },
  });

  const payload: PodcastApiResponse = response.data?.data ?? {};
  const items = Array.isArray(payload.items) ? payload.items : [];

  return {
    items: items.map(mapPodcastRecord),
    total: payload.total ?? 0,
    totalPages: payload.total_pages ?? 0,
  };
}

function mapPodcastRecord(record: PodcastApiRecord): Podcast {
  const podcast: Podcast = {
    id: String(record.id),
    title: normalizePodcastTitle(record.title),
    date: formatPodcastDate(record.published_at),
    description: shapePodcastDescription(record.excerpt ?? record.description),
  };

  if (record.audio_url) {
    podcast.audioUrl = record.audio_url;
  }

  if (record.external_url) {
    podcast.externalUrl = record.external_url;
  }

  if (record.image_url) {
    podcast.imageUrl = record.image_url;
  }

  if (record.feed_title) {
    podcast.feedTitle = record.feed_title;
  }

  return podcast;
}

function normalizePodcastTitle(title?: string): string {
  const trimmedTitle = title?.trim();
  return trimmedTitle ? trimmedTitle : 'Untitled';
}

function formatPodcastDate(publishedAt?: string): string {
  if (!publishedAt) {
    return '';
  }

  const parsedDate = new Date(publishedAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return parsedDate.toLocaleDateString(PODCAST_DATE_LOCALE);
}

function shapePodcastDescription(source?: string): string {
  if (!source) {
    return '';
  }

  const strippedText = decodeHtmlEntities(
    source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
  );

  if (strippedText.length <= PODCAST_DESCRIPTION_LIMIT) {
    return strippedText;
  }

  return `${strippedText.slice(0, PODCAST_DESCRIPTION_LIMIT).trimEnd()}...`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}
