import api from './api';

export interface GamificationPoints {
  lifetime_points: number;
  spendable_points: number;
  monthly_points?: number;
  listening_points?: number;
  events_points?: number;
  games_points?: number;
  social_points?: number;
  jukebox_points?: number;
}

export interface MarketItem {
  id: string;
  title: string;
  description?: string | null;
  item_kind?: 'digital' | 'physical' | 'coupon' | 'badge';
  cost_points: number;
  image_url?: string | null;
  stock_quantity?: number | null;
}

export interface AppEvent {
  id: string;
  title: string;
  description?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  location?: string | null;
  image_url?: string | null;
  check_in_points?: number;
  price?: string | null;
  category?: string | null;
  slug?: string | null;
  ticket_url?: string | null;
  registered?: boolean;
  metadata?: Record<string, unknown> | null;
}

const TURKISH_MONTHS: Record<string, string> = {
  ocak: '01', subat: '02', şubat: '02',
  mart: '03', nisan: '04', mayis: '05', mayıs: '05',
  haziran: '06', temmuz: '07', agustos: '08', ağustos: '08',
  eylul: '09', eylül: '09', ekim: '10',
  kasim: '11', kasım: '11', aralik: '12', aralık: '12',
};

export function parseBiletDates(dayStr?: string, monthYearStr?: string, timeRangeStr?: string) {
  const day = String(dayStr || '01').padStart(2, '0');
  const parts = String(monthYearStr || '').trim().split(/\s+/);
  const monthName = (parts[0] || '').toLowerCase();
  const year = parts[1] || String(new Date().getFullYear());
  const month = TURKISH_MONTHS[monthName] || '10';
  const times = String(timeRangeStr || '').split(/[–-]/).map(t => t.trim());
  const startTime = times[0] ? (times[0].length === 5 ? `${times[0]}:00` : times[0]) : '20:00:00';
  const endTime = times[1] ? (times[1].length === 5 ? `${times[1]}:00` : times[1]) : '23:59:00';

  const startsAt = `${year}-${month}-${day}T${startTime}+03:00`;
  const endsAt = `${year}-${month}-${day}T${endTime}+03:00`;
  return { startsAt, endsAt };
}

