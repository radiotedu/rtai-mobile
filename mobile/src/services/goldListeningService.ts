import api from './api';

export type VerifiedListeningStart = {
  session: {
    id: string;
    channel_id: string;
    started_at: string;
  };
  nonce: string;
  heartbeat_after_seconds: number;
};

export type VerifiedListeningHeartbeat = {
  session_id: string;
  nonce: string;
  session_eligible_seconds: number;
  total_eligible_seconds: number;
  seconds_until_reward: number;
  reward: unknown;
};

const TRACK_CHANNELS: Record<string, string> = {
  'radiotedu-main': 'radio',
  'radiotedu-classic': 'classic',
  'radiotedu-jazz': 'jazz',
  'radiotedu-lofi': 'lofi',
  'radiotedu-energize': 'energize',
  'radiotedu-rock': 'rock',
  'radiotedu-spark': 'spark',
  'radiotedu-en': 'en',
  'radiotedu-fr': 'fr',
};

const STREAM_MOUNT_CHANNELS: Record<string, string> = {
  radio: 'radio',
  classic: 'classic',
  cazz: 'jazz',
  jazz: 'jazz',
  lofi: 'lofi',
  energize: 'energize',
  rock: 'rock',
  spark: 'spark',
  en: 'en',
  fr: 'fr',
};

function unwrapData<T>(response: {data?: {data?: T}}): T {
  if (!response.data?.data) {
    throw new Error('Gold listening response is missing');
  }
  return response.data.data;
}

export function radioChannelForTrack(track: {id?: unknown; url?: unknown} | undefined): string | null {
  const id = String(track?.id ?? '').toLowerCase();
  const expectedChannel = TRACK_CHANNELS[id] ?? null;
  const rawUrl = typeof track?.url === 'string' ? track.url.trim() : '';
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname.toLowerCase() !== 'stream.radiotedu.com' ||
    parsed.port ||
    parsed.username ||
    parsed.password
  ) {
    return null;
  }

  const pathParts = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  if (pathParts.length !== 1) {
    return null;
  }
  const mount = pathParts[0].replace(/-(?:low|normal|high|flac)$/, '');
  const channel = STREAM_MOUNT_CHANNELS[mount] ?? null;
  if (!channel || (expectedChannel && expectedChannel !== channel)) {
    return null;
  }
  return channel;
}

export function extractServerGoldBalance(reward: unknown): number | null {
  if (!reward || typeof reward !== 'object') {
    return null;
  }
  const payload = reward as {
    spendablePoints?: unknown;
    spendable_points?: unknown;
    gold_balance?: unknown;
    balance?: unknown;
    points?: {spendable_points?: unknown; spendablePoints?: unknown};
  };
  const balance = Number(
    payload.spendable_points ??
    payload.spendablePoints ??
    payload.gold_balance ??
    payload.balance ??
    payload.points?.spendable_points ??
    payload.points?.spendablePoints,
  );
  return Number.isInteger(balance) && balance >= 0 ? balance : null;
}

export function createListeningClientSessionId(
  now = Date.now(),
  random = Math.random(),
): string {
  const entropy = Math.floor(random * Number.MAX_SAFE_INTEGER).toString(36);
  return `mobile:${now.toString(36)}:${entropy}`;
}

export async function startVerifiedListening(
  channelId: string,
  clientSessionId: string,
): Promise<VerifiedListeningStart> {
  const response = await api.post('/economy/listening/start', {
    channel_id: channelId,
    client_session_id: clientSessionId,
  });
  return unwrapData<VerifiedListeningStart>(response);
}

export async function heartbeatVerifiedListening(
  sessionId: string,
  nonce: string,
): Promise<VerifiedListeningHeartbeat> {
  const response = await api.post('/economy/listening/heartbeat', {
    session_id: sessionId,
    nonce,
    is_playing: true,
  });
  return unwrapData<VerifiedListeningHeartbeat>(response);
}
