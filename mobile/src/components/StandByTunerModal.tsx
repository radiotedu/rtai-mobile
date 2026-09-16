import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {COLORS, SPACING} from '../theme/theme';
import {RADIO_CHANNELS, RadioChannel} from '../data/radioChannels';
import {pausePlaybackByUser, playChannelById, resumePlaybackByUser} from '../services/playbackQueue';

export interface TunerStation {
  id: string;
  name: string;
  frequency: number; // e.g. 92.4
  frequencyDisplay: string; // e.g. "92.4 FM"
  color: string;
  genre: string;
}

export const TUNER_STATIONS: TunerStation[] = [
  {
    id: 'radiotedu-main',
    name: 'RadioTEDU',
    frequency: 92.4,
    frequencyDisplay: '92.4 FM',
    color: '#E31E24',
    genre: 'Ana Kanal',
  },
  {
    id: 'radiotedu-classic',
    name: 'Classical',
    frequency: 95.0,
    frequencyDisplay: '95.0 FM',
    color: '#E5A000',
    genre: 'Klasik',
  },
  {
    id: 'radiotedu-jazz',
    name: 'Jazz',
    frequency: 98.2,
    frequencyDisplay: '98.2 FM',
    color: '#9C27B0',
    genre: 'Caz',
  },
  {
    id: 'radiotedu-lofi',
    name: 'Lo-Fi',
    frequency: 101.5,
    frequencyDisplay: '101.5 FM',
    color: '#00BCD4',
    genre: 'Lo-Fi Beats',
  },
  {
    id: 'radiotedu-energize',
    name: 'Energize',
    frequency: 104.2,
    frequencyDisplay: '104.2 FM',
    color: '#F36F21',
    genre: 'High Energy',
  },
  {
    id: 'radiotedu-rock',
    name: 'Rock',
    frequency: 107.0,
    frequencyDisplay: '107.0 FM',
    color: '#FF6B2C',
    genre: 'Rock',
  },
];

const FM_MIN_FREQ = 88.0;
const FM_MAX_FREQ = 108.0;
const FM_RANGE = FM_MAX_FREQ - FM_MIN_FREQ;

export function frequencyToPercent(freq: number): number {
  const clamped = Math.max(FM_MIN_FREQ, Math.min(FM_MAX_FREQ, freq));
  return ((clamped - FM_MIN_FREQ) / FM_RANGE) * 100;
}

export interface StandByTunerModalProps {
  visible: boolean;
  onClose: () => void;
  currentChannel?: RadioChannel;
  activeTrack?: any;
  isPlaying?: boolean;
  metadata?: any;
  onSelectChannel?: (channelId: string) => void;
  onTogglePlay?: () => void;
  initialNightMode?: boolean;
}