export function parseBiletHtml(html: string): AppEvent[] {
  const events: AppEvent[] = [];
  const eventRegex = /<a\s+class=["']rtb-event["'][^>]*href=["']([^"']+)["'][\s\S]*?<\/a>/g;
  let match;
  while ((match = eventRegex.exec(html)) !== null) {
    const chunk = match[0];
    let url = match[1];
    if (url && !url.startsWith('http')) {
      url = `https://radiotedu.com/bilet/${url.replace(/^\/+/, '')}`;
    }
    const title = chunk.match(/<h3>([^<]+)<\/h3>/)?.[1]?.trim() || 'TEDU Etkinliği';
    const category = chunk.match(/<span\s+class=["']rtb-event__category["']>([^<]+)<\/span>/)?.[1]?.trim() || 'Etkinlik';
    let image = chunk.match(/<img[^>]+src=["']([^"']+)["']/)?.[1]?.trim() || '';
    if (image && !image.startsWith('http')) {
      image = `https://radiotedu.com/bilet/${image.replace(/^\/+/, '')}`;
    }
    const metaMatch = chunk.match(/<p\s+class=["']rtb-event__meta["']>([\s\S]*?)<\/p>/);
    const metaSpans = metaMatch ? [...metaMatch[1].matchAll(/<span>([^<]+)<\/span>/g)].map(m => m[1].trim()) : [];
    const location = metaSpans[0] || 'TED University';
    const timeRange = metaSpans[1] || '20:00 - 23:59';
    const day = chunk.match(/<strong>([^<]+)<\/strong>/)?.[1]?.trim() || '01';
    const monthYear = chunk.match(/<strong>[^<]+<\/strong>\s*<span>([^<]+)<\/span>/)?.[1]?.trim() || 'Ekim 2026';
    const price = chunk.match(/<span\s+class=["']rtb-event__price["']>([^<]+)<\/span>/)?.[1]?.trim() || '800 ₺';

    const slugMatch = url.match(/slug=([a-zA-Z0-9_-]+)/);
    const slug = slugMatch ? slugMatch[1] : title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const { startsAt, endsAt } = parseBiletDates(day, monthYear, timeRange);

    events.push({
      id: `bilet-${slug}`,
      title,
      description: `${category} • ${price}`,
      starts_at: startsAt,
      ends_at: endsAt,
      location,
      image_url: image,
      check_in_points: 100,
      price,
      category,
      slug,
      ticket_url: url,
      registered: false,
      metadata: {
        ticket_url: url,
        price,
        category,
        slug,
        is_bilet: true,
      },
    });
  }
  return events;
}

export async function fetchBiletEventsDirect(): Promise<AppEvent[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch('https://radiotedu.com/bilet/', {
      signal: controller.signal,
      headers: {Accept: 'text/html'},
    });
    clearTimeout(timer);
    if (!response.ok) return [];
    const html = await response.text();
    return parseBiletHtml(html);
  } catch {
    return [];
  }
}

export async function fetchEvents(): Promise<AppEvent[]> {
  const now = Date.now();
  const isUpcoming = (event: AppEvent) => !event.ends_at || new Date(event.ends_at).getTime() >= now;

  try {
    const response = await api.get('/gamification/events');
    const apiEvents: AppEvent[] = unwrapData<{events?: AppEvent[]}>(response)?.events ?? [];
    if (Array.isArray(apiEvents) && apiEvents.length > 0) {
      return apiEvents.filter(isUpcoming);
    }
  } catch {
    // If backend is unreachable or returns error, proceed to direct fallback
  }

  const directEvents = await fetchBiletEventsDirect();
  return directEvents.filter(isUpcoming);
}

export interface ArcadeGame {
  id: string;
  slug?: string;
  title: string;
  description?: string | null;
  point_rate?: number | string;
  daily_point_limit?: number;
  metadata?: Record<string, unknown>;
}

export interface GamificationHome {
  points: GamificationPoints;
  events: AppEvent[];
  games: ArcadeGame[];
  market: MarketItem[];
}

export interface GameScoreSubmissionPayload {
  score: number;
  client_round_id: string;
  play_duration_ms: number;
  submission_source: 'mobile_game';
  session_id: string;
  nonce: string;
}

export interface VerifiedGameSession {
  session: {
    id: string;
    game_id: string;
    client_round_id: string;
    started_at: string;
  };
  nonce: string;
  minimum_play_seconds: number;
  expires_after_seconds: number;
}

function unwrapData<T>(response: {data?: {data?: T}}): T {
  return response.data?.data as T;
}

export async function fetchGamificationMe() {
  const response = await api.get('/gamification/me');
  return unwrapData(response);
}

export async function fetchGamificationHome(): Promise<GamificationHome> {
  const response = await api.get('/gamification/home');
  return unwrapData<GamificationHome>(response);
}

export async function fetchMyTickets() {
  const response = await api.get('/gamification/events/my-tickets');
  return unwrapData<{tickets?: unknown[]}>(response).tickets ?? [];
}

export async function registerEvent(eventId: string) {
  const response = await api.post(`/gamification/events/${eventId}/register`);
  return unwrapData(response);
}

export async function claimQrReward(code: string) {
  const response = await api.post('/gamification/events/qr/claim', {code});
  return unwrapData(response);
}

export async function fetchGames(): Promise<ArcadeGame[]> {
  const response = await api.get('/gamification/games');
  return unwrapData<{games?: ArcadeGame[]}>(response).games ?? [];
}

export async function startGameSession(gameId: string, clientRoundId: string): Promise<VerifiedGameSession> {
  const response = await api.post(`/gamification/games/${gameId}/start`, {
    client_round_id: clientRoundId,
    submission_source: 'mobile_game',
  });
  return unwrapData<VerifiedGameSession>(response);
}

export async function submitGameScore(gameId: string, payload: GameScoreSubmissionPayload) {
  const response = await api.post(`/gamification/games/${gameId}/score`, payload);
  return unwrapData(response);
}

export async function fetchMarketItems(): Promise<MarketItem[]> {
  const response = await api.get('/gamification/market');
  return unwrapData<{items?: MarketItem[]}>(response).items ?? [];
}

export async function redeemMarketItem(itemId: string, idempotencyKey: string) {
  const response = await api.post(`/gamification/market/${itemId}/redeem`, {
    idempotency_key: idempotencyKey,
  });
  return unwrapData<{spendable_points: number; replayed?: boolean}>(response);
}
