/** Consent-gated Google Analytics for Firebase bridge (Android and iOS). */
import {NativeModules, Platform} from 'react-native';
import {CONSENT_VERSION} from '../privacy/consentVersion';
import {getCurrentLanguage} from '../i18n';

type AnalyticsBridge = {
  setCollectionEnabled(enabled: boolean, consentVersion: number): void;
  setDemographics(ageRange: string | null, gender: string | null): void;
  setListeningContext(context: string | null): void;
  logEvent(name: string, params: Record<string, string | number | boolean>): void;
};

const bridge = NativeModules?.RadioTeduAnalyticsBridge as
  | AnalyticsBridge
  | undefined;
let analyticsAllowed = false;
let preferredListeningContext: string | null = null;

export function setAnalyticsConsent(
  allowed: boolean,
  demo?: {ageRange?: string | null; gender?: string | null; listeningContext?: string | null},
): void {
  analyticsAllowed =
    allowed &&
    (Platform.OS === 'android' || Platform.OS === 'ios') &&
    Boolean(bridge);
  bridge?.setCollectionEnabled(analyticsAllowed, CONSENT_VERSION);
  bridge?.setDemographics(
    analyticsAllowed ? demo?.ageRange ?? null : null,
    analyticsAllowed ? demo?.gender ?? null : null,
  );
  preferredListeningContext = analyticsAllowed ? demo?.listeningContext ?? null : null;
  bridge?.setListeningContext(preferredListeningContext);
}

function send(
  name: string,
  params: Record<string, string | number | boolean> = {},
): void {
  if (!analyticsAllowed) {
    return;
  }
  try {
    bridge?.logEvent(name, {
      ...params,
      app_language: getCurrentLanguage(),
      ...(preferredListeningContext ? {listening_context: preferredListeningContext} : {}),
    });
  } catch {
    // Analytics is best-effort and must never affect playback.
  }
}

export const Analytics = {
  appOpen: () => send('radiotedu_app_open', {platform: Platform.OS}),
  sessionStart: () => send('radiotedu_session_start', {platform: Platform.OS}),
  playbackStart: (context: PlaybackAnalyticsContext) =>
    send('playback_start', context),
  listen: (context: PlaybackAnalyticsContext, seconds: number) =>
    send('listen_complete', {
      ...context,
      minutes: Math.round(seconds / 60),
      seconds,
    }),
  goldEarned: (source: 'listening' | 'game', amount: number) =>
    send('gold_earned', {source, amount: Math.max(0, Math.floor(amount))}),
  screenView: (screen: string) =>
    send('radiotedu_screen_view', {screen_name: screen}),
  interaction: (feature: string, action: string, result = 'success') =>
    send('feature_interaction', {feature, action, result}),
  authState: (state: 'signed_out' | 'guest' | 'registered') =>
    send('auth_state', {auth_state: state}),
  notificationPermission: (status: 'granted' | 'denied' | 'unavailable') =>
    send('notification_permission', {permission_status: status}),
  qualityChanged: (from: string, to: string, result: 'success' | 'error') =>
    send('quality_change', {previous_quality: from, quality: to, result}),
  playbackError: (errorCode: string, recovered: boolean, surface = 'mobile') =>
    send('playback_error', {
      error_code: errorCode.slice(0, 80),
      fallback_used: recovered ? 'yes' : 'no',
      surface,
    }),
  buffering: (context: PlaybackAnalyticsContext | null, durationMs: number) =>
    send('playback_buffering', {
      ...(context ?? {}),
      duration_ms: Math.max(0, Math.round(durationMs)),
    }),
  gameStarted: (gameId: string, practice: boolean) =>
    send('game_start', {game_id: gameId, mode: practice ? 'practice' : 'verified'}),
  gameCompleted: (gameId: string, score: number, durationMs: number, result: string) =>
    send('game_complete', {
      game_id: gameId,
      score: Math.max(0, Math.floor(score)),
      duration_ms: Math.max(0, Math.round(durationMs)),
      result,
    }),
  webView: (feature: 'social' | 'jukebox' | 'voting', action: string, result: string) =>
    send('webview_event', {feature, action, result}),
};

export type PlaybackAnalyticsContext = {
  content_id: string;
  content_type: 'radio' | 'podcast';
  station: string;
  quality: string;
  surface: 'mobile' | 'android_auto' | 'carplay';
  network_type: string;
};
