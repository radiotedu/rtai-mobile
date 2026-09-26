import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
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
import {useAuth} from '../context/AuthContext';
import {
  PODCAST_ID_PREFIX,
  buildPodcastTrack,
  pausePlaybackByUser,
  playTrackById,
  resumePlaybackByUser,
} from '../services/playbackQueue';
import {Podcast} from '../services/podcastService';
import PodcastDownloadButton from '../components/PodcastDownloadButton';
import {formatTimestamp} from '../utils/playbackTime';
import {
  findMemberEpisodeProgress,
  loadMemberLibraryForAccount,
  saveMemberEpisodeProgressForAccount,
} from '../services/memberLibraryService';

const FALLBACK_PODCAST_ARTWORK =
  'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu.png';

const SPEED_OPTIONS = [1.0, 1.25, 1.5, 2.0];

export const PodcastPlayerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();
  const progress = useProgress(300);
  const {user} = useAuth();
  const memberAccountId = user && !user.is_guest ? user.id : null;

  const routePodcast: Podcast | undefined = route.params?.podcast;
  const routePodcastId: string | undefined = route.params?.podcastId;

  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

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

  const currentPodcastItem: Podcast = useMemo(() => {
    if (routePodcast) return routePodcast;
    const cleanId = routePodcastId || (activeTrack?.id?.replace(PODCAST_ID_PREFIX, '') ?? 'podcast_episode');
    return {
      id: cleanId,
      title: displayTitle,
      audioUrl: activeTrack?.url || '',
      feedTitle: displayHost,
      imageUrl: displayArtwork,
      date: displayDate,
      description: '',
    };
  }, [routePodcast, routePodcastId, activeTrack?.id, activeTrack?.url, displayTitle, displayHost, displayArtwork, displayDate]);

  const activePodcastId =
    typeof activeTrack?.id === 'string' && activeTrack.id.startsWith(PODCAST_ID_PREFIX)
      ? activeTrack.id.slice(PODCAST_ID_PREFIX.length)
      : '';
  const episodeId = routePodcast?.id || routePodcastId || activePodcastId;
  const isCurrentEpisode =
    !!episodeId && activeTrack?.id === `${PODCAST_ID_PREFIX}${episodeId}`;
  const memberEpisodeSyncKey =
    memberAccountId && isCurrentEpisode ? `${memberAccountId}:${episodeId}` : null;
  const [resumeReadyKey, setResumeReadyKey] = useState<string | null>(null);
  const resumeRequestedKeyRef = useRef<string | null>(null);
  const progressSaveRef = useRef<{
    key: string;
    savedAt: number;
    position: number;
  } | null>(null);

  useEffect(() => {
    if (!memberEpisodeSyncKey || !memberAccountId) {
      setResumeReadyKey(null);
      resumeRequestedKeyRef.current = null;
      progressSaveRef.current = null;
      return;
    }
    if (resumeRequestedKeyRef.current === memberEpisodeSyncKey) {
      return;
    }

    resumeRequestedKeyRef.current = memberEpisodeSyncKey;
    let isCurrent = true;
    setResumeReadyKey(null);

    const restoreProgress = async () => {
      try {
        const library = await loadMemberLibraryForAccount(memberAccountId);
        if (!isCurrent) {
          return;
        }

        const saved = findMemberEpisodeProgress(library, episodeId);
        if (
          saved &&
          !saved.completed &&
          saved.position_seconds > 5 &&
          (!saved.duration_seconds || saved.position_seconds < saved.duration_seconds - 10)
        ) {
          const local = await TrackPlayer.getProgress();
          if (isCurrent && local.position < 3) {
            await TrackPlayer.seekTo(saved.position_seconds);
          }
        }
      } catch (error) {
        logSafeError('podcastPlayer.memberProgressRestore', error);
      } finally {
        if (isCurrent) {
          setResumeReadyKey(memberEpisodeSyncKey);
        }
      }
    };

    void restoreProgress();
    return () => {
      isCurrent = false;
    };
  }, [memberEpisodeSyncKey, memberAccountId, episodeId]);

  useEffect(() => {
    if (
      !memberEpisodeSyncKey ||
      !memberAccountId ||
      resumeReadyKey !== memberEpisodeSyncKey ||
      !isCurrentEpisode ||
      progress.duration <= 0 ||
      progress.position <= 0
    ) {
      return;
    }

    const now = Date.now();
    const previous = progressSaveRef.current;
    const sameEpisode = previous?.key === memberEpisodeSyncKey;
    const previousPosition = sameEpisode ? (previous?.position ?? -1) : -1;
    const shouldSavePaused =
      (state === State.Paused || state === State.Stopped) &&
      Math.abs(progress.position - previousPosition) > 1;
    const shouldSaveWhilePlaying =
      isPlaying && (!sameEpisode || now - (previous?.savedAt ?? 0) >= 15000);
    if (!shouldSavePaused && !shouldSaveWhilePlaying) {
      return;
    }

    progressSaveRef.current = {
      key: memberEpisodeSyncKey,
      savedAt: now,
      position: progress.position,
    };
    void saveMemberEpisodeProgressForAccount(memberAccountId, {
      episodeId,
      positionSeconds: Math.floor(progress.position),
      durationSeconds: Math.floor(progress.duration),
      completed: progress.duration - progress.position <= 10,
      title: currentPodcastItem.title,
      subtitle: currentPodcastItem.feedTitle,
      artworkUrl: currentPodcastItem.imageUrl,
    });
  }, [
    memberEpisodeSyncKey,
    resumeReadyKey,
    isCurrentEpisode,
    state,
    isPlaying,
    progress.position,
    progress.duration,
    memberAccountId,
    episodeId,
    currentPodcastItem.title,
    currentPodcastItem.feedTitle,
    currentPodcastItem.imageUrl,
  ]);

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

        <View style={styles.topBarRight}>
          <PodcastDownloadButton podcast={currentPodcastItem} size={22} />
        </View>
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

      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0c10',
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
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
});

export default PodcastPlayerScreen;
