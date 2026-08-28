/**
 * Measures listening minutes per channel/podcast and reports them to analytics
 * (which only emits if the user consented). Pure timing — no content captured.
 */
import TrackPlayer, {Event, State} from 'react-native-track-player';
import NetInfo from '@react-native-community/netinfo';
import {Analytics, PlaybackAnalyticsContext} from './analyticsService';
import {getAccessToken} from './authTokenStorage';
import {notifyGoldBalanceChanged} from './goldBalanceEvents';
import {subscribeAuthSessionChanges} from './authSessionEvents';
import {
  createListeningClientSessionId,
  extractServerGoldBalance,
  heartbeatVerifiedListening,
  radioChannelForTrack,
  startVerifiedListening,
} from './goldListeningService';

let currentId: string | null = null;
let playStartMs: number | null = null;
let currentAnalyticsContext: PlaybackAnalyticsContext | null = null;
let bufferingStartedMs: number | null = null;
let bufferingAnalyticsContext: PlaybackAnalyticsContext | null = null;
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
    const serverBalance = extractServerGoldBalance(result.reward);
    if (serverBalance !== null) {
      notifyGoldBalanceChanged(serverBalance);
    }
    const rewardAmount = extractRewardAmount(result.reward);
    if (rewardAmount > 0) Analytics.goldEarned('listening', rewardAmount);
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
  if (currentId && playStartMs != null && currentAnalyticsContext) {
    const seconds = Math.round((Date.now() - playStartMs) / 1000);
    if (seconds >= 5) {
      Analytics.listen(currentAnalyticsContext, seconds);
    }
  }
  playStartMs = null;
  currentAnalyticsContext = null;
}

function extractRewardAmount(reward: unknown): number {
  if (!reward || typeof reward !== 'object') return 0;
  const payload = reward as {points_awarded?: unknown; pointsAwarded?: unknown; amount?: unknown};
  const amount = Number(payload.points_awarded ?? payload.pointsAwarded ?? payload.amount ?? 0);
  return Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
}

async function beginAnalyticsInterval(track: any): Promise<void> {
  const id = String(track?.id ?? 'unknown');
  const url = String(track?.url ?? '').toLowerCase();
  const rawQuality = String(
    track?.streamQuality ??
    (url.includes('flac') ? 'hifi' : url.includes('-low') ? 'low' : 'normal'),
  ).toLowerCase();
  const quality = rawQuality === 'flac' ? 'hifi' : rawQuality;
  const network = await NetInfo.fetch().catch(() => null);
  const context: PlaybackAnalyticsContext = {
    content_id: id,
    content_type: id.startsWith('podcast:') ? 'podcast' : 'radio',
    station: String(track?.title ?? id).slice(0, 100),
    quality,
    surface: 'mobile',
    network_type: String(network?.type ?? 'unknown'),
  };
  if (currentId !== id || playStartMs == null) return;
  currentAnalyticsContext = context;
  Analytics.playbackStart(context);
}

/** Register once at startup. Safe to call multiple times. */
export function startListeningTracker(): void {
  if (started) {
    return;
  }
  started = true;

  TrackPlayer.addEventListener(Event.PlaybackState, async ({state}) => {
    if (state === State.Playing) {
      if (bufferingStartedMs != null) {
        Analytics.buffering(bufferingAnalyticsContext, Date.now() - bufferingStartedMs);
        bufferingStartedMs = null;
        bufferingAnalyticsContext = null;
      }
      const track = await TrackPlayer.getActiveTrack();
      currentId = track?.id ?? null;
      if (playStartMs == null) {
        playStartMs = Date.now();
        void beginAnalyticsInterval(track);
      }
      void syncGoldListening();
    } else {
      if (state === State.Buffering || state === State.Loading) {
        bufferingStartedMs ??= Date.now();
        bufferingAnalyticsContext ??= currentAnalyticsContext;
      } else {
        bufferingStartedMs = null;
        bufferingAnalyticsContext = null;
      }
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
      void beginAnalyticsInterval(track);
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
