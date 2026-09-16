/**
 * iOS 18 Live Activity, Dynamic Island & App Intents Bridge for RadioTEDU.
 *
 * Provides typed interfaces, state management, and safe fallback stubs for:
 * 1. iOS 18 ActivityKit Live Activities & Dynamic Island (Compact Leading/Trailing, Minimal, Expanded)
 * 2. Real-time Station Wave Visualizer, Now Playing Song Title, and RadioTEDU Gold badge
 * 3. Interactive playback App Intents (Play/Pause, Next/Prev Station, Favorite)
 * 4. App Intents metadata specification for Siri Shortcuts ("Hey Siri, play RadioTEDU Jazz")
 *    and iOS 18 Control Center widgets.
 *
 * All bridge invocations are completely safe on Android, non-iOS platforms, and iOS environments
 * without the native ActivityKit module linked.
 */

import {NativeModules, Platform} from 'react-native';
import type {StreamQuality} from '../data/radioChannels';

// -----------------------------------------------------------------------------
// 1. Data Models: ActivityKit Attributes & Dynamic ContentState
// -----------------------------------------------------------------------------

/**
 * Normalized 5-band audio wave visualizer for Dynamic Island and Live Activity.
 * Values range between 0.0 (silent) and 1.0 (peak amplitude).
 */
export interface LiveActivityWaveVisualizer {
  amplitudes: [number, number, number, number, number];
  isActive: boolean;
  mode: 'bars' | 'wave' | 'pulse';
}

/**
 * Static attributes identifying the Live Activity session.
 * In ActivityKit, these are fixed when the activity is requested.
 */
export interface LiveActivityAttributes {
  /** Unique session or activity identifier */
  activityId: string;
  /** Canonical station identifier (e.g. 'radiotedu-jazz') */
  stationId: string;
  /** Display station name (e.g. 'RadioTEDU Jazz') */
  stationName: string;
  /** Station hex brand color for dynamic tinting (e.g. '#9C27B0') */
  stationColor: string;
  /** Icecast mount path (e.g. '/cazz') */
  streamMount: string;
  /** Timestamp when the listening session started */
  startedAt: number;
}

/**
 * Dynamic content state updated in real-time on Lock Screen and Dynamic Island.
 */
export interface LiveActivityContentState {
  /** Track title or station name for station-only channels (e.g. 'Take Five') */
  title: string;
  /** Artist name or RadioTEDU tagline */
  artist: string;
  /** Playback status */
  isPlaying: boolean;
  /** True for live stream broadcast */
  isLive: boolean;
  /** Audio quality tier */
  quality: StreamQuality;
  /** User's authoritative RadioTEDU Gold balance */
  goldBalance: number;
  /** Whether the Gold listening reward heartbeat is active */
  goldListeningActive: boolean;
  /** Real-time wave visualizer data */
  waveVisualizer: LiveActivityWaveVisualizer;
  /** Remote or packaged station/album artwork URI */
  artworkUri?: string;
  /** True if synchronized or plain lyrics are available for the current track */
  hasLyrics?: boolean;
  /** Timestamp of the last state update */
  updatedAt: number;
}

/**
 * Dismissal policy when ending a Live Activity.
 */
export type LiveActivityDismissalPolicy = 'default' | 'immediate' | 'afterDate';

// -----------------------------------------------------------------------------
// 2. Dynamic Island UI Layout Specifications (iOS 18)
// -----------------------------------------------------------------------------

export interface DynamicIslandCompactLeadingSpec {
  /** Station monogram or animated waveform mini-pill */
  type: 'station_icon' | 'mini_wave';
  tintColor: string;
}

export interface DynamicIslandCompactTrailingSpec {
  /** Gold badge counter or live status dot */
  type: 'gold_badge' | 'live_indicator' | 'play_state';
  value?: string | number;
}

export interface DynamicIslandMinimalSpec {
  /** Minimal circle shown when multiple activities are running */
  type: 'station_waveform';
  tintColor: string;
}

export interface DynamicIslandExpandedSpec {
  leading: {
    artworkUri?: string;
    stationName: string;
    isLiveBadge: boolean;
  };
  trailing: {
    qualityBadge: string;
    goldBalanceBadge: number;
  };
  center: {
    title: string;
    artist: string;
    waveVisualizer: LiveActivityWaveVisualizer;
  };
  bottom: {
    hasControls: boolean;
    canFavorite: boolean;
    playPauseIntentId: string;
    skipStationIntentId: string;
  };
}

