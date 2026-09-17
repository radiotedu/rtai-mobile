import {NativeModules, Platform} from 'react-native';
import {
  Analytics,
  setAnalyticsConsent,
  isAnalyticsAllowed,
  getPreferredListeningContext,
  PlaybackAnalyticsContext,
} from '../services/analyticsService';
import {CONSENT_VERSION} from '../privacy/consentVersion';
import * as i18nModule from '../i18n';

describe('analyticsService', () => {
  let mockBridge: {
    setCollectionEnabled: jest.Mock;
    setDemographics: jest.Mock;
    setListeningContext: jest.Mock;
    logEvent: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';

    mockBridge = {
      setCollectionEnabled: jest.fn(),
      setDemographics: jest.fn(),
      setListeningContext: jest.fn(),
      logEvent: jest.fn(),
    };

    NativeModules.RadioTeduAnalyticsBridge = mockBridge;
    // Always start each test in a clean, revoked state.
    setAnalyticsConsent(false);
  });

  describe('Strict user consent gate', () => {
    test('is disabled by default and blocks all event dispatches', () => {
      expect(isAnalyticsAllowed()).toBe(false);
      expect(getPreferredListeningContext()).toBeNull();

      Analytics.appOpen();
      Analytics.sessionStart();
      Analytics.screenView('HomeScreen');
      Analytics.wrappedViewed('2026-09');
      Analytics.wrappedShared('2026-09', 'instagram');
      Analytics.transcriptSeek('ep_001', 45);
      Analytics.standByOpened();
      Analytics.dspNormalizationToggled(true);
      Analytics.goldEarned('listening', 10);

      expect(mockBridge.logEvent).not.toHaveBeenCalled();
    });

    test('cannot be enabled on unsupported platform even if allowed is true', () => {
      Platform.OS = 'windows' as any;
      setAnalyticsConsent(true, {listeningContext: 'campus'});

      expect(isAnalyticsAllowed()).toBe(false);
      Analytics.screenView('RadioScreen');
      expect(mockBridge.logEvent).not.toHaveBeenCalled();
    });

    test('cannot be enabled if native bridge is missing', () => {
      delete (NativeModules as any).RadioTeduAnalyticsBridge;
      setAnalyticsConsent(true);

      expect(isAnalyticsAllowed()).toBe(false);
      Analytics.appOpen();
      expect(mockBridge.logEvent).not.toHaveBeenCalled();
    });

    test('revokes consent cleanly and clears demographics and listening context', () => {
      // First enable
      setAnalyticsConsent(true, {
        ageRange: '18-24',
        gender: 'female',
        listeningContext: 'study',
      });
      expect(isAnalyticsAllowed()).toBe(true);
      expect(getPreferredListeningContext()).toBe('study');
      expect(mockBridge.setCollectionEnabled).toHaveBeenCalledWith(true, CONSENT_VERSION);
      expect(mockBridge.setDemographics).toHaveBeenCalledWith('18-24', 'female');
      expect(mockBridge.setListeningContext).toHaveBeenCalledWith('study');

      // Now revoke
      setAnalyticsConsent(false);
      expect(isAnalyticsAllowed()).toBe(false);
      expect(getPreferredListeningContext()).toBeNull();
      expect(mockBridge.setCollectionEnabled).toHaveBeenCalledWith(false, CONSENT_VERSION);
      expect(mockBridge.setDemographics).toHaveBeenCalledWith(null, null);
      expect(mockBridge.setListeningContext).toHaveBeenCalledWith(null);

      // Verify no events are logged after revocation
      Analytics.screenView('ProfileScreen');
      expect(mockBridge.logEvent).not.toHaveBeenCalled();
    });
  });

  describe('Non-blocking, fail-safe execution', () => {
    test('does not throw or crash when bridge.logEvent throws an exception', () => {
      setAnalyticsConsent(true);
      mockBridge.logEvent.mockImplementation(() => {
        throw new Error('Fatal native bridge crash');
      });

      expect(() => {
        Analytics.appOpen();
        Analytics.wrappedViewed('2026-09');
        Analytics.wrappedShared('2026-09', 'whatsapp');
        Analytics.transcriptSeek('ep_042', 120);
        Analytics.standByOpened();
        Analytics.dspNormalizationToggled(false);
        Analytics.playbackError('ERR_DECODE', true);
      }).not.toThrow();
    });

    test('does not throw when bridge.setCollectionEnabled throws an exception', () => {
      mockBridge.setCollectionEnabled.mockImplementation(() => {
        throw new Error('Native setCollectionEnabled failed');
      });

      expect(() => {
        setAnalyticsConsent(true, {listeningContext: 'workout'});
      }).not.toThrow();
    });

    test('falls back gracefully when getCurrentLanguage throws an error', () => {
      setAnalyticsConsent(true);
      jest.spyOn(i18nModule, 'getCurrentLanguage').mockImplementation(() => {
        throw new Error('i18n not initialized');
      });

      expect(() => {
        Analytics.screenView('PodcastsScreen');
      }).not.toThrow();

      expect(mockBridge.logEvent).toHaveBeenCalledWith(
        'radiotedu_screen_view',
        expect.objectContaining({
          screen_name: 'PodcastsScreen',
          app_language: 'tr',
        }),
      );
    });
  });

  describe('Payload formatting and language tagging when enabled', () => {
    beforeEach(() => {
      jest.spyOn(i18nModule, 'getCurrentLanguage').mockReturnValue('en');
      setAnalyticsConsent(true, {
        ageRange: '25-34',
        gender: 'male',
        listeningContext: 'driving',
      });
    });

    test('appOpen and sessionStart log platform and language tags', () => {
      Analytics.appOpen();
      expect(mockBridge.logEvent).toHaveBeenCalledWith('radiotedu_app_open', {
        platform: 'android',
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.sessionStart();
      expect(mockBridge.logEvent).toHaveBeenCalledWith('radiotedu_session_start', {
        platform: 'android',
        app_language: 'en',
        listening_context: 'driving',
      });
    });

    test('respects dynamic language tagging (e.g. Turkish)', () => {
      jest.spyOn(i18nModule, 'getCurrentLanguage').mockReturnValue('tr');
      Analytics.screenView('RadioScreen');
      expect(mockBridge.logEvent).toHaveBeenCalledWith('radiotedu_screen_view', {
        screen_name: 'RadioScreen',
        app_language: 'tr',
        listening_context: 'driving',
      });
    });

    test('wrappedViewed formats period and month_or_year', () => {
      Analytics.wrappedViewed('2026-10');
      expect(mockBridge.logEvent).toHaveBeenCalledWith('wrapped_viewed', {
        period: '2026-10',
        month_or_year: '2026-10',
        app_language: 'en',
        listening_context: 'driving',
      });
    });

    test('wrappedShared formats period, month_or_year, and platform', () => {
      Analytics.wrappedShared('2026-10', 'instagram');
      expect(mockBridge.logEvent).toHaveBeenCalledWith('wrapped_shared', {
        period: '2026-10',
        month_or_year: '2026-10',
        platform: 'instagram',
        app_language: 'en',
        listening_context: 'driving',
      });
    });

    test('transcriptSeek formats episode_id and rounds non-negative timestamp_seconds', () => {
      Analytics.transcriptSeek('ep_999', 84.6);
      expect(mockBridge.logEvent).toHaveBeenCalledWith('transcript_seek', {
        episode_id: 'ep_999',
        timestamp_seconds: 85,
        app_language: 'en',
        listening_context: 'driving',
      });

      // Negative seconds are clamped to 0
      Analytics.transcriptSeek('ep_999', -10);
      expect(mockBridge.logEvent).toHaveBeenCalledWith('transcript_seek', {
        episode_id: 'ep_999',
        timestamp_seconds: 0,
        app_language: 'en',
        listening_context: 'driving',
      });
    });

    test('standByOpened logs standby_opened event with language and context tags', () => {
      Analytics.standByOpened();
      expect(mockBridge.logEvent).toHaveBeenCalledWith('standby_opened', {
        app_language: 'en',
        listening_context: 'driving',
      });
    });

    test('dspNormalizationToggled logs boolean enabled state', () => {
      Analytics.dspNormalizationToggled(true);
      expect(mockBridge.logEvent).toHaveBeenCalledWith('dsp_normalization_toggled', {
        enabled: true,
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.dspNormalizationToggled(false);
      expect(mockBridge.logEvent).toHaveBeenCalledWith('dsp_normalization_toggled', {
        enabled: false,
        app_language: 'en',
        listening_context: 'driving',
      });
    });

    test('playbackStart and listen format context, minutes, and seconds', () => {
      const context: PlaybackAnalyticsContext = {
        content_id: 'rock',
        content_type: 'radio',
        station: 'Rock',
        quality: 'high',
        surface: 'mobile',
        network_type: 'wifi',
      };

      Analytics.playbackStart(context);
      expect(mockBridge.logEvent).toHaveBeenCalledWith('playback_start', {
        ...context,
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.listen(context, 125);
      expect(mockBridge.logEvent).toHaveBeenCalledWith('listen_complete', {
        ...context,
        minutes: 2,
        seconds: 125,
        app_language: 'en',
        listening_context: 'driving',
      });
    });

    test('goldEarned, interaction, authState, qualityChanged, buffering, webView format correctly', () => {
      Analytics.goldEarned('listening', 15.8);
      expect(mockBridge.logEvent).toHaveBeenCalledWith('gold_earned', {
        source: 'listening',
        amount: 15,
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.interaction('juke', 'queue_song', 'success');
      expect(mockBridge.logEvent).toHaveBeenCalledWith('feature_interaction', {
        feature: 'juke',
        action: 'queue_song',
        result: 'success',
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.authState('registered');
      expect(mockBridge.logEvent).toHaveBeenCalledWith('auth_state', {
        auth_state: 'registered',
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.qualityChanged('low', 'high', 'success');
      expect(mockBridge.logEvent).toHaveBeenCalledWith('quality_change', {
        previous_quality: 'low',
        quality: 'high',
        result: 'success',
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.buffering(null, 450.2);
      expect(mockBridge.logEvent).toHaveBeenCalledWith('playback_buffering', {
        duration_ms: 450,
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.webView('jukebox', 'token_bridge', 'success');
      expect(mockBridge.logEvent).toHaveBeenCalledWith('webview_event', {
        feature: 'jukebox',
        action: 'token_bridge',
        result: 'success',
        app_language: 'en',
        listening_context: 'driving',
      });
    });

    test('gameStarted and gameCompleted format mode, score, and duration', () => {
      Analytics.gameStarted('game_snake', false);
      expect(mockBridge.logEvent).toHaveBeenCalledWith('game_start', {
        game_id: 'game_snake',
        mode: 'verified',
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.gameCompleted('game_snake', 120.9, 45000.4, 'won');
      expect(mockBridge.logEvent).toHaveBeenCalledWith('game_complete', {
        game_id: 'game_snake',
        score: 120,
        duration_ms: 45000,
        result: 'won',
        app_language: 'en',
        listening_context: 'driving',
      });
    });

    test('Campus Jam events dispatch with sanitized, truncated parameters and consent context', () => {
      Analytics.jamModalOpened('radiotedu-main');
      expect(mockBridge.logEvent).toHaveBeenCalledWith('jam_modal_opened', {
        channel_id: 'radiotedu-main',
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.jamRoomCreated('radiotedu-classic', 'Classical');
      expect(mockBridge.logEvent).toHaveBeenCalledWith('jam_room_created', {
        channel_id: 'radiotedu-classic',
        channel_name: 'Classical',
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.jamRoomJoined('radiotedu-jazz');
      expect(mockBridge.logEvent).toHaveBeenCalledWith('jam_room_joined', {
        channel_id: 'radiotedu-jazz',
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.jamReactionSent('🔥');
      expect(mockBridge.logEvent).toHaveBeenCalledWith('jam_reaction_sent', {
        emoji: '🔥',
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.jamRoomLeft(true);
      expect(mockBridge.logEvent).toHaveBeenCalledWith('jam_room_left', {
        is_host: 'yes',
        app_language: 'en',
        listening_context: 'driving',
      });

      Analytics.jamRoomLeft(false);
      expect(mockBridge.logEvent).toHaveBeenCalledWith('jam_room_left', {
        is_host: 'no',
        app_language: 'en',
        listening_context: 'driving',
      });
    });
  });
});
