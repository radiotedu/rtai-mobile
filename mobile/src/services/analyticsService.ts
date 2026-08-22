/** Consent-gated Google Analytics for Firebase bridge (Android only). */
import {NativeModules, Platform} from 'react-native';

type AnalyticsBridge = {
  setCollectionEnabled(enabled: boolean): void;
  setDemographics(ageRange: string | null, gender: string | null): void;
  logEvent(name: string, params: Record<string, string | number | boolean>): void;
};

const bridge = NativeModules.RadioTeduAnalyticsBridge as
  | AnalyticsBridge
  | undefined;
let analyticsAllowed = false;

export function setAnalyticsConsent(
  allowed: boolean,
  demo?: {ageRange?: string | null; gender?: string | null},
): void {
  analyticsAllowed = allowed && Platform.OS === 'android' && Boolean(bridge);
  bridge?.setCollectionEnabled(analyticsAllowed);
  bridge?.setDemographics(
    analyticsAllowed ? demo?.ageRange ?? null : null,
    analyticsAllowed ? demo?.gender ?? null : null,
  );
}

function send(
  name: string,
  params: Record<string, string | number | boolean> = {},
): void {
  if (!analyticsAllowed) return;
  try {
    bridge?.logEvent(name, params);
  } catch {
    // Analytics is best-effort and must never affect playback.
  }
}

export const Analytics = {
  // Firebase records app/session lifecycle automatically after opt-in.
  appOpen: () => undefined,
  sessionStart: () => undefined,
  listen: (contentId: string, seconds: number) =>
    send('listen', {
      content_id: contentId,
      minutes: Math.round(seconds / 60),
      seconds,
    }),
  screenView: (screen: string) =>
    send('radiotedu_screen_view', {screen_name: screen}),
};