export interface DynamicIslandLayoutSpecification {
  compactLeading: DynamicIslandCompactLeadingSpec;
  compactTrailing: DynamicIslandCompactTrailingSpec;
  minimal: DynamicIslandMinimalSpec;
  expanded: DynamicIslandExpandedSpec;
}

// -----------------------------------------------------------------------------
// 3. iOS 18 App Intents Metadata Specification
// -----------------------------------------------------------------------------

export interface AppIntentParameterSpec {
  name: string;
  type: 'string' | 'enum' | 'boolean';
  description: string;
  options?: string[];
  defaultValue?: string;
}

export interface AppIntentMetadataSpec {
  id: string;
  title: string;
  description: string;
  category: 'playback' | 'navigation' | 'gamification' | 'control_center';
  phrases: {
    en: string[];
    tr: string[];
  };
  parameters?: AppIntentParameterSpec[];
  openAppWhenRun: boolean;
  isEligibleForWidgets: boolean;
  isEligibleForSiriShortcuts: boolean;
  systemImageName: string;
}

export interface ControlCenterWidgetSpec {
  kind: string;
  displayName: string;
  description: string;
  intentId: string;
  controlType: 'button' | 'toggle' | 'menu';
  tintColor: string;
}

export interface IOS18AppIntentsSpecification {
  version: string;
  appIntents: AppIntentMetadataSpec[];
  controlCenterWidgets: ControlCenterWidgetSpec[];
  siriPhrasesCount: number;
}

/**
 * Authoritative iOS 18 App Intents & Control Center metadata specification.
 * Corresponds to Swift structs implementing `AppIntent` & `ControlWidget`.
 */
