/**
 * Measures listening minutes per channel/podcast and reports them to analytics
 * (which only emits if the user consented). Pure timing — no content captured.
 */
import {DeviceEventEmitter} from 'react-native';
import TrackPlayer, {Event, State} from 'react-native-track-player';
import {Analytics} from './analyticsService';
import {
  heartbeatVerifiedListening,
  startVerifiedListening,
} from './gamificationService';

export const GOLD_BALANCE_EVENT = 'radiotedu:gold-balance-updated';

let currentId: string | null = null;
let playStartMs: number | null = null;
let started = false;
let verificationGeneration = 0;
let verifiedSession: {id: string; nonce: string; inFlight: boolean} | null = null;
let verifiedTimer: ReturnType<typeof setInterval> | null = null;
let verificationBackoffUntil = 0;

const VERIFIED_CHANNELS = new Set(['mosaic', 'jazz', 'lofi', 'classical', 'classic', 'ai', 'radio']);

function channelIdForTrack(trackId: string | null): string | null {
  if (!trackId) {
    return null;
  }
  const normalized = String(trackId).trim().toLowerCase().replace(/^radiotedu[-_:]/, '');
  return VERIFIED_CHANNELS.has(normalized) ? normalized : null;
}

function stopVerifiedListening() {
  verificationGeneration += 1;
  if (verifiedTimer) {
    clearInterval(verifiedTimer);
  }
  verifiedTimer = null;
  verifiedSession = null;
}

async function sendVerifiedHeartbeat(generation: number) {
  const session = verifiedSession;
  if (!session || session.inFlight || generation !== verificationGeneration) {
    return;
  }
  session.inFlight = true;
  try {
    const result = await heartbeatVerifiedListening(session.id, session.nonce);
    if (generation !== verificationGeneration || !verifiedSession) {
      return;
    }
    verifiedSession.nonce = result.nonce;
    if (result.reward?.applied && result.reward.spendablePoints != null) {
      DeviceEventEmitter.emit(GOLD_BALANCE_EVENT, result.reward.spendablePoints);
    }
  } catch {
    verificationBackoffUntil = Date.now() + 60_000;
    stopVerifiedListening();
  } finally {
    if (verifiedSession) {
      verifiedSession.inFlight = false;
    }
  }
}

async function beginVerifiedListening(trackId: string | null) {
  stopVerifiedListening();
  const channelId = channelIdForTrack(trackId);
  if (!channelId || Date.now() < verificationBackoffUntil) {
    return;
  }
  const generation = verificationGeneration;
  const clientSessionId = `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const result = await startVerifiedListening(channelId, clientSessionId);
    if (generation !== verificationGeneration || playStartMs == null) {
      return;
    }
    verifiedSession = {id: result.session.id, nonce: result.nonce, inFlight: false};
    const intervalMs = Math.max(20, Number(result.heartbeat_after_seconds) || 25) * 1000;
    verifiedTimer = setInterval(() => {
      sendVerifiedHeartbeat(generation).catch(() => undefined);
    }, intervalMs);
  } catch {
    verificationBackoffUntil = Date.now() + 60_000;
  }
}

function flush() {
  if (currentId && playStartMs != null) {
    const seconds = Math.round((Date.now() - playStartMs) / 1000);
    if (seconds >= 5) {
      Analytics.listen(currentId, seconds);
    }
  }
  playStartMs = null;
  stopVerifiedListening();
}

/** Register once at startup. Safe to call multiple times. */
export function startListeningTracker(): void {
  if (started) {
    return;
  }
  started = true;

  TrackPlayer.addEventListener(Event.PlaybackState, async ({state}) => {
    if (state === State.Playing) {
      const track = await TrackPlayer.getActiveTrack();
      currentId = track?.id ?? null;
      playStartMs = Date.now();
      beginVerifiedListening(currentId).catch(() => undefined);
    } else {
      // paused / stopped / buffering ends an active listening interval
      flush();
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async () => {
    flush();
    const track = await TrackPlayer.getActiveTrack();
    currentId = track?.id ?? null;
    const {state} = await TrackPlayer.getPlaybackState();
    playStartMs = state === State.Playing ? Date.now() : null;
    if (playStartMs != null) {
      beginVerifiedListening(currentId).catch(() => undefined);
    }
  });
}
