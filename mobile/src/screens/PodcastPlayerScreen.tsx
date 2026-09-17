import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import TrackPlayer, {
  State,
  useActiveTrack,
  usePlaybackState,
  useProgress,
} from 'react-native-track-player';
import {COLORS, SPACING} from '../theme/theme';
import {logSafeError} from '../utils/safeLog';
import {
  PODCAST_ID_PREFIX,
  buildPodcastTrack,
  isPodcastId,
  pausePlaybackByUser,
  playTrackById,
  resumePlaybackByUser,
} from '../services/playbackQueue';
import {Podcast} from '../services/podcastService';
import PodcastTranscriptViewer from '../components/PodcastTranscriptViewer';
import {formatTimestamp} from '../data/samplePodcastTranscripts';

const FALLBACK_PODCAST_ARTWORK =
  'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu.png';

const SPEED_OPTIONS = [1.0, 1.25, 1.5, 2.0];

export const PodcastPlayerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();
  const progress = useProgress(300);

  const routePodcast: Podcast | undefined = route.params?.podcast;
  const routePodcastId: string | undefined = route.params?.podcastId;

  const [showTranscript, setShowTranscript] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const isPodcast = isPodcastId(activeTrack?.id) || !!routePodcast || !!routePodcastId;
  const state = playbackState?.state;
  const isPlaying = state === State.Playing;
  const isBuffering = state === State.Buffering || state === State.Loading;

  // Auto-play route podcast if passed and not active track
  useEffect(() => {
    if (!routePodcast) {
      return;
    }
    const expectedTrackId = `${PODCAST_ID_PREFIX}${routePodcast.id}`;
    if (activeTrack?.id === expectedTrackId) {
      return;
    }

    const track = buildPodcastTrack(routePodcast);
    if (!track) {
      return;
    }

    (async () => {
      try {
        const played = await playTrackById(expectedTrackId);
        if (!played) {
          await TrackPlayer.add(track);
          await playTrackById(expectedTrackId);
        }
        await resumePlaybackByUser();
      } catch (err) {
        logSafeError('podcastPlayer.autoPlay', err);
      }
    })();
  }, [activeTrack?.id, routePodcast]);

  const displayTitle = useMemo(() => {
    if (routePodcast?.title) {
      return routePodcast.title;
    }
    if (activeTrack?.title) {
      return activeTrack.title;
    }
    return 'TEDÜ Akademik Sohbetler: Yapay Zeka Dönüşümü';
  }, [activeTrack?.title, routePodcast?.title]);

  const displayHost = useMemo(() => {
    if (routePodcast?.feedTitle) {
      return routePodcast.feedTitle;
    }
    if (activeTrack?.artist) {
      return activeTrack.artist;
    }
    return 'TED Üniversitesi · Prof. Dr. Ziya Selçuk';
  }, [activeTrack?.artist, routePodcast?.feedTitle]);

  const displayArtwork = useMemo(() => {
    if (routePodcast?.imageUrl) {
      return routePodcast.imageUrl;
    }
    if (activeTrack?.artwork) {
      return activeTrack.artwork;
    }
    return FALLBACK_PODCAST_ARTWORK;
  }, [activeTrack?.artwork, routePodcast?.imageUrl]);

  const displayDate = useMemo(() => {
    if (routePodcast?.date) {
      return routePodcast.date;
    }
    return '2026 Akademik Dönem';
  }, [routePodcast?.date]);

  const togglePlayback = useCallback(async () => {
    try {
      const {state: current} = await TrackPlayer.getPlaybackState();
      if (current === State.Playing) {
        await pausePlaybackByUser();
      } else {
        await resumePlaybackByUser();
      }
    } catch (err) {
      logSafeError('podcastPlayer.togglePlayback', err);
    }
  }, []);

  const seekBy = useCallback(async (seconds: number) => {
    try {
      await TrackPlayer.seekBy(seconds);
    } catch (err) {
      logSafeError('podcastPlayer.seekBy', err);
    }
  }, []);

  const handleSeekTo = useCallback(async (seconds: number) => {
    try {
      await TrackPlayer.seekTo(seconds);
    } catch (err) {
      logSafeError('podcastPlayer.seekTo', err);
    }
  }, []);

  const changeSpeed = useCallback(async (speed: number) => {
    try {
      setPlaybackSpeed(speed);
      await TrackPlayer.setRate(speed);
    } catch (err) {
      logSafeError('podcastPlayer.setRate', err);
    }
  }, []);

  const progressPercent = useMemo(() => {
    if (!progress.duration || progress.duration <= 0) {
      return 0;
    }
    return Math.min(100, Math.max(0, (progress.position / progress.duration) * 100));
  }, [progress.duration, progress.position]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0c10" />

      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          testID="podcast-player-back-button">
          <Icon name="chevron-down" size={30} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topKicker}>TEDÜ AKADEMİK PODCAST</Text>
          <Text style={styles.topTitle} numberOfLines={1}>
            {displayTitle}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setShowTranscript(prev => !prev)}
          style={[styles.transcriptToggleBtn, showTranscript && styles.transcriptToggleBtnActive]}
          accessibilityRole="button"
          accessibilityLabel="Transkripti aç ya da kapat"
          testID="podcast-player-transcript-toggle">
          <Icon
            name="text-box-search-outline"
            size={18}
            color={showTranscript ? '#fff' : COLORS.primary}
          />
          <Text
            style={[
              styles.transcriptToggleText,
              showTranscript && styles.transcriptToggleTextActive,
            ]}>
            Transkript
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Player Screen Content */}
      <View style={styles.content}>
        {/* Cover Art Card */}
        <View style={styles.artCard}>
          <Image
            source={{uri: displayArtwork}}
            style={styles.artImage}
            resizeMode="cover"
          />
          <View style={styles.academicBadge}>
            <Icon name="school" size={12} color="#fff" />
            <Text style={styles.academicBadgeText}>TEDÜ ACADEMIA</Text>
          </View>
        </View>

        {/* Episode Info */}
        <View style={styles.metaWrap}>
          <Text style={styles.dateLabel}>{displayDate}</Text>
          <Text style={styles.episodeTitle} numberOfLines={2}>
            {displayTitle}
          </Text>
          <Text style={styles.hostName} numberOfLines={1}>
            {displayHost}
          </Text>
        </View>

        {/* Scrubber & Timers */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, {width: `${progressPercent}%`}]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTimestamp(progress.position)}</Text>
            <Text style={styles.timeText}>
              {progress.duration > 0 ? formatTimestamp(progress.duration) : '--:--'}
            </Text>
          </View>
        </View>

        {/* Speed Multiplier Row */}
        <View style={styles.speedRow}>
          <Text style={styles.speedLabel}>Hız:</Text>
          {SPEED_OPTIONS.map(speed => (
            <TouchableOpacity
              key={speed}
              style={[
                styles.speedPill,
                playbackSpeed === speed && styles.speedPillActive,
              ]}
              onPress={() => changeSpeed(speed)}
              accessibilityRole="button"
              accessibilityLabel={`${speed} kat oynatma hızı`}
              testID={`speed-${speed}x`}>
              <Text
                style={[
                  styles.speedText,
                  playbackSpeed === speed && styles.speedTextActive,
                ]}>
                {speed}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Audio Transport Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            onPress={() => seekBy(-15)}
            style={styles.seekButton}
            accessibilityRole="button"
            accessibilityLabel="15 saniye geri al"
            testID="podcast-rewind-15">
            <Icon name="rewind-15" size={38} color={COLORS.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={togglePlayback}
            style={styles.playButton}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Durdur' : 'Oynat'}
            testID="podcast-play-toggle">
            {isBuffering ? (
              <ActivityIndicator size="large" color="#ffffff" />
            ) : (
              <Icon
                name={isPlaying ? 'pause' : 'play'}
                size={40}
                color="#ffffff"
                style={!isPlaying ? {marginLeft: 4} : undefined}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => seekBy(30)}
            style={styles.seekButton}
            accessibilityRole="button"
            accessibilityLabel="30 saniye ileri al"
            testID="podcast-forward-30">
            <Icon name="fast-forward-30" size={38} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Primary Transcript Pill Button */}
        <TouchableOpacity
          style={styles.transcriptPillButton}
          onPress={() => setShowTranscript(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="İnteraktif Transkript ve AI Ders Notlarını Aç"
          testID="podcast-open-transcript-pill">
          <Icon name="text-box-search-outline" size={20} color={COLORS.primary} />
          <Text style={styles.transcriptPillButtonText}>
            İnteraktif Transkript & AI Bilgi Kartları
          </Text>
          <Icon name="chevron-up" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Full-featured Interactive Transcript Modal / Bottom Sheet */}
      <Modal
        visible={showTranscript}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowTranscript(false)}
        testID="podcast-transcript-modal">
        <SafeAreaView style={styles.modalSafeContainer}>
          <PodcastTranscriptViewer
            currentTimeSeconds={progress.position}
            onSeek={handleSeekTo}
            onClose={() => setShowTranscript(false)}
            podcastTitle={displayTitle}
          />

          {/* Mini Playback bar inside transcript viewer for seamless continuous listening */}
          <View style={styles.modalMiniTransport}>
            <View style={styles.miniProgressLine}>
              <View style={[styles.miniProgressFill, {width: `${progressPercent}%`}]} />
            </View>

            <View style={styles.miniTransportRow}>
              <TouchableOpacity
                onPress={() => seekBy(-15)}
                style={styles.miniSeekBtn}
                accessibilityRole="button"
                accessibilityLabel="15 saniye geri">
                <Icon name="rewind-15" size={26} color={COLORS.text} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={togglePlayback}
                style={styles.miniPlayBtn}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Durdur' : 'Oynat'}
                testID="modal-mini-play-toggle">
                <Icon
                  name={isPlaying ? 'pause' : 'play'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => seekBy(30)}
                style={styles.miniSeekBtn}
                accessibilityRole="button"
                accessibilityLabel="30 saniye ileri">
                <Icon name="fast-forward-30" size={26} color={COLORS.text} />
              </TouchableOpacity>

              <View style={styles.miniTimeWrap}>
                <Text style={styles.miniTimeText}>
                  {formatTimestamp(progress.position)} /{' '}
                  {progress.duration > 0 ? formatTimestamp(progress.duration) : '--:--'}
                </Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0c10',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 4 : 0,
  },
  modalSafeContainer: {
    flex: 1,
    backgroundColor: '#0c0f14',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 4 : 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  topKicker: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  topTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  transcriptToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(227, 30, 36, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(227, 30, 36, 0.3)',
  },
  transcriptToggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  transcriptToggleText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  transcriptToggleTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: SPACING.lg,
  },
  artCard: {
    width: 240,
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#15181e',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    marginTop: SPACING.md,
  },
  artImage: {
    width: '100%',
    height: '100%',
  },
  academicBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  academicBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  metaWrap: {
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  dateLabel: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  episodeTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  hostName: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  progressContainer: {
    width: '100%',
    marginTop: SPACING.md,
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
  },
  speedLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  speedPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  speedPillActive: {
    backgroundColor: 'rgba(227, 30, 36, 0.2)',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  speedText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  speedTextActive: {
    color: COLORS.primary,
    fontWeight: '900',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 32,
    marginTop: SPACING.sm,
  },
  seekButton: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  transcriptPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginTop: SPACING.md,
  },
  transcriptPillButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginLeft: 10,
  },
  modalMiniTransport: {
    backgroundColor: '#15181e',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 6,
  },
  miniProgressLine: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  miniTransportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    gap: 16,
  },
  miniSeekBtn: {
    padding: 4,
  },
  miniPlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTimeWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  miniTimeText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

export default PodcastPlayerScreen;