export const IOS18_APP_INTENTS_SPEC: IOS18AppIntentsSpecification = {
  version: '18.0.0',
  appIntents: [
    {
      id: 'PlayRadioTEDUIntent',
      title: 'Play RadioTEDU Station',
      description: 'Plays a selected live RadioTEDU broadcast station.',
      category: 'playback',
      phrases: {
        en: [
          'Play RadioTEDU',
          'Play RadioTEDU Main',
          'Play RadioTEDU Jazz',
          'Play RadioTEDU Classical',
          'Play RadioTEDU Lo-Fi',
          'Play RadioTEDU Energize',
          'Play RadioTEDU Rock',
          'Listen to RadioTEDU',
        ],
        tr: [
          'RadioTEDU aç',
          'RadioTEDU çal',
          'RadioTEDU Jazz çal',
          'RadioTEDU Klasik dinle',
          'RadioTEDU Lo-Fi aç',
          'RadioTEDU Energize çal',
          'RadioTEDU Rock çal',
          'RadioTEDU dinle',
        ],
      },
      parameters: [
        {
          name: 'station',
          type: 'enum',
          description: 'The RadioTEDU live station to play',
          options: [
            'radiotedu-main',
            'radiotedu-classic',
            'radiotedu-jazz',
            'radiotedu-lofi',
            'radiotedu-energize',
            'radiotedu-rock',
          ],
          defaultValue: 'radiotedu-main',
        },
      ],
      openAppWhenRun: false,
      isEligibleForWidgets: true,
      isEligibleForSiriShortcuts: true,
      systemImageName: 'radio',
    },
    {
      id: 'TogglePlaybackIntent',
      title: 'Toggle RadioTEDU Playback',
      description: 'Pauses or resumes the current RadioTEDU stream.',
      category: 'playback',
      phrases: {
        en: ['Pause RadioTEDU', 'Resume RadioTEDU', 'Toggle RadioTEDU'],
        tr: ['RadioTEDU durdur', 'RadioTEDU devam et', 'RadioTEDU duraklat'],
      },
      openAppWhenRun: false,
      isEligibleForWidgets: true,
      isEligibleForSiriShortcuts: true,
      systemImageName: 'playpause.fill',
    },
    {
      id: 'SkipStationIntent',
      title: 'Next RadioTEDU Station',
      description: 'Cycles to the next canonical RadioTEDU live station.',
      category: 'playback',
      phrases: {
        en: ['Next station on RadioTEDU', 'Change RadioTEDU station'],
        tr: ['Sonraki RadioTEDU istasyonu', 'RadioTEDU istasyon değiştir'],
      },
      openAppWhenRun: false,
      isEligibleForWidgets: true,
      isEligibleForSiriShortcuts: true,
      systemImageName: 'forward.fill',
    },
    {
      id: 'ToggleFavoriteIntent',
      title: 'Favorite Current Track',
      description: 'Adds or removes the currently playing RadioTEDU track from favorites.',
      category: 'playback',
      phrases: {
        en: ['Favorite this song on RadioTEDU', 'Like this song on RadioTEDU'],
        tr: ['RadioTEDU şarkısını beğen', 'RadioTEDU favorilere ekle'],
      },
      openAppWhenRun: false,
      isEligibleForWidgets: false,
      isEligibleForSiriShortcuts: true,
      systemImageName: 'heart.fill',
    },
    {
      id: 'CheckGoldBalanceIntent',
      title: 'Check RadioTEDU Gold',
      description: 'Checks your current verified RadioTEDU Gold listening reward balance.',
      category: 'gamification',
      phrases: {
        en: ['Check my RadioTEDU Gold', 'How much RadioTEDU Gold do I have?'],
        tr: ['RadioTEDU altınımı göster', 'Kaç RadioTEDU altınım var?'],
      },
      openAppWhenRun: false,
      isEligibleForWidgets: true,
      isEligibleForSiriShortcuts: true,
      systemImageName: 'circle.hexagongrid.fill',
    },
  ],
  controlCenterWidgets: [
    {
      kind: 'com.radiotedu.control.playpause',
      displayName: 'RadioTEDU Play/Pause',
      description: 'Instantly play or pause RadioTEDU live broadcast from Control Center.',
      intentId: 'TogglePlaybackIntent',
      controlType: 'toggle',
      tintColor: '#E31E24',
    },
    {
      kind: 'com.radiotedu.control.stationpicker',
      displayName: 'RadioTEDU Stations',
      description: 'Quick-select between the 6 canonical RadioTEDU live channels.',
      intentId: 'PlayRadioTEDUIntent',
      controlType: 'menu',
      tintColor: '#E5A000',
    },
    {
      kind: 'com.radiotedu.control.goldtracker',
      displayName: 'RadioTEDU Gold',
      description: 'Displays active Gold earning heartbeat and total balance.',
      intentId: 'CheckGoldBalanceIntent',
      controlType: 'button',
      tintColor: '#FFD700',
    },
  ],
  siriPhrasesCount: 16,
};

// -----------------------------------------------------------------------------
// 4. Native Bridge Interface & Safe Fallback Stubs
// -----------------------------------------------------------------------------

export interface NativeLiveActivityBridgeInterface {
  isLiveActivitySupported(): Promise<boolean>;
  areActivitiesEnabled(): Promise<boolean>;
  startLiveActivity(
    attributes: LiveActivityAttributes,
    initialState: LiveActivityContentState,
  ): Promise<string | null>;
  updateLiveActivity(
    activityId: string,
    state: LiveActivityContentState,
  ): Promise<boolean>;
  endLiveActivity(
    activityId: string,
    finalState?: LiveActivityContentState,
    dismissalPolicy?: LiveActivityDismissalPolicy,
  ): Promise<boolean>;
  getActiveActivityId(): Promise<string | null>;
}

/**
 * Access the underlying iOS native bridge module safely.
 */
function getNativeBridge(): NativeLiveActivityBridgeInterface | null {
  if (Platform.OS !== 'ios') {
    return null;
  }
  const module = NativeModules.RadioTeduLiveActivityBridge;
  if (!module) {
    return null;
  }
  return module as NativeLiveActivityBridgeInterface;
}

// In-memory tracker for active activity ID to manage lifecycle seamlessly
let currentActiveActivityId: string | null = null;

/**
 * Reset internal state (useful for tests and session cleanup).
 */
export function _resetActiveActivityState(): void {
  currentActiveActivityId = null;
}

/**
 * Checks if iOS 18 Live Activities & Dynamic Island are supported on the current device.
 * Safely resolves to `false` on Android, web, or unsupported iOS versions.
 */