export const StandByTunerModal: React.FC<StandByTunerModalProps> = ({
  visible,
  onClose,
  currentChannel,
  activeTrack,
  isPlaying = false,
  metadata,
  onSelectChannel,
  onTogglePlay,
  initialNightMode = false,
}) => {
  const {width, height} = useWindowDimensions();
  const isLandscape = width > height;

  const [isNightMode, setIsNightMode] = useState(initialNightMode);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Active channel resolution
  const activeStationId = currentChannel?.id || activeTrack?.id || 'radiotedu-main';
  const activeTunerStation = useMemo(() => {
    return (
      TUNER_STATIONS.find(s => s.id === activeStationId) ||
      TUNER_STATIONS[0]
    );
  }, [activeStationId]);

  // Analog needle animation
  const needleAnim = useRef(
    new Animated.Value(frequencyToPercent(activeTunerStation.frequency)),
  ).current;

  useEffect(() => {
    const targetPercent = frequencyToPercent(activeTunerStation.frequency);
    Animated.spring(needleAnim, {
      toValue: targetPercent,
      friction: 7,
      tension: 45,
      useNativeDriver: false,
    }).start();
  }, [activeTunerStation.frequency, needleAnim]);

  // Real-time clock update
  useEffect(() => {
    if (!visible) {
      return;
    }
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  // VU / UV Spectrum bars animation
  const [vuLevels, setVuLevels] = useState<number[]>([
    4, 6, 8, 7, 9, 8, 6, 5, 7, 6, 4, 3,
  ]);

  useEffect(() => {
    if (!visible || !isPlaying) {
      setVuLevels([1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 1, 1]);
      return;
    }

    const interval = setInterval(() => {
      setVuLevels(prev =>
        prev.map(() => {
          // Dynamic bouncing level between 2 and 10
          return Math.floor(Math.random() * 8) + 3;
        }),
      );
    }, 140);

    return () => clearInterval(interval);
  }, [visible, isPlaying]);

  // Handle station change
  const handleSelectStation = useCallback(
    (stationId: string) => {
      if (onSelectChannel) {
        onSelectChannel(stationId);
      } else {
        playChannelById(stationId).catch(() => {});
      }
    },
    [onSelectChannel],
  );

  // Handle station step (tuning knob prev / next)
  const handleStepStation = useCallback(
    (direction: -1 | 1) => {
      const currentIndex = TUNER_STATIONS.findIndex(s => s.id === activeTunerStation.id);
      const nextIndex =
        (currentIndex + direction + TUNER_STATIONS.length) % TUNER_STATIONS.length;
      handleSelectStation(TUNER_STATIONS[nextIndex].id);
    },
    [activeTunerStation.id, handleSelectStation],
  );

  // Handle play / pause toggle
  const handleTogglePlayback = useCallback(() => {
    if (onTogglePlay) {
      onTogglePlay();
    } else if (isPlaying) {
      pausePlaybackByUser().catch(() => {});
    } else {
      resumePlaybackByUser().catch(() => {});
    }
  }, [isPlaying, onTogglePlay]);

  // Format time (HH:MM:SS)
  const hours = currentTime.getHours().toString().padStart(2, '0');
  const minutes = currentTime.getMinutes().toString().padStart(2, '0');
  const seconds = currentTime.getSeconds().toString().padStart(2, '0');

  // Format date
  const dateString = useMemo(() => {
    try {
      return currentTime.toLocaleDateString('tr-TR', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }).toUpperCase();
    } catch {
      return currentTime.toDateString().toUpperCase();
    }
  }, [currentTime]);

  // Now Playing info
  const nowPlayingTitle =
    activeTunerStation.id === 'radiotedu-lofi'
      ? 'Lo-Fi Focus & Chill Beats'
      : metadata?.title || activeTrack?.title || activeTunerStation.genre;
  const nowPlayingArtist =
    activeTunerStation.id === 'radiotedu-lofi'
      ? 'RadioTEDU 24/7'
      : metadata?.artist || (activeTrack?.artist as string) || 'RadioTEDU Live';

  // Palette definition based on Night Mode
  const theme = useMemo(() => {
    if (isNightMode) {
      return {
        bg: '#000000',
        cardBg: '#0D0000',
        cardBorder: '#330000',
        dialBg: '#110000',
        dialBorder: '#440000',
        textPrimary: '#FF2A2A',
        textSecondary: '#CC1E1E',
        textMuted: '#771111',
        needle: '#FF0000',
        accent: '#FF2222',
        vuLow: '#550000',
        vuMid: '#990000',
        vuHigh: '#FF2222',
        glassHighlight: 'rgba(255, 0, 0, 0.05)',
      };
    }
    return {
      bg: '#0A0C10',
      cardBg: '#13171F',
      cardBorder: 'rgba(255, 255, 255, 0.08)',
      dialBg: '#10141D',
      dialBorder: '#273042',
      textPrimary: '#FFFFFF',
      textSecondary: '#E2E8F0',
      textMuted: '#7E8B9B',
      needle: '#FF3333',
      accent: '#FFB800', // Vintage warm amber
      vuLow: '#22C55E', // Green
      vuMid: '#F59E0B', // Amber
      vuHigh: '#EF4444', // Red peak
      glassHighlight: 'rgba(255, 184, 0, 0.06)',
    };
  }, [isNightMode]);

  // Major frequency ticks
  const majorTicks = [88, 92, 96, 100, 104, 108];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent>
      <StatusBar
        hidden={isLandscape}
        barStyle={isNightMode ? 'light-content' : 'light-content'}
        backgroundColor={theme.bg}
      />
      <View
        testID="standby-tuner-modal"
        style={[styles.container, {backgroundColor: theme.bg}]}>
        <SafeAreaView style={styles.safeArea}>
          {/* Top Bar: Night Mode Toggle, Mode Badge, Close */}
          <View style={styles.topBar}>
            <TouchableOpacity
              testID="standby-night-mode-toggle"
              style={[
                styles.topPillButton,
                {
                  backgroundColor: isNightMode ? '#330000' : 'rgba(255, 255, 255, 0.08)',
                  borderColor: isNightMode ? '#660000' : 'rgba(255, 255, 255, 0.15)',
                },
              ]}
              onPress={() => setIsNightMode(!isNightMode)}
              accessibilityRole="button"
              accessibilityLabel="Night Mode Toggle">
              <Icon
                name={isNightMode ? 'weather-night' : 'white-balance-sunny'}
                size={16}
                color={theme.textPrimary}
              />
              <Text style={[styles.topPillText, {color: theme.textPrimary}]}>
                {isNightMode ? 'RED NIGHT' : 'AMBER RETRO'}
              </Text>
            </TouchableOpacity>

            <View style={styles.topBrandContainer}>
              <View
                style={[
                  styles.pulsingDot,
                  {backgroundColor: isPlaying ? theme.accent : theme.textMuted},
                ]}
              />
              <Text style={[styles.topBrandText, {color: theme.textSecondary}]}>
                RADIOTEDU STANDBY TUNER
              </Text>
            </View>

            <TouchableOpacity
              testID="standby-close-button"
              style={[
                styles.closeButton,
                {backgroundColor: isNightMode ? '#220000' : 'rgba(255, 255, 255, 0.08)'},
              ]}
              hitSlop={{top: 16, bottom: 16, left: 16, right: 16}}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close Standby Mode">
              <Icon name="close" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Main Content Layout (Landscape 2-column or Portrait 1-column) */}
          <View
            style={[
              styles.body,
              isLandscape ? styles.landscapeBody : styles.portraitBody,
            ]}>
            {/* Clock & Station Info Section */}
            <View
              style={[
                styles.clockSection,
                isLandscape ? styles.landscapeClockSection : styles.portraitClockSection,
                {backgroundColor: theme.cardBg, borderColor: theme.cardBorder},
              ]}>
              <Text style={[styles.dateText, {color: theme.textMuted}]}>
                {dateString}
              </Text>

              {/* Big Digital Clock */}
              <View testID="standby-clock" style={styles.clockRow}>
                <Text
                  style={[
                    styles.clockDigits,
                    {color: theme.textPrimary},
                    isNightMode && styles.nightClockDigits,
                  ]}>
                  {hours}:{minutes}
                </Text>
                <Text
                  style={[
                    styles.clockSeconds,
                    {color: isNightMode ? theme.textSecondary : theme.accent},
                  ]}>
                  :{seconds}
                </Text>
              </View>

              {/* Station & Track Info */}
              <View style={styles.stationInfoCard}>
                <View style={styles.stationBadgeRow}>
                  <View
                    style={[
                      styles.stationColorIndicator,
                      {backgroundColor: isNightMode ? theme.accent : activeTunerStation.color},
                    ]}
                  />
                  <Text
                    testID="standby-station-name"
                    style={[styles.stationTitle, {color: theme.textPrimary}]}>
                    {activeTunerStation.name}
                  </Text>
                  <View
                    style={[
                      styles.freqBadge,
                      {borderColor: isNightMode ? theme.cardBorder : theme.dialBorder},
                    ]}>
                    <Text
                      testID="standby-station-frequency"
                      style={[styles.freqBadgeText, {color: theme.accent}]}>
                      {activeTunerStation.frequencyDisplay}
                    </Text>
                  </View>
                </View>

                <Text
                  testID="standby-track-title"
                  style={[styles.trackTitle, {color: theme.textPrimary}]}
                  numberOfLines={1}>
                  {nowPlayingTitle}
                </Text>
                <Text
                  testID="standby-track-artist"
                  style={[styles.trackArtist, {color: theme.textMuted}]}
                  numberOfLines={1}>
                  {nowPlayingArtist}
                </Text>
              </View>

              {/* Audio spec info */}
              <View style={styles.specsRow}>
                <Text style={[styles.specText, {color: theme.textMuted}]}>
                  STEREO FM
                </Text>
                <Text style={[styles.specDot, {color: theme.textMuted}]}>·</Text>
                <Text style={[styles.specText, {color: theme.textMuted}]}>
                  {activeTunerStation.id === 'radiotedu-classic' ||
                  activeTunerStation.id === 'radiotedu-jazz'
                    ? 'HI-RES FLAC'
                    : '192 KBPS HQ'}
                </Text>
                <Text style={[styles.specDot, {color: theme.textMuted}]}>·</Text>
                <Text
                  style={[
                    styles.specLive,
                    {color: isPlaying ? theme.accent : theme.textMuted},
                  ]}>
                  {isPlaying ? '● BROADCASTING' : '○ PAUSED'}
                </Text>
              </View>
            </View>

            {/* Tuner & VU Meter Section */}
            <View
              style={[
                styles.tunerSection,
                isLandscape ? styles.landscapeTunerSection : styles.portraitTunerSection,
              ]}>
              {/* Retro VU / UV Meter */}
              <View
                testID="standby-vu-meter"
                style={[
                  styles.vuContainer,
                  {backgroundColor: theme.cardBg, borderColor: theme.cardBorder},
                ]}>
                <View style={styles.vuHeader}>
                  <Text style={[styles.vuTitle, {color: theme.textMuted}]}>
                    UV / SPECTRUM ANALYZER
                  </Text>
                  <Text style={[styles.vuDbScale, {color: theme.textMuted}]}>
                    -20 -10 -5 0 +3 dB
                  </Text>
                </View>

                {/* Equalizer Bars */}
                <View style={styles.vuBarsRow}>
                  {vuLevels.map((level, idx) => (
                    <View key={idx} style={styles.vuBarTrack}>
                      {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(segment => {
                        const isLit = segment <= level;
                        let segColor = theme.vuLow;
                        if (segment >= 8) {
                          segColor = theme.vuHigh;
                        } else if (segment >= 5) {
                          segColor = theme.vuMid;
                        }
                        return (
                          <View
                            key={segment}
                            style={[
                              styles.vuSegment,
                              {
                                backgroundColor: isLit
                                  ? segColor
                                  : isNightMode
                                  ? '#190000'
                                  : 'rgba(255, 255, 255, 0.04)',
                              },
                            ]}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>

              {/* Large Analog Frequency Scale */}
              <View
                testID="standby-frequency-scale"
                style={[
                  styles.dialScaleCard,
                  {backgroundColor: theme.dialBg, borderColor: theme.dialBorder},
                ]}>
                {/* Backlight reflection overlay */}
                <View
                  style={[
                    styles.dialGlassOverlay,
                    {backgroundColor: theme.glassHighlight},
                  ]}
                />

                {/* FM Band Label & Frequency Indicators */}
                <View style={styles.dialTopHeader}>
                  <Text style={[styles.dialBandText, {color: theme.textMuted}]}>
                    FM TUNING SCALE · MHz
                  </Text>
                  <Text style={[styles.dialFreqLive, {color: theme.accent}]}>
                    {activeTunerStation.frequency.toFixed(1)} MHz
                  </Text>
                </View>

                {/* Scale Ruler & Ticks */}
                <View style={styles.rulerContainer}>
                  {/* Frequency Labels along top of ruler */}
                  <View style={styles.ticksLabelsRow}>
                    {majorTicks.map(tick => {
                      const posPercent = frequencyToPercent(tick);
                      return (
                        <View
                          key={tick}
                          style={[
                            styles.tickLabelWrap,
                            {left: `${posPercent}%`},
                          ]}>
                          <Text
                            style={[
                              styles.tickLabelText,
                              {
                                color:
                                  Math.abs(activeTunerStation.frequency - tick) < 1.5
                                    ? theme.accent
                                    : theme.textMuted,
                              },
                            ]}>
                            {tick}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Horizontal Guide Line */}
                  <View
                    style={[
                      styles.rulerGuideLine,
                      {backgroundColor: isNightMode ? '#440000' : '#2A364F'},
                    ]}
                  />

                  {/* Ticks Bar */}
                  <View style={styles.ticksTrack}>
                    {Array.from({length: 41}).map((_, index) => {
                      const freq = 88.0 + index * 0.5;
                      const isMajor = index % 8 === 0; // Every 4 MHz
                      const isMid = index % 4 === 0; // Every 2 MHz
                      return (
                        <View
                          key={freq}
                          style={[
                            styles.tickBar,
                            {
                              height: isMajor ? 18 : isMid ? 12 : 7,
                              backgroundColor: isMajor
                                ? theme.accent
                                : isNightMode
                                ? '#660000'
                                : 'rgba(255, 255, 255, 0.25)',
                            },
                          ]}
                        />
                      );
                    })}
                  </View>

                  {/* Analog Tuning Needle */}
                  <Animated.View
                    testID="standby-needle"
                    style={[
                      styles.needleWrapper,
                      {
                        left: needleAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}>
                    <View
                      style={[
                        styles.needleHead,
                        {borderBottomColor: theme.needle},
                      ]}
                    />
                    <View
                      style={[
                        styles.needleLine,
                        {backgroundColor: theme.needle},
                      ]}
                    />
                  </Animated.View>
                </View>

                {/* Stations Markers on Dial */}
                <View style={styles.stationsDialRow}>
                  {TUNER_STATIONS.map(station => {
                    const isSelected = station.id === activeTunerStation.id;
                    const percent = frequencyToPercent(station.frequency);
                    return (
                      <TouchableOpacity
                        key={station.id}
                        testID={`standby-station-marker-${station.id}`}
                        style={[
                          styles.stationMarkerButton,
                          {
                            left: `${percent}%`,
                            backgroundColor: isSelected
                              ? isNightMode
                                ? '#440000'
                                : station.color
                              : isNightMode
                              ? '#1A0000'
                              : 'rgba(255, 255, 255, 0.06)',
                            borderColor: isSelected
                              ? theme.textPrimary
                              : isNightMode
                              ? '#330000'
                              : 'rgba(255, 255, 255, 0.12)',
                          },
                        ]}
                        onPress={() => handleSelectStation(station.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Tune to ${station.name} on ${station.frequencyDisplay}`}>
                        <Text
                          style={[
                            styles.stationMarkerText,
                            {
                              color: isSelected
                                ? '#FFFFFF'
                                : isNightMode
                                ? theme.textSecondary
                                : theme.textMuted,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}>
                          {station.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Audio & Tuning Transport Controls */}
              <View style={styles.controlsRow}>
                {/* Tune Down Button */}
                <TouchableOpacity
                  testID="standby-prev-button"
                  style={[
                    styles.controlButton,
                    {
                      backgroundColor: isNightMode
                        ? '#1A0000'
                        : 'rgba(255, 255, 255, 0.06)',
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  onPress={() => handleStepStation(-1)}
                  accessibilityRole="button"
                  accessibilityLabel="Previous Station">
                  <Icon name="skip-previous" size={24} color={theme.textPrimary} />
                  <Text style={[styles.controlButtonLabel, {color: theme.textMuted}]}>
                    TUNE -
                  </Text>
                </TouchableOpacity>

                {/* Play / Pause Toggle */}
                <TouchableOpacity
                  testID="standby-play-pause-button"
                  style={[
                    styles.playPauseButton,
                    {
                      backgroundColor: isNightMode ? '#AA0000' : COLORS.primary,
                      borderColor: isNightMode ? '#FF2222' : 'transparent',
                    },
                  ]}
                  onPress={handleTogglePlayback}
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
                  <Icon
                    name={isPlaying ? 'pause' : 'play'}
                    size={28}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                {/* Tune Up Button */}
                <TouchableOpacity
                  testID="standby-next-button"
                  style={[
                    styles.controlButton,
                    {
                      backgroundColor: isNightMode
                        ? '#1A0000'
                        : 'rgba(255, 255, 255, 0.06)',
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  onPress={() => handleStepStation(1)}
                  accessibilityRole="button"
                  accessibilityLabel="Next Station">
                  <Icon name="skip-next" size={24} color={theme.textPrimary} />
                  <Text style={[styles.controlButtonLabel, {color: theme.textMuted}]}>
                    TUNE +
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 8 : SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 4,
  },
  topPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  topPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  topBrandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  topBrandText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: SPACING.md,
  },
  portraitBody: {
    flexDirection: 'column',
  },
  landscapeBody: {
    flexDirection: 'row',
  },
  clockSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: SPACING.md,
    justifyContent: 'center',
  },
  portraitClockSection: {
    width: '100%',
  },
  landscapeClockSection: {
    width: '40%',
    justifyContent: 'space-around',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 4,
  },
  clockDigits: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
    ...Platform.select({
      ios: {fontFamily: 'Courier'},
      android: {fontFamily: 'monospace'},
    }),
  },
  nightClockDigits: {
    textShadowColor: 'rgba(255, 30, 30, 0.4)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 10,
  },
  clockSeconds: {
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 4,
    fontVariant: ['tabular-nums'],
    ...Platform.select({
      ios: {fontFamily: 'Courier'},
      android: {fontFamily: 'monospace'},
    }),
  },
  stationInfoCard: {
    marginVertical: 6,
  },
  stationBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  stationColorIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stationTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  freqBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  freqBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 12,
    fontWeight: '500',
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  specText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  specDot: {
    fontSize: 10,
  },
  specLive: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tunerSection: {
    flex: 1,
    gap: SPACING.sm,
    justifyContent: 'space-between',
  },
  portraitTunerSection: {},
  landscapeTunerSection: {
    width: '60%',
  },
  vuContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  vuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vuTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  vuDbScale: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  vuBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 48,
    gap: 4,
  },
  vuBarTrack: {
    flex: 1,
    height: 48,
    justifyContent: 'flex-end',
    gap: 2,
  },
  vuSegment: {
    height: 3,
    borderRadius: 1,
  },
  dialScaleCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: SPACING.md,
    position: 'relative',
    overflow: 'hidden',
  },
  dialGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  dialTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dialBandText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  dialFreqLive: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  rulerContainer: {
    height: 64,
    position: 'relative',
    justifyContent: 'center',
    marginVertical: 4,
  },
  ticksLabelsRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 16,
  },
  tickLabelWrap: {
    position: 'absolute',
    transform: [{translateX: -12}],
    width: 24,
    alignItems: 'center',
  },
  tickLabelText: {
    fontSize: 10,
    fontWeight: '800',
  },
  rulerGuideLine: {
    position: 'absolute',
    top: 32,
    left: 0,
    right: 0,
    height: 2,
  },
  ticksTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 24,
    marginTop: 14,
  },
  tickBar: {
    width: 1.5,
    borderRadius: 0.5,
  },
  needleWrapper: {
    position: 'absolute',
    top: 6,
    bottom: 0,
    width: 10,
    transform: [{translateX: -5}],
    alignItems: 'center',
  },
  needleHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  needleLine: {
    width: 2,
    flex: 1,
    borderRadius: 1,
  },
  stationsDialRow: {
    height: 30,
    position: 'relative',
    marginTop: 8,
  },
  stationMarkerButton: {
    position: 'absolute',
    transform: [{translateX: -26}],
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  stationMarkerText: {
    fontSize: 9,
    letterSpacing: 0.3,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  controlButtonLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  playPauseButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default StandByTunerModal;
