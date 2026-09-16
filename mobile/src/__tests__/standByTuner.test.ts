import React from 'react';
import renderer, {act, ReactTestRenderer} from 'react-test-renderer';
import {Text} from 'react-native';
import StandByTunerModal, {
  TUNER_STATIONS,
  frequencyToPercent,
} from '../components/StandByTunerModal';
import {RADIO_CHANNELS} from '../data/radioChannels';

// Mocks
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../services/playbackQueue', () => ({
  playChannelById: jest.fn().mockResolvedValue(undefined),
  pausePlaybackByUser: jest.fn().mockResolvedValue(undefined),
  resumePlaybackByUser: jest.fn().mockResolvedValue(undefined),
}));

describe('StandBy & Retro Tuner Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Frequency calculation and station definitions', () => {
    it('defines all 6 canonical RadioTEDU stations on the FM scale', () => {
      expect(TUNER_STATIONS).toHaveLength(6);
      const stationIds = TUNER_STATIONS.map(s => s.id);
      expect(stationIds).toEqual([
        'radiotedu-main',
        'radiotedu-classic',
        'radiotedu-jazz',
        'radiotedu-lofi',
        'radiotedu-energize',
        'radiotedu-rock',
      ]);
    });

    it('assigns unique and ascending FM frequencies between 88.0 and 108.0 MHz', () => {
      for (let i = 0; i < TUNER_STATIONS.length; i++) {
        const station = TUNER_STATIONS[i];
        expect(station.frequency).toBeGreaterThanOrEqual(88.0);
        expect(station.frequency).toBeLessThanOrEqual(108.0);
        expect(station.frequencyDisplay).toContain('FM');
        if (i > 0) {
          expect(station.frequency).toBeGreaterThan(TUNER_STATIONS[i - 1].frequency);
        }
      }
    });

    it('calculates dial percentage accurately with bounds clamping', () => {
      // 88.0 MHz is 0%
      expect(frequencyToPercent(88.0)).toBeCloseTo(0, 1);
      // 108.0 MHz is 100%
      expect(frequencyToPercent(108.0)).toBeCloseTo(100, 1);
      // 98.0 MHz is 50%
      expect(frequencyToPercent(98.0)).toBeCloseTo(50, 1);
      // Out of bounds clamped
      expect(frequencyToPercent(80.0)).toBe(0);
      expect(frequencyToPercent(120.0)).toBe(100);
    });
  });

  describe('StandByTunerModal component rendering and interactions', () => {
    let tree: ReactTestRenderer;

    afterEach(() => {
      if (tree) {
        act(() => {
          tree.unmount();
        });
      }
    });

    it('renders modal with digital clock, station info, needle, and VU meter', () => {
      const mockClose = jest.fn();
      act(() => {
        tree = renderer.create(
          React.createElement(StandByTunerModal, {
            visible: true,
            onClose: mockClose,
            currentChannel: RADIO_CHANNELS[0],
            isPlaying: true,
          }),
        );
      });

      // Verify clock rendered
      const clock = tree.root.findByProps({testID: 'standby-clock'});
      expect(clock).toBeTruthy();

      // Verify active station info
      const stationName = tree.root.findByProps({testID: 'standby-station-name'});
      expect(stationName.props.children).toBe('RadioTEDU');

      const freqText = tree.root.findByProps({testID: 'standby-station-frequency'});
      expect(freqText.props.children).toBe('92.4 FM');

      // Verify analog needle exists
      const needle = tree.root.findByProps({testID: 'standby-needle'});
      expect(needle).toBeTruthy();

      // Verify retro VU / UV spectrum meter
      const vuMeter = tree.root.findByProps({testID: 'standby-vu-meter'});
      expect(vuMeter).toBeTruthy();

      // Verify close button calls onClose
      const closeBtn = tree.root.findByProps({testID: 'standby-close-button'});
      act(() => {
        closeBtn.props.onPress();
      });
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('renders markers for all 6 stations on the analog dial scale', () => {
      act(() => {
        tree = renderer.create(
          React.createElement(StandByTunerModal, {
            visible: true,
            onClose: jest.fn(),
            currentChannel: RADIO_CHANNELS[0],
          }),
        );
      });

      for (const station of TUNER_STATIONS) {
        const marker = tree.root.findByProps({
          testID: `standby-station-marker-${station.id}`,
        });
        expect(marker).toBeTruthy();
      }
    });

    it('allows station selection by tapping a dial marker', () => {
      const mockSelect = jest.fn();
      act(() => {
        tree = renderer.create(
          React.createElement(StandByTunerModal, {
            visible: true,
            onClose: jest.fn(),
            currentChannel: RADIO_CHANNELS[0],
            onSelectChannel: mockSelect,
          }),
        );
      });

      const jazzMarker = tree.root.findByProps({
        testID: 'standby-station-marker-radiotedu-jazz',
      });
      act(() => {
        jazzMarker.props.onPress();
      });

      expect(mockSelect).toHaveBeenCalledWith('radiotedu-jazz');
    });

    it('steps through stations sequentially with TUNE - and TUNE + buttons', () => {
      const mockSelect = jest.fn();
      act(() => {
        tree = renderer.create(
          React.createElement(StandByTunerModal, {
            visible: true,
            onClose: jest.fn(),
            currentChannel: RADIO_CHANNELS[0], // radiotedu-main (index 0)
            onSelectChannel: mockSelect,
          }),
        );
      });

      // TUNE + should step to Classical (index 1)
      const nextBtn = tree.root.findByProps({testID: 'standby-next-button'});
      act(() => {
        nextBtn.props.onPress();
      });
      expect(mockSelect).toHaveBeenCalledWith('radiotedu-classic');

      // TUNE - should wrap to Rock (index 5)
      const prevBtn = tree.root.findByProps({testID: 'standby-prev-button'});
      act(() => {
        prevBtn.props.onPress();
      });
      expect(mockSelect).toHaveBeenCalledWith('radiotedu-rock');
    });

    it('toggles playback via transport play/pause button', () => {
      const mockTogglePlay = jest.fn();
      act(() => {
        tree = renderer.create(
          React.createElement(StandByTunerModal, {
            visible: true,
            onClose: jest.fn(),
            isPlaying: true,
            onTogglePlay: mockTogglePlay,
          }),
        );
      });

      const playPauseBtn = tree.root.findByProps({
        testID: 'standby-play-pause-button',
      });
      act(() => {
        playPauseBtn.props.onPress();
      });
      expect(mockTogglePlay).toHaveBeenCalledTimes(1);
    });

    it('toggles Red Monochrome Night Mode for bedroom/nightstand use', () => {
      act(() => {
        tree = renderer.create(
          React.createElement(StandByTunerModal, {
            visible: true,
            onClose: jest.fn(),
            initialNightMode: false,
          }),
        );
      });

      const toggleBtn = tree.root.findByProps({
        testID: 'standby-night-mode-toggle',
      });

      // Initially Amber Retro mode
      const toggleTextInitial = toggleBtn.findByType(Text);
      expect(toggleTextInitial.props.children).toBe('AMBER RETRO');

      // Toggle ON -> Red Night Mode
      act(() => {
        toggleBtn.props.onPress();
      });

      const toggleTextNight = toggleBtn.findByType(Text);
      expect(toggleTextNight.props.children).toBe('RED NIGHT');

      // Root container background in night mode is pure black #000000
      const modalContainer = tree.root.findByProps({
        testID: 'standby-tuner-modal',
      });
      const flatStyle = [modalContainer.props.style].flat();
      expect(flatStyle.some((s: any) => s && s.backgroundColor === '#000000')).toBe(true);

      // Toggle OFF -> back to Amber Retro mode
      act(() => {
        toggleBtn.props.onPress();
      });
      const toggleTextRestored = toggleBtn.findByType(Text);
      expect(toggleTextRestored.props.children).toBe('AMBER RETRO');
    });

    it('supports Lo-Fi station metadata override presentation', () => {
      const lofiChannel = RADIO_CHANNELS.find(c => c.id === 'radiotedu-lofi');
      act(() => {
        tree = renderer.create(
          React.createElement(StandByTunerModal, {
            visible: true,
            onClose: jest.fn(),
            currentChannel: lofiChannel,
            activeTrack: {id: 'radiotedu-lofi'},
          }),
        );
      });

      const titleNode = tree.root.findByProps({testID: 'standby-track-title'});
      expect(titleNode.props.children).toBe('Lo-Fi Focus & Chill Beats');

      const artistNode = tree.root.findByProps({testID: 'standby-track-artist'});
      expect(artistNode.props.children).toBe('RadioTEDU 24/7');
    });
  });

  describe('PlayerScreen StandBy entry button integration', () => {
    it('verifies PlayerScreen imports StandByTunerModal and includes the [STANDBY] entry button', () => {
      const fs = require('fs');
      const path = require('path');
      const playerScreenPath = path.resolve(__dirname, '../screens/PlayerScreen.tsx');
      const playerContent = fs.readFileSync(playerScreenPath, 'utf8');

      expect(playerContent).toContain("import StandByTunerModal from '../components/StandByTunerModal'");
      expect(playerContent).toContain('testID="standby-tuner-button"');
      expect(playerContent).toContain('accessibilityLabel="STANDBY"');
      expect(playerContent).toContain('<StandByTunerModal');
      expect(playerContent).toContain('standbyTunerVisible');
    });
  });
});
