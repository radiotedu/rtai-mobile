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

function unwrapData<T>(response: {data?: {data?: T}}): T {
  if (!response.data?.data) {
    throw new Error('Gold listening response is missing');
  }
  return response.data.data;
}

export function radioChannelForTrack(track: {id?: unknown; url?: unknown} | undefined): string | null {
  const id = String(track?.id ?? '').toLowerCase();
  if (TRACK_CHANNELS[id]) {
    return TRACK_CHANNELS[id];
  }

  const url = String(track?.url ?? '').toLowerCase();
  if (!url.includes('stream.radiotedu.com')) {
    return null;
  }
  if (url.includes('/cazz') || url.includes('/jazz')) {
    return 'jazz';
  }
  if (url.includes('/lofi')) {
    return 'lofi';
  }
  if (url.includes('/classic')) {
    return 'classic';
  }
  if (url.includes('/energize')) {
    return 'energize';
  }
  if (url.includes('/rock')) {
    return 'rock';
  }
  if (url.includes('/spark')) {
    return 'spark';
  }
  if (url.includes('/en')) {
    return 'en';
  }
  if (url.includes('/fr')) {
    return 'fr';
  }
  if (url.includes('/radio')) {
    return 'radio';
  }
  return null;
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
