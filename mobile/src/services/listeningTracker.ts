/**
 * Measures listening minutes per channel/podcast and reports them to analytics
 * (which only emits if the user consented). Pure timing — no content captured.
 */
import TrackPlayer, {Event, State} from 'react-native-track-player';
import {Analytics} from './analyticsService';
import {getAccessToken} from './authTokenStorage';
import {subscribeAuthSessionChanges} from './authSessionEvents';
import {
  createListeningClientSessionId,
  heartbeatVerifiedListening,
  radioChannelForTrack,
  startVerifiedListening,
} from './goldListeningService';

let currentId: string | null = null;
let playStartMs: number | null = null;
let started = false;
let goldGeneration = 0;
let goldBlockedUntilAuthChange = false;
let goldTimer: ReturnType<typeof setTimeout> | null = null;
let goldSession: {
  channelId: string;
  sessionId: string;
  nonce: string;
  heartbeatAfterSeconds: number;
} | null = null;

function errorStatus(error: unknown): number | undefined {
  return (error as {response?: {status?: number}})?.response?.status;
}

function clearGoldTimer() {
  if (goldTimer) clearTimeout(goldTimer);
  goldTimer = null;
}

function resetGoldSession() {
  goldGeneration += 1;
  clearGoldTimer();
  goldSession = null;
}

function clampHeartbeatDelay(seconds: number): number {
  return Math.max(12, Math.min(60, Math.floor(seconds || 25)));
}

function scheduleGoldHeartbeat(seconds: number) {
  clearGoldTimer();
  goldTimer = setTimeout(() => {
    void sendGoldHeartbeat();
  }, clampHeartbeatDelay(seconds) * 1000);
}

function scheduleGoldRestart(seconds = 10) {
  clearGoldTimer();
  goldTimer = setTimeout(() => {
    void syncGoldListening();
  }, seconds * 1000);
}

async function syncGoldListening() {
  const generation = ++goldGeneration;
  clearGoldTimer();
  goldSession = null;
  if (goldBlockedUntilAuthChange) return;

  try {
    const accessToken = await getAccessToken();
    const {state} = await TrackPlayer.getPlaybackState();
    const track = await TrackPlayer.getActiveTrack();
    const channelId = radioChannelForTrack(track);
    if (!accessToken || state !== State.Playing || !channelId) return;

    const result = await startVerifiedListening(
      channelId,
      createListeningClientSessionId(),
    );
    if (generation !== goldGeneration) return;

    goldSession = {
      channelId,
      sessionId: result.session.id,
      nonce: result.nonce,
      heartbeatAfterSeconds: result.heartbeat_after_seconds,
    };
    scheduleGoldHeartbeat(result.heartbeat_after_seconds);
  } catch (error) {
    if (generation !== goldGeneration) return;
    const status = errorStatus(error);
    if (status === 401 || status === 403) {
      goldBlockedUntilAuthChange = true;
      return;
    }
    scheduleGoldRestart();
  }
}

async function sendGoldHeartbeat() {
  const active = goldSession;
  const generation = goldGeneration;
  if (!active) return;

  try {
    const {state} = await TrackPlayer.getPlaybackState();
    const track = await TrackPlayer.getActiveTrack();
    if (
      state !== State.Playing ||
      radioChannelForTrack(track) !== active.channelId
    ) {
      resetGoldSession();
      return;
    }

    const result = await heartbeatVerifiedListening(active.sessionId, active.nonce);
    if (generation !== goldGeneration || goldSession !== active) return;
    active.nonce = result.nonce;
    scheduleGoldHeartbeat(active.heartbeatAfterSeconds);
  } catch (error) {
    if (generation !== goldGeneration || goldSession !== active) return;
    const status = errorStatus(error);
    if (status === 429) {
      scheduleGoldHeartbeat(10);
      return;
    }

    resetGoldSession();
    if (status === 401 || status === 403) {
      goldBlockedUntilAuthChange = true;
      return;
    }
    scheduleGoldRestart();
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
      void syncGoldListening();
    } else {
      // paused / stopped / buffering ends an active listening interval
      flush();
      resetGoldSession();
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async () => {
    flush();
    const track = await TrackPlayer.getActiveTrack();
    currentId = track?.id ?? null;
    const {state} = await TrackPlayer.getPlaybackState();
    playStartMs = state === State.Playing ? Date.now() : null;
    if (state === State.Playing) {
      void syncGoldListening();
    } else {
      resetGoldSession();
    }
  });

  subscribeAuthSessionChanges(() => {
    goldBlockedUntilAuthChange = false;
    void syncGoldListening();
  });

  void syncGoldListening();
}