export async function isLiveActivitySupported(): Promise<boolean> {
  const bridge = getNativeBridge();
  if (!bridge) {
    return false;
  }
  try {
    return await bridge.isLiveActivitySupported();
  } catch {
    return false;
  }
}

/**
 * Checks if Live Activities are currently enabled by user permissions in iOS Settings.
 * Safely resolves to `false` if not permitted or unlinked.
 */
export async function areActivitiesEnabled(): Promise<boolean> {
  const bridge = getNativeBridge();
  if (!bridge) {
    return false;
  }
  try {
    return await bridge.areActivitiesEnabled();
  } catch {
    return false;
  }
}

/**
 * Starts a new Live Activity for the active RadioTEDU station broadcast.
 * Displays on the Lock Screen, StandBy mode, and Dynamic Island (iPhone 14 Pro+).
 *
 * @param attributes Static station attributes
 * @param initialState Initial playback & visualizer state
 * @returns The unique Activity ID or null on fallback
 */
export async function startLiveActivity(
  attributes: LiveActivityAttributes,
  initialState: LiveActivityContentState,
): Promise<string | null> {
  const bridge = getNativeBridge();
  if (!bridge) {
    currentActiveActivityId = attributes.activityId || 'fallback-simulated-activity';
    return null;
  }
  try {
    const activityId = await bridge.startLiveActivity(attributes, initialState);
    if (activityId) {
      currentActiveActivityId = activityId;
    }
    return activityId;
  } catch {
    return null;
  }
}

/**
 * Updates the dynamic ContentState of an existing Live Activity (waveform, song, Gold).
 *
 * @param activityId Activity identifier
 * @param state Updated dynamic content state
 * @returns True if successfully updated
 */
export async function updateLiveActivity(
  activityId: string,
  state: LiveActivityContentState,
): Promise<boolean> {
  const bridge = getNativeBridge();
  if (!bridge) {
    return false;
  }
  try {
    return await bridge.updateLiveActivity(activityId, state);
  } catch {
    return false;
  }
}

/**
 * Ends a running Live Activity with the chosen dismissal policy.
 *
 * @param activityId Activity identifier
 * @param finalState Optional terminal content state
 * @param dismissalPolicy Dismissal timing ('default' | 'immediate' | 'afterDate')
 * @returns True if successfully ended
 */
export async function endLiveActivity(
  activityId: string,
  finalState?: LiveActivityContentState,
  dismissalPolicy: LiveActivityDismissalPolicy = 'immediate',
): Promise<boolean> {
  const bridge = getNativeBridge();
  if (currentActiveActivityId === activityId) {
    currentActiveActivityId = null;
  }
  if (!bridge) {
    return false;
  }
  try {
    return await bridge.endLiveActivity(activityId, finalState, dismissalPolicy);
  } catch {
    return false;
  }
}

/**
 * Retrieves the currently active ActivityKit Activity ID, if one exists.
 */
export async function getActiveActivityId(): Promise<string | null> {
  const bridge = getNativeBridge();
  if (!bridge) {
    return currentActiveActivityId;
  }
  try {
    const id = await bridge.getActiveActivityId();
    if (id) {
      currentActiveActivityId = id;
    }
    return id ?? currentActiveActivityId;
  } catch {
    return currentActiveActivityId;
  }
}

/**
 * Generates synthetic or smoothed 5-band wave visualizer amplitudes for Dynamic Island.
 * Returns zeros when paused/stopped, and realistic dynamic levels when playing.
 *
 * @param isPlaying Whether audio is currently playing
 * @param seed Optional pseudo-random seed or tick counter for animation frame
 */
