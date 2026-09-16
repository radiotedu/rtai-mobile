import {Platform, NativeModules} from 'react-native';
import {
  isLiveActivitySupported,
  areActivitiesEnabled,
  startLiveActivity,
  updateLiveActivity,
  endLiveActivity,
  getActiveActivityId,
  generateWaveVisualizerLevels,
  buildDynamicIslandLayout,
  syncLiveActivityFromPlayback,
  getAppIntentsSpecification,
  IOS18_APP_INTENTS_SPEC,
  _resetActiveActivityState,
  type LiveActivityAttributes,
  type LiveActivityContentState,
} from '../services/LiveActivityBridge';

describe('LiveActivityBridge', () => {
  const originalPlatformOS = Platform.OS;

  const mockAttributes: LiveActivityAttributes = {
    activityId: 'test-activity-jazz-01',
    stationId: 'radiotedu-jazz',
    stationName: 'RadioTEDU Jazz',
    stationColor: '#9C27B0',
    streamMount: '/cazz',
    startedAt: 1726500000000,
  };

  const mockState: LiveActivityContentState = {
    title: 'Autumn Leaves',
    artist: 'RadioTEDU Jazz Ensemble',
    isPlaying: true,
    isLive: true,
    quality: 'flac',
    goldBalance: 150,
    goldListeningActive: true,
    waveVisualizer: {
      amplitudes: [0.3, 0.6, 0.9, 0.5, 0.2],
      isActive: true,
      mode: 'bars',
    },
    artworkUri: 'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu-jazz.png',
    hasLyrics: false,
    updatedAt: 1726500001000,
  };

  beforeEach(() => {
    _resetActiveActivityState();
    delete (NativeModules as any).RadioTeduLiveActivityBridge;
    (Platform as any).OS = 'ios';
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatformOS;
    delete (NativeModules as any).RadioTeduLiveActivityBridge;
    _resetActiveActivityState();
  });

  describe('Non-iOS platforms safe fallback (e.g. Android)', () => {
    beforeEach(() => {
      (Platform as any).OS = 'android';
      (NativeModules as any).RadioTeduLiveActivityBridge = {
        isLiveActivitySupported: jest.fn().mockResolvedValue(true),
        startLiveActivity: jest.fn().mockResolvedValue('android-should-not-run'),
      };
    });

    it('returns false for isLiveActivitySupported without calling native module', async () => {
      const result = await isLiveActivitySupported();
      expect(result).toBe(false);
      expect(
        (NativeModules as any).RadioTeduLiveActivityBridge.isLiveActivitySupported,
      ).not.toHaveBeenCalled();
    });

    it('returns false for areActivitiesEnabled', async () => {
      const result = await areActivitiesEnabled();
      expect(result).toBe(false);
    });

    it('returns null for startLiveActivity safely without throwing', async () => {
      const result = await startLiveActivity(mockAttributes, mockState);
      expect(result).toBeNull();
      expect(
        (NativeModules as any).RadioTeduLiveActivityBridge.startLiveActivity,
      ).not.toHaveBeenCalled();
    });

    it('returns false for updateLiveActivity safely without throwing', async () => {
      const result = await updateLiveActivity('some-id', mockState);
      expect(result).toBe(false);
    });

    it('returns false for endLiveActivity safely without throwing', async () => {
      const result = await endLiveActivity('some-id');
      expect(result).toBe(false);
    });

    it('returns null/cached ID for getActiveActivityId without throwing', async () => {
      const result = await getActiveActivityId();
      expect(result).toBeNull();
    });

    it('returns false for syncLiveActivityFromPlayback without throwing', async () => {
      const result = await syncLiveActivityFromPlayback({
        stationId: 'radiotedu-jazz',
        stationName: 'Jazz',
        stationColor: '#9C27B0',
        streamMount: '/cazz',
        title: 'Song',
        artist: 'Artist',
        isPlaying: true,
        isLive: true,
        quality: 'flac',
        goldBalance: 100,
        goldListeningActive: true,
      });
      expect(result).toBe(false);
    });
  });

  describe('iOS platform without native module linked', () => {
    beforeEach(() => {
      (Platform as any).OS = 'ios';
      delete (NativeModules as any).RadioTeduLiveActivityBridge;
    });

    it('returns false for isLiveActivitySupported without throwing', async () => {
      const result = await isLiveActivitySupported();
      expect(result).toBe(false);
    });

    it('returns false for areActivitiesEnabled without throwing', async () => {
      const result = await areActivitiesEnabled();
      expect(result).toBe(false);
    });

    it('returns null for startLiveActivity and tracks fallback ID', async () => {
      const result = await startLiveActivity(mockAttributes, mockState);
      expect(result).toBeNull();
      const activeId = await getActiveActivityId();
      expect(activeId).toBe(mockAttributes.activityId);
    });

    it('returns false for updateLiveActivity without throwing', async () => {
      const result = await updateLiveActivity('test-id', mockState);
      expect(result).toBe(false);
    });

    it('returns false for endLiveActivity and clears cached ID', async () => {
      await startLiveActivity(mockAttributes, mockState);
      const result = await endLiveActivity(mockAttributes.activityId);
      expect(result).toBe(false);
      const activeId = await getActiveActivityId();
      expect(activeId).toBeNull();
    });

    it('returns false for syncLiveActivityFromPlayback without throwing', async () => {
      const result = await syncLiveActivityFromPlayback({
        stationId: 'radiotedu-main',
        stationName: 'RadioTEDU',
        stationColor: '#E31E24',
        streamMount: '/radio',
        title: 'Main Show',
        artist: 'RadioTEDU',
        isPlaying: true,
        isLive: true,
        quality: 'normal',
        goldBalance: 50,
        goldListeningActive: true,
      });
      expect(result).toBe(false);
    });
  });

  describe('iOS platform with native module throwing errors', () => {
    beforeEach(() => {
      (Platform as any).OS = 'ios';
      (NativeModules as any).RadioTeduLiveActivityBridge = {
        isLiveActivitySupported: jest.fn().mockRejectedValue(new Error('ActivityKit crash')),
        areActivitiesEnabled: jest.fn().mockRejectedValue(new Error('Permission lookup failure')),
        startLiveActivity: jest.fn().mockRejectedValue(new Error('Quota exceeded')),
        updateLiveActivity: jest.fn().mockRejectedValue(new Error('Update rejected')),
        endLiveActivity: jest.fn().mockRejectedValue(new Error('Dismissal failed')),
        getActiveActivityId: jest.fn().mockRejectedValue(new Error('Query error')),
      };
    });

    it('catches errors gracefully in isLiveActivitySupported', async () => {
      const result = await isLiveActivitySupported();
      expect(result).toBe(false);
    });

    it('catches errors gracefully in areActivitiesEnabled', async () => {
      const result = await areActivitiesEnabled();
      expect(result).toBe(false);
    });

    it('catches errors gracefully in startLiveActivity', async () => {
      const result = await startLiveActivity(mockAttributes, mockState);
      expect(result).toBeNull();
    });

    it('catches errors gracefully in updateLiveActivity', async () => {
      const result = await updateLiveActivity('activity-1', mockState);
      expect(result).toBe(false);
    });

    it('catches errors gracefully in endLiveActivity', async () => {
      const result = await endLiveActivity('activity-1');
      expect(result).toBe(false);
    });

    it('catches errors gracefully in getActiveActivityId', async () => {
      const result = await getActiveActivityId();
      expect(result).toBeNull();
    });
  });

  describe('iOS platform with active native module', () => {
    let mockNative: {
      isLiveActivitySupported: jest.Mock;
      areActivitiesEnabled: jest.Mock;
      startLiveActivity: jest.Mock;
      updateLiveActivity: jest.Mock;
      endLiveActivity: jest.Mock;
      getActiveActivityId: jest.Mock;
    };

    beforeEach(() => {
      (Platform as any).OS = 'ios';
      mockNative = {
        isLiveActivitySupported: jest.fn().mockResolvedValue(true),
        areActivitiesEnabled: jest.fn().mockResolvedValue(true),
        startLiveActivity: jest.fn().mockResolvedValue('activity-live-12345'),
        updateLiveActivity: jest.fn().mockResolvedValue(true),
        endLiveActivity: jest.fn().mockResolvedValue(true),
        getActiveActivityId: jest.fn().mockResolvedValue('activity-live-12345'),
      };
      (NativeModules as any).RadioTeduLiveActivityBridge = mockNative;
    });

    it('verifies support and enablement', async () => {
      expect(await isLiveActivitySupported()).toBe(true);
      expect(await areActivitiesEnabled()).toBe(true);
      expect(mockNative.isLiveActivitySupported).toHaveBeenCalled();
      expect(mockNative.areActivitiesEnabled).toHaveBeenCalled();
    });

    it('starts Live Activity and tracks active ID', async () => {
      const id = await startLiveActivity(mockAttributes, mockState);
      expect(id).toBe('activity-live-12345');
      expect(mockNative.startLiveActivity).toHaveBeenCalledWith(mockAttributes, mockState);
      expect(await getActiveActivityId()).toBe('activity-live-12345');
    });

    it('updates dynamic state successfully', async () => {
      const updatedState = {...mockState, title: 'Blue in Green', goldBalance: 160};
      const result = await updateLiveActivity('activity-live-12345', updatedState);
      expect(result).toBe(true);
      expect(mockNative.updateLiveActivity).toHaveBeenCalledWith(
        'activity-live-12345',
        updatedState,
      );
    });

    it('ends Live Activity with dismissal policy and clears active ID', async () => {
      const finalState = {...mockState, isPlaying: false};
      const result = await endLiveActivity('activity-live-12345', finalState, 'immediate');
      expect(result).toBe(true);
      expect(mockNative.endLiveActivity).toHaveBeenCalledWith(
        'activity-live-12345',
        finalState,
        'immediate',
      );
      mockNative.getActiveActivityId.mockResolvedValue(null);
      expect(await getActiveActivityId()).toBeNull();
    });

    it('synchronizes playback: starts activity when playing and none active', async () => {
      mockNative.getActiveActivityId.mockResolvedValue(null);
      const result = await syncLiveActivityFromPlayback({
        stationId: 'radiotedu-jazz',
        stationName: 'RadioTEDU Jazz',
        stationColor: '#9C27B0',
        streamMount: '/cazz',
        title: 'So What',
        artist: 'Miles Davis',
        isPlaying: true,
        isLive: true,
        quality: 'flac',
        goldBalance: 200,
        goldListeningActive: true,
      });
      expect(result).toBe(true);
      expect(mockNative.startLiveActivity).toHaveBeenCalled();
    });

    it('synchronizes playback: updates activity when already active', async () => {
      mockNative.getActiveActivityId.mockResolvedValue('activity-existing-999');
      const result = await syncLiveActivityFromPlayback({
        stationId: 'radiotedu-jazz',
        stationName: 'RadioTEDU Jazz',
        stationColor: '#9C27B0',
        streamMount: '/cazz',
        title: 'Freddie Freeloader',
        artist: 'Miles Davis',
        isPlaying: true,
        isLive: true,
        quality: 'flac',
        goldBalance: 205,
        goldListeningActive: true,
      });
      expect(result).toBe(true);
      expect(mockNative.updateLiveActivity).toHaveBeenCalledWith(
        'activity-existing-999',
        expect.objectContaining({
          title: 'Freddie Freeloader',
          goldBalance: 205,
          isPlaying: true,
        }),
      );
    });

    it('synchronizes playback: ends activity when playback stops', async () => {
      mockNative.getActiveActivityId.mockResolvedValue('activity-existing-999');
      const result = await syncLiveActivityFromPlayback({
        stationId: 'radiotedu-jazz',
        stationName: 'RadioTEDU Jazz',
        stationColor: '#9C27B0',
        streamMount: '/cazz',
        title: 'Freddie Freeloader',
        artist: 'Miles Davis',
        isPlaying: false,
        isLive: true,
        quality: 'flac',
        goldBalance: 205,
        goldListeningActive: false,
      });
      expect(result).toBe(true);
      expect(mockNative.endLiveActivity).toHaveBeenCalledWith(
        'activity-existing-999',
        expect.objectContaining({
          isPlaying: false,
        }),
        'default',
      );
    });
  });

  describe('Wave Visualizer generator', () => {
    it('returns muted/low amplitudes when audio is paused or stopped', () => {
      const visualizer = generateWaveVisualizerLevels(false);
      expect(visualizer.isActive).toBe(false);
      expect(visualizer.mode).toBe('bars');
      expect(visualizer.amplitudes).toHaveLength(5);
      visualizer.amplitudes.forEach(amp => {
        expect(amp).toBeLessThanOrEqual(0.1);
      });
    });

    it('returns active, bounded amplitudes when audio is playing', () => {
      const visualizer = generateWaveVisualizerLevels(true, 123456);
      expect(visualizer.isActive).toBe(true);
      expect(visualizer.mode).toBe('bars');
      expect(visualizer.amplitudes).toHaveLength(5);
      visualizer.amplitudes.forEach(amp => {
        expect(amp).toBeGreaterThanOrEqual(0.0);
        expect(amp).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe('Dynamic Island Layout Builder', () => {
    it('generates layout with station branding, waveform, and Gold badge', () => {
      const layout = buildDynamicIslandLayout(mockAttributes, mockState);

      // Compact leading & trailing
      expect(layout.compactLeading.type).toBe('mini_wave');
      expect(layout.compactLeading.tintColor).toBe('#9C27B0');
      expect(layout.compactTrailing.type).toBe('gold_badge');
      expect(layout.compactTrailing.value).toBe('150🪙');

      // Minimal
      expect(layout.minimal.type).toBe('station_waveform');
      expect(layout.minimal.tintColor).toBe('#9C27B0');

      // Expanded
      expect(layout.expanded.leading.stationName).toBe('RadioTEDU Jazz');
      expect(layout.expanded.leading.isLiveBadge).toBe(true);
      expect(layout.expanded.trailing.qualityBadge).toBe('FLAC');
      expect(layout.expanded.trailing.goldBalanceBadge).toBe(150);
      expect(layout.expanded.center.title).toBe('Autumn Leaves');
      expect(layout.expanded.bottom.hasControls).toBe(true);
      expect(layout.expanded.bottom.playPauseIntentId).toBe('TogglePlaybackIntent');
      expect(layout.expanded.bottom.skipStationIntentId).toBe('SkipStationIntent');
    });

    it('handles paused state in Dynamic Island layout', () => {
      const pausedState: LiveActivityContentState = {
        ...mockState,
        isPlaying: false,
        goldListeningActive: false,
      };
      const layout = buildDynamicIslandLayout(mockAttributes, pausedState);

      expect(layout.compactLeading.type).toBe('station_icon');
      expect(layout.compactTrailing.type).toBe('play_state');
      expect(layout.compactTrailing.value).toBeUndefined();
    });
  });

  describe('iOS 18 App Intents & Control Center Widget Metadata Specification', () => {
    it('provides valid App Intents specification', () => {
      const spec = getAppIntentsSpecification();
      expect(spec).toBe(IOS18_APP_INTENTS_SPEC);
      expect(spec.version).toBe('18.0.0');
      expect(spec.appIntents.length).toBeGreaterThanOrEqual(5);
      expect(spec.controlCenterWidgets.length).toBeGreaterThanOrEqual(3);
    });

    it('contains Siri shortcut phrases for stations in English and Turkish', () => {
      const spec = getAppIntentsSpecification();
      const playIntent = spec.appIntents.find(i => i.id === 'PlayRadioTEDUIntent');
      expect(playIntent).toBeDefined();
      expect(playIntent?.phrases.en).toContain('Play RadioTEDU Jazz');
      expect(playIntent?.phrases.en).toContain('Play RadioTEDU Classical');
      expect(playIntent?.phrases.tr).toContain('RadioTEDU Jazz çal');
      expect(playIntent?.phrases.tr).toContain('RadioTEDU Klasik dinle');
    });

    it('defines station enum parameters matching the 6 canonical RadioTEDU stations', () => {
      const spec = getAppIntentsSpecification();
      const playIntent = spec.appIntents.find(i => i.id === 'PlayRadioTEDUIntent');
      const stationParam = playIntent?.parameters?.find(p => p.name === 'station');
      expect(stationParam).toBeDefined();
      expect(stationParam?.options).toEqual([
        'radiotedu-main',
        'radiotedu-classic',
        'radiotedu-jazz',
        'radiotedu-lofi',
        'radiotedu-energize',
        'radiotedu-rock',
      ]);
    });

    it('specifies iOS 18 Control Center widgets', () => {
      const spec = getAppIntentsSpecification();
      const playPauseWidget = spec.controlCenterWidgets.find(
        w => w.kind === 'com.radiotedu.control.playpause',
      );
      expect(playPauseWidget).toBeDefined();
      expect(playPauseWidget?.intentId).toBe('TogglePlaybackIntent');
      expect(playPauseWidget?.controlType).toBe('toggle');

      const stationPickerWidget = spec.controlCenterWidgets.find(
        w => w.kind === 'com.radiotedu.control.stationpicker',
      );
      expect(stationPickerWidget).toBeDefined();
      expect(stationPickerWidget?.intentId).toBe('PlayRadioTEDUIntent');
      expect(stationPickerWidget?.controlType).toBe('menu');

      const goldWidget = spec.controlCenterWidgets.find(
        w => w.kind === 'com.radiotedu.control.goldtracker',
      );
      expect(goldWidget).toBeDefined();
      expect(goldWidget?.controlType).toBe('button');
    });
  });
});
