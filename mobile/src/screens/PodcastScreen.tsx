import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import TrackPlayer, {
  State,
  useActiveTrack,
  usePlaybackState,
} from 'react-native-track-player';
import { COLORS, SPACING } from '../theme/theme';
import {logSafeError} from '../utils/safeLog';
import {
  fetchPodcasts,
  fetchAllPodcasts,
  resolvePodcastLaunchUrl,
  Podcast,
} from '../services/podcastService';
import {
  PODCAST_ID_PREFIX,
  buildPodcastTrack,
  ensureBrowsableQueue,
  playTrackById,
  setCachedPodcasts,
} from '../services/playbackQueue';
import {resolveCurrentStreamPreferences} from '../services/streamPreferences';
import GlobalHeader from '../components/GlobalHeader';
import PageTransition from '../components/PageTransition';
import {useTranslation} from 'react-i18next';
import {appCopy} from '../i18n/appCopy';

const PodcastScreen = () => {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();
  const {i18n} = useTranslation();
  const copy = (key: string) => appCopy(i18n.language, key);

  const hasLoadedRef = useRef(false);

  // Re-pull the RSS feeds every time the Podcasts tab gains focus so newly
  // uploaded episodes show up without restarting the app. The first load shows
  // the spinner; later focuses refresh silently in the background.
  useFocusEffect(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useCallback(() => {
      loadPodcasts(1, false, hasLoadedRef.current);
      hasLoadedRef.current = true;
      // loadPodcasts is declared below and intentionally remains stable for this focus listener.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const loadPodcasts = async (
    pageToLoad: number,
    append: boolean = false,
    silent: boolean = false,
  ) => {
    if (pageToLoad === 1 && !silent) setLoading(true);
    else if (pageToLoad !== 1) setLoadingMore(true);

    try {
      const { items, totalPages } = await fetchPodcasts(pageToLoad);
      setHasMore(totalPages > 0 && pageToLoad < totalPages);

      setPodcasts(prev => (append ? [...prev, ...items] : items));
      // Keep the shared playback queue's podcast cache in sync so episodes are
      // playable in-app (and appear in the Android Auto browse tree). The
      // first page is enough to seed the car catalog; later pages still play
      // via the add-and-play fallback in handlePodcastPress.
      if (!append) {
        const completeCatalog = await fetchAllPodcasts();
        setCachedPodcasts(completeCatalog.length > 0 ? completeCatalog : items);
      }
      setPage(pageToLoad);
    } catch (e) {
      logSafeError('podcasts.load', e);
      Alert.alert(copy('common.error'), copy('podcast.empty'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadPodcasts(page + 1, true);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    setHasMore(true);
    await loadPodcasts(1, false);
    setRefreshing(false);
  };

  const handlePodcastPress = async (podcast: Podcast) => {
    const trackId = `${PODCAST_ID_PREFIX}${podcast.id}`;

    // Already the active episode -> just toggle play/pause.
    if (activeTrack?.id === trackId) {
      const {state} = await TrackPlayer.getPlaybackState();
      if (state === State.Playing) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
      return;
    }

    const track = buildPodcastTrack(podcast);

    // No playable audio (external-only episode): open the source as a fallback.
    if (!track) {
      const url = resolvePodcastLaunchUrl(podcast);
      if (url && /^https?:\/\//i.test(url.trim())) {
        try {
          await Linking.openURL(url);
        } catch {
          Alert.alert(copy('common.error'), copy('podcast.openError'));
        }
      } else {
        Alert.alert(copy('common.error'), copy('podcast.noAudio'));
      }
      return;
    }

    setPlayingId(podcast.id);
    try {
      // Play the episode in-app. ExoPlayer follows the anchor.fm / RSS enclosure
      // redirect to the actual audio file, so these links play instead of
      // throwing the "this link can't be opened" dialog.
      const streamSelection = await resolveCurrentStreamPreferences();
      await ensureBrowsableQueue(streamSelection.quality);
      const played = await playTrackById(trackId);
      if (!played) {
        await TrackPlayer.add(track);
        await playTrackById(trackId);
      }
      await TrackPlayer.play();
    } catch (error) {
      logSafeError('podcasts.play', error);
      Alert.alert(copy('common.error'), copy('podcast.playError'));
    } finally {
      setPlayingId(null);
    }
  };

  const renderFooter = () => {
    if (!hasMore) return <View style={{ height: 40 }} />;

    return (
      <View style={styles.footerContainer}>
        {loadingMore ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
            <Text style={styles.loadMoreText}>{copy('podcast.loadMore')}</Text>
            <Icon name="chevron-down" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderItem = ({ item }: { item: Podcast }) => (
    <TouchableOpacity
      style={styles.podcastItem}
      onPress={() => handlePodcastPress(item)}
      activeOpacity={0.7}
      disabled={playingId === item.id}>
      {item.imageUrl ? (
        <Image
          source={{uri: item.imageUrl}}
          style={styles.podcastCover}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.podcastIcon}>
          <Icon name="microphone-variant" size={24} color={COLORS.primary} />
        </View>
      )}
      <View style={styles.podcastInfo}>
        <Text style={styles.podcastTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.podcastDate}>{item.date}</Text>
        <Text style={styles.podcastDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      <View style={styles.actionIcon}>
        {playingId === item.id ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : activeTrack?.id === `${PODCAST_ID_PREFIX}${item.id}` &&
          playbackState?.state === State.Playing ? (
          <Icon name="pause-circle" size={28} color={COLORS.primary} />
        ) : (
          <Icon name="play-circle-outline" size={28} color={COLORS.primary} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <PageTransition>
      <SafeAreaView style={styles.container}>
        <GlobalHeader />
        {loading && page === 1 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>{copy('podcast.loading')}</Text>
          </View>
        ) : (
          <FlatList
            data={podcasts}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Icon name="microphone-off" size={48} color={COLORS.surface} />
                <Text style={styles.emptyText}>
                  {copy('podcast.empty')}
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => loadPodcasts(1)}>
                  <Text style={styles.retryText}>{copy('podcast.retry')}</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </PageTransition>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  headerTitle: { color: COLORS.text, fontSize: 24, fontWeight: 'bold' },
  listContent: { padding: SPACING.md, paddingBottom: 170 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textMuted, marginTop: SPACING.sm },
  podcastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
  },
  podcastIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  podcastCover: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    marginRight: SPACING.md,
  },
  podcastInfo: { flex: 1, marginRight: SPACING.sm },
  podcastTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  podcastDate: {
    color: COLORS.primary,
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  podcastDescription: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  actionIcon: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: {
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  retryButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  retryText: { color: COLORS.background, fontWeight: 'bold' },
  footerContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  loadMoreText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    marginRight: 8,
  },
});

export default PodcastScreen;