export function generateWaveVisualizerLevels(
  isPlaying: boolean,
  seed: number = Date.now(),
): LiveActivityWaveVisualizer {
  if (!isPlaying) {
    return {
      amplitudes: [0.05, 0.05, 0.05, 0.05, 0.05],
      isActive: false,
      mode: 'bars',
    };
  }

  // Smooth pseudo-random sine wave variations between 0.2 and 0.95
  const t = seed / 300;
  const a0 = Math.min(1.0, Math.max(0.15, Math.abs(Math.sin(t * 1.1)) * 0.8 + 0.2));
  const a1 = Math.min(1.0, Math.max(0.2, Math.abs(Math.sin(t * 1.4 + 1)) * 0.75 + 0.25));
  const a2 = Math.min(1.0, Math.max(0.25, Math.abs(Math.sin(t * 0.9 + 2)) * 0.9 + 0.1));
  const a3 = Math.min(1.0, Math.max(0.2, Math.abs(Math.sin(t * 1.7 + 3)) * 0.8 + 0.2));
  const a4 = Math.min(1.0, Math.max(0.15, Math.abs(Math.sin(t * 1.3 + 4)) * 0.7 + 0.2));

  return {
    amplitudes: [
      parseFloat(a0.toFixed(2)),
      parseFloat(a1.toFixed(2)),
      parseFloat(a2.toFixed(2)),
      parseFloat(a3.toFixed(2)),
      parseFloat(a4.toFixed(2)),
    ],
    isActive: true,
    mode: 'bars',
  };
}

/**
 * Builds the Dynamic Island layout specification for a given station and state.
 */
export function buildDynamicIslandLayout(
  attributes: LiveActivityAttributes,
  state: LiveActivityContentState,
): DynamicIslandLayoutSpecification {
  return {
    compactLeading: {
      type: state.isPlaying ? 'mini_wave' : 'station_icon',
      tintColor: attributes.stationColor,
    },
    compactTrailing: {
      type: state.goldListeningActive ? 'gold_badge' : 'play_state',
      value: state.goldListeningActive ? `${state.goldBalance}🪙` : undefined,
    },
    minimal: {
      type: 'station_waveform',
      tintColor: attributes.stationColor,
    },
    expanded: {
      leading: {
        artworkUri: state.artworkUri,
        stationName: attributes.stationName,
        isLiveBadge: state.isLive,
      },
      trailing: {
        qualityBadge: state.quality.toUpperCase(),
        goldBalanceBadge: state.goldBalance,
      },
      center: {
        title: state.title,
        artist: state.artist,
        waveVisualizer: state.waveVisualizer,
      },
      bottom: {
        hasControls: true,
        canFavorite: true,
        playPauseIntentId: 'TogglePlaybackIntent',
        skipStationIntentId: 'SkipStationIntent',
      },
    },
  };
}

/**
 * High-level synchronization helper.
 * Automatically initiates, updates, or dismisses the Live Activity based on
 * current playback status and station metadata.
 */
export async function syncLiveActivityFromPlayback(params: {
  stationId: string;
  stationName: string;
  stationColor: string;
  streamMount: string;
  title: string;
  artist: string;
  isPlaying: boolean;
  isLive: boolean;
  quality: StreamQuality;
  goldBalance: number;
  goldListeningActive: boolean;
  artworkUri?: string;
  hasLyrics?: boolean;
}): Promise<boolean> {
  const supported = await isLiveActivitySupported();
  if (!supported) {
    return false;
  }

  const wave = generateWaveVisualizerLevels(params.isPlaying);
  const contentState: LiveActivityContentState = {
    title: params.title,
    artist: params.artist,
    isPlaying: params.isPlaying,
    isLive: params.isLive,
    quality: params.quality,
    goldBalance: params.goldBalance,
    goldListeningActive: params.goldListeningActive,
    waveVisualizer: wave,
    artworkUri: params.artworkUri,
    hasLyrics: params.hasLyrics,
    updatedAt: Date.now(),
  };

  const activeId = await getActiveActivityId();

  if (params.isPlaying) {
    if (activeId) {
      return await updateLiveActivity(activeId, contentState);
    } else {
      const attributes: LiveActivityAttributes = {
        activityId: `radiotedu-${params.stationId}-${Date.now()}`,
        stationId: params.stationId,
        stationName: params.stationName,
        stationColor: params.stationColor,
        streamMount: params.streamMount,
        startedAt: Date.now(),
      };
      const newId = await startLiveActivity(attributes, contentState);
      return Boolean(newId);
    }
  } else {
    if (activeId) {
      return await endLiveActivity(activeId, contentState, 'default');
    }
    return true;
  }
}

/**
 * Returns the complete iOS 18 App Intents and Control Center widget specification.
 */
export function getAppIntentsSpecification(): IOS18AppIntentsSpecification {
  return IOS18_APP_INTENTS_SPEC;
}
