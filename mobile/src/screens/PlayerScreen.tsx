import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import TrackPlayer, {
  State,
  useActiveTrack,
  usePlaybackState,
} from 'react-native-track-player';
import {COLORS, SPACING} from '../theme/theme';
import {logSafeError} from '../utils/safeLog';
import {
  RADIO_CHANNELS,
  RadioChannel,
  StreamQuality,
  shouldUseStationOnlyPresentation,
} from '../data/radioChannels';
import {
  isPodcastId,
  pausePlaybackByUser,
  playChannelById,
  resumePlaybackByUser,
} from '../services/playbackQueue';
import {
  loadFavoriteChannelIds,
  saveFavoriteChannelIds,
  subscribeFavoriteChannelIds,
  toggleFavoriteChannelId,
} from '../services/radioFavorites';
import {useMetadata} from '../context/MetadataContext';
import {useChannels} from '../context/ChannelContext';
import {useStreamPreferences} from '../hooks/useStreamPreferences';
import type {StreamQualityPreference} from '../services/streamPreferences';
import {useTranslation} from 'react-i18next';
import {appCopy} from '../i18n/appCopy';
import {fetchScrollableLyrics} from '../services/lyricsService';
import {useSleepTimer} from '../services/sleepTimer';
import NetInfo from '@react-native-community/netinfo';

const FALLBACK_ARTWORK = 'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu.png';

const QUALITY_OPTIONS: Array<{
  quality: StreamQualityPreference;
  labelKey: string;
  descriptionKey: string;
  icon: string;
}> = [
  {quality: 'automatic', labelKey: 'player.automatic', descriptionKey: 'player.adapts', icon: 'auto-fix'},
  {quality: 'low', labelKey: 'player.low', descriptionKey: 'player.lowDescription', icon: 'signal-cellular-1'},
  {quality: 'normal', labelKey: 'player.normal', descriptionKey: 'player.normalDescription', icon: 'signal-cellular-2'},
  {quality: 'flac', labelKey: 'player.highQuality', descriptionKey: 'player.flacCodecDescription', icon: 'waveform'},
];

/**
 * Full-screen, Spotify-style "now playing" view: a large album-art hero with
 * the song + artist beneath it, quality switcher, golden FLAC indicator,
 * and transport controls.
 */
const PlayerScreen = ({route}: any) => {
  const navigation = useNavigation<any>();
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();
  const {metadata} = useMetadata();
  const {activeChannels} = useChannels();
  const {preferences, setPreferences} = useStreamPreferences();
  const {i18n} = useTranslation();
  const copy = (key: string) => appCopy(i18n.language, key);
  const {width, height} = useWindowDimensions();

  const {
    remainingSeconds: sleepRemaining,
    setTimer: setSleep,
    cancelTimer: cancelSleep,
    isActive: isSleepActive,
  } = useSleepTimer();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [isSwitchingQuality, setIsSwitchingQuality] = useState(false);
  const [pendingQuality, setPendingQuality] = useState<StreamQualityPreference | null>(null);
  const [qualityMenuVisible, setQualityMenuVisible] = useState(false);
  const [sleepMenuVisible, setSleepMenuVisible] = useState(false);
  const [lyricsLines, setLyricsLines] = useState<string[]>([]);
  const [lyricsDismissedTrackKey, setLyricsDismissedTrackKey] = useState<string | null>(null);
  const [isLyricsPanelOpen, setIsLyricsPanelOpen] = useState(false);
  const [isCellular, setIsCellular] = useState(false);
  const [manualLyricsRequestedKey, setManualLyricsRequestedKey] = useState('');
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  const dismissY = useRef(new Animated.Value(0)).current;
  const scrollOffsetY = useRef(0);

  useEffect(() => {
    const unsubscribeNet = NetInfo.addEventListener(state => {
      setIsCellular(state.type === 'cellular');
    });
    NetInfo.fetch().then(state => {
      setIsCellular(state.type === 'cellular');
    }).catch(() => {});
    return () => unsubscribeNet();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeFavoriteChannelIds(setFavoriteIds);
    loadFavoriteChannelIds()
      .then(setFavoriteIds)
      .catch(() => {});
    return unsubscribe;
  }, []);

  const channelList = activeChannels.length ? activeChannels : RADIO_CHANNELS;

  useEffect(() => {
    const requestedStationId = String(route?.params?.stationId ?? '').trim();
    if (!requestedStationId || !channelList.some(channel => channel.id === requestedStationId)) {
      return;
    }
    playChannelById(requestedStationId).catch(error => {
      logSafeError('player.voiceIntent', error);
    });
  }, [channelList, route?.params?.stationId]);

  // The station currently playing (null when a podcast is playing).
  const currentChannel: RadioChannel | undefined = useMemo(() => {
    if (!activeTrack?.id || isPodcastId(activeTrack.id)) {
      return undefined;
    }
    return channelList.find(c => c.id === activeTrack.id);
  }, [activeTrack?.id, channelList]);

  const state = playbackState?.state;
  const isPlaying = state === State.Playing;
  const isBuffering = state === State.Buffering || state === State.Loading;

  const currentQuality: StreamQuality = useMemo(() => {
    const url = String(activeTrack?.url ?? '');
    if (url.includes('-flac')) return 'flac';
    if (url.includes('-low')) return 'low';
    if (activeTrack?.streamQuality) return activeTrack.streamQuality as StreamQuality;
    if (preferences.quality === 'flac' && currentChannel?.streams.flac) return 'flac';
    if (preferences.quality === 'low') return 'low';
    return 'normal';
  }, [activeTrack?.url, activeTrack?.streamQuality, preferences.quality, currentChannel]);
  const stationOnlyPresentation = shouldUseStationOnlyPresentation(currentChannel, currentQuality);
  const displayArtwork = stationOnlyPresentation
    ? activeTrack?.artwork || currentChannel?.logo || FALLBACK_ARTWORK
    : metadata?.artwork || activeTrack?.artwork || currentChannel?.logo || FALLBACK_ARTWORK;
  const displayArtworkSource =
    typeof displayArtwork === 'string' ? {uri: displayArtwork} : displayArtwork;
  const displayTitle = stationOnlyPresentation
    ? currentChannel?.name || 'Lo-Fi'
    : metadata?.title || activeTrack?.title || currentChannel?.name || 'RadioTEDU';
  const displayArtist =
    stationOnlyPresentation ? '' : metadata?.artist || (activeTrack?.artist as string) || currentChannel?.description || 'RadioTEDU';
  const lyricsTrackTitle = stationOnlyPresentation ? '' : String(metadata?.title || '').trim();
  const lyricsTrackArtist = stationOnlyPresentation ? '' : String(metadata?.artist || '').trim();
  const lyricsTrackKey = lyricsTrackTitle ? `${lyricsTrackArtist}\n${lyricsTrackTitle}` : '';

  const currentChannelId = currentChannel?.id;

  useEffect(() => {
    const controller = new AbortController();

    if (!currentChannelId || !lyricsTrackTitle) {
      setLyricsLines([]);
      setIsLyricsLoading(false);
      return () => controller.abort();
    }

    // On cellular/mobile data, do not auto-download. Only fetch if user tapped manual load for this track.
    if (isCellular && manualLyricsRequestedKey !== lyricsTrackKey) {
      setLyricsLines([]);
      setIsLyricsLoading(false);
      return () => controller.abort();
    }

    setIsLyricsLoading(true);
    fetchScrollableLyrics({
      track: lyricsTrackTitle,
      artist: lyricsTrackArtist,
      signal: controller.signal,
    })
      .then(lines => {
        setLyricsLines(lines);
        setIsLyricsLoading(false);
      })
      .catch(error => {
        setIsLyricsLoading(false);
        if (error?.name !== 'AbortError') {
          logSafeError('player.lyrics', error);
        }
      });
    return () => controller.abort();
  }, [currentChannelId, isCellular, lyricsTrackArtist, lyricsTrackKey, lyricsTrackTitle, manualLyricsRequestedKey]);

  const dismissPlayer = useCallback(() => {
    Animated.timing(dismissY, {
      toValue: height,
      duration: 180,
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) {
        navigation.goBack();
      }
    });
  }, [dismissY, height, navigation]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !qualityMenuVisible &&
          scrollOffsetY.current <= 0 &&
          gesture.dy > 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
        onPanResponderMove: (_event, gesture) => {
          dismissY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 120 || gesture.vy > 1) {
            dismissPlayer();
            return;
          }
          Animated.spring(dismissY, {
            toValue: 0,
            damping: 18,
            stiffness: 180,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(dismissY, {
            toValue: 0,
            damping: 18,
            stiffness: 180,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dismissPlayer, dismissY, qualityMenuVisible],
  );

  // The heart reflects the CURRENT station's favorite state
  const isFavorite = currentChannel
    ? favoriteIds.includes(currentChannel.id)
    : false;

  const togglePlayback = async () => {
    const {state: current} = await TrackPlayer.getPlaybackState();
    if (current === State.Playing) {
      await pausePlaybackByUser();
    } else {
      await resumePlaybackByUser();
    }
  };

  const seekPodcastBy = async (seconds: number) => {
    if (currentChannel || !isPodcastId(activeTrack?.id)) {
      return;
    }
    await TrackPlayer.seekBy(seconds).catch((error) => {
      logSafeError('player.podcastSeek', error);
    });
  };

  const goToOffset = async (delta: number) => {
    if (currentChannel) {
      const idx = channelList.findIndex(c => c.id === currentChannel.id);
      const base = idx === -1 ? 0 : idx;
      const next =
        channelList[(base + delta + channelList.length) % channelList.length];
      if (next) {
        await playChannelById(next.id).catch(() => {});
      }
      return;
    }
    // Podcast / queue item: step within the player queue.
    try {
      if (delta > 0) {
        await TrackPlayer.skipToNext();
      } else {
        await TrackPlayer.skipToPrevious();
      }
    } catch {
      // start/end of queue — ignore
    }
  };

  const toggleFavorite = async () => {
    if (!currentChannel) {
      return;
    }
    const next = toggleFavoriteChannelId(favoriteIds, currentChannel.id);
    setFavoriteIds(next);
    saveFavoriteChannelIds(next).catch(() => {});
  };

  const applyQualityChange = async (quality: StreamQualityPreference) => {
    if (quality === preferences.quality && !isSwitchingQuality) {
      setQualityMenuVisible(false);
      return;
    }
    setIsSwitchingQuality(true);
    setPendingQuality(quality);
    try {
      if (quality === 'automatic') {
        await setPreferences({quality});
        if (currentChannel) {
          await playChannelById(currentChannel.id);
        }
        setQualityMenuVisible(false);
        return;
      }
      if (currentChannel) {
        const result = await playChannelById(currentChannel.id, quality);
        if (!result.played) {
          return;
        }
      }
      await setPreferences({quality});
      setQualityMenuVisible(false);
    } catch (err) {
      logSafeError('player.qualityChange', err);
    } finally {
      setPendingQuality(null);
      setIsSwitchingQuality(false);
    }
  };

  const artSize = Math.min(width - SPACING.lg * 4, height * 0.38, 320);

  return (
    <Animated.View
      style={[styles.container, {transform: [{translateY: dismissY}]}]}
      {...panResponder.panHandlers}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      {/* Soft brand tint behind the art */}
      <View
        style={[
          styles.tint,
          {backgroundColor: currentChannel?.color || COLORS.primary},
        ]}
      />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.topButton}
            accessibilityLabel={copy('player.close')}>
            <Icon name="chevron-down" size={30} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.topLabelContainer}>
            <Text style={styles.topLabel} numberOfLines={1}>
              {currentChannel ? `RadioTEDU · ${currentChannel.name}` : isLive ? copy('player.live') : copy('player.playing')}
            </Text>
            {isSleepActive && sleepRemaining !== null ? (
              <Text style={styles.sleepBadgeText}>
                🌙 {Math.floor(sleepRemaining / 60)}:{(sleepRemaining % 60).toString().padStart(2, '0')}
              </Text>
            ) : null}
          </View>
          <View style={styles.topRightActions}>
            <TouchableOpacity
              onPress={() => setSleepMenuVisible(true)}
              style={styles.topButton}
              accessibilityLabel="Sleep Timer">
              <Icon
                name={isSleepActive ? 'timer-sand' : 'timer-outline'}
                size={23}
                color={isSleepActive ? COLORS.primary : COLORS.text}
              />
            </TouchableOpacity>
            {currentChannel ? (
              <TouchableOpacity
                onPress={() => setQualityMenuVisible(true)}
                style={styles.topButton}
                accessibilityLabel={copy('player.qualityMenu')}>
                <Icon name="tune-variant" size={23} color={COLORS.text} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={16}
          onScroll={event => {
            scrollOffsetY.current = event.nativeEvent.contentOffset.y;
          }}>
          <View style={styles.artWrap}>
            {displayArtworkSource ? (
              <Image
                source={displayArtworkSource}
                style={[styles.art, {width: artSize, height: artSize}]}
                resizeMode="cover"
              />
            ) : <View style={[styles.art, styles.artPlaceholder, {width: artSize, height: artSize}]} />}
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaText}>
              {currentChannel ? (
                <View style={styles.stationTag}>
                  <View style={[styles.stationTagDot, {backgroundColor: currentChannel.color || COLORS.primary}]} />
                  <Text style={styles.stationTagText}>{currentChannel.name}</Text>
                </View>
              ) : null}
              <Text style={styles.title} numberOfLines={2}>
                {displayTitle}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {displayArtist}
              </Text>
            </View>
            <TouchableOpacity
              onPress={toggleFavorite}
              disabled={!currentChannel}
              style={styles.heartButton}
              accessibilityLabel={isFavorite ? copy('player.favoriteRemove') : copy('player.favoriteAdd')}>
              <Icon
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={28}
                color={isFavorite ? COLORS.primary : COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>

          {isLive ? (
            <View style={styles.liveRow}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{copy('player.live')}</Text>
              </View>

              <View style={styles.liveBar}>
                <View style={styles.liveBarFill} />
              </View>
            </View>
          ) : (
            <View style={styles.spacer} />
          )}

          {(isLyricsPanelOpen || ((lyricsLines.length > 0 || isLyricsLoading) && !isCellular)) &&
          lyricsDismissedTrackKey !== lyricsTrackKey &&
          !stationOnlyPresentation ? (
            <View style={styles.lyricsPanel} accessibilityLabel={copy('player.lyrics')}>
              <View style={styles.lyricsHeader}>
                <Text style={styles.lyricsTitle}>{copy('player.lyrics')}</Text>
                <View style={styles.lyricsHeaderActions}>
                  <Text style={styles.lyricsProvider}>LRCLIB</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setIsLyricsPanelOpen(false);
                      setLyricsDismissedTrackKey(lyricsTrackKey);
                      setManualLyricsRequestedKey('');
                    }}
                    style={styles.lyricsClose}
                    accessibilityRole="button"
                    accessibilityLabel={copy('player.lyricsClose')}>
                    <Icon name="close" size={20} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
              </View>
              {isLyricsLoading ? (
                <View style={styles.lyricsStatusWrap}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.lyricsStatusText}>{copy('player.lyricsLoading')}</Text>
                </View>
              ) : lyricsLines.length > 0 ? (
                <ScrollView
                  style={styles.lyricsScroller}
                  contentContainerStyle={styles.lyricsContent}
                  nestedScrollEnabled
                  persistentScrollbar
                  showsVerticalScrollIndicator>
                  {lyricsLines.map((line, index) => (
                    <Text key={`${index}-${line}`} selectable style={styles.lyricsLine}>
                      {line}
                    </Text>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.lyricsStatusWrap}>
                  <Text style={styles.lyricsStatusText}>{copy('player.lyricsNotFound')}</Text>
                </View>
              )}
            </View>
          ) : !stationOnlyPresentation && (lyricsTrackTitle || displayTitle) ? (
            <View style={styles.cellularLyricsContainer}>
              <TouchableOpacity
                style={styles.cellularLyricsButton}
                activeOpacity={0.8}
                onPress={() => {
                  setIsLyricsPanelOpen(true);
                  setLyricsDismissedTrackKey('');
                  setManualLyricsRequestedKey(lyricsTrackKey);
                }}
                accessibilityRole="button"
                accessibilityLabel={copy('player.lyrics')}>
                <Text style={styles.cellularLyricsButtonText}>
                  {isLyricsLoading ? copy('player.lyricsLoading') : 'LYRICS'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.controls}>
            <TouchableOpacity
              onPress={() => currentChannel ? goToOffset(-1) : seekPodcastBy(-15)}
              style={styles.sideButton}
              accessibilityLabel={currentChannel ? copy('player.previous') : copy('player.rewind15')}>
              <Icon name={currentChannel ? 'skip-previous' : 'rewind-15'} size={40} color={COLORS.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={togglePlayback}
              style={styles.playButton}
              accessibilityLabel={isPlaying ? copy('player.pause') : copy('player.play')}>
              {isBuffering ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <Icon
                  name={isPlaying ? 'pause' : 'play'}
                  size={40}
                  color="#fff"
                  style={!isPlaying ? styles.playIcon : undefined}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => currentChannel ? goToOffset(1) : seekPodcastBy(30)}
              style={styles.sideButton}
              accessibilityLabel={currentChannel ? copy('player.next') : copy('player.forward30')}>
              <Icon name={currentChannel ? 'skip-next' : 'fast-forward-30'} size={40} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={sleepMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSleepMenuVisible(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.menuOverlay}
          onPress={() => setSleepMenuVisible(false)}>
          <View style={styles.qualityMenu} onStartShouldSetResponder={() => true}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Uyku Zamanlayıcısı</Text>
            <Text style={styles.menuSubtitle}>
              {isSleepActive && sleepRemaining !== null
                ? `Kalan süre: ${Math.floor(sleepRemaining / 60)} dakika ${sleepRemaining % 60} saniye`
                : 'Belirlenen süre sonunda yayın otomatik durdurulur'}
            </Text>

            {[15, 30, 45, 60].map(minutes => (
              <TouchableOpacity
                key={minutes}
                style={styles.menuOption}
                onPress={() => {
                  setSleep(minutes);
                  setSleepMenuVisible(false);
                }}>
                <Icon name="timer-sand" size={22} color={COLORS.primary} />
                <View style={styles.menuOptionText}>
                  <Text style={styles.menuOptionTitle}>{minutes} Dakika</Text>
                  <Text style={styles.menuOptionDescription}>{minutes} dakika sonra duraklat</Text>
                </View>
              </TouchableOpacity>
            ))}

            {isSleepActive ? (
              <TouchableOpacity
                style={[styles.menuOption, {marginTop: 6}]}
                onPress={() => {
                  cancelSleep();
                  setSleepMenuVisible(false);
                }}>
                <Icon name="close-circle-outline" size={22} color="#ff4444" />
                <View style={styles.menuOptionText}>
                  <Text style={[styles.menuOptionTitle, {color: '#ff4444'}]}>Zamanlayıcıyı Kapat</Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={qualityMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQualityMenuVisible(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.menuOverlay}
          onPress={() => setQualityMenuVisible(false)}>
          <View style={styles.qualityMenu} onStartShouldSetResponder={() => true}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>{copy('player.quality')}</Text>
            <Text style={styles.menuSubtitle}>{copy('player.adapts')}</Text>
            {QUALITY_OPTIONS.filter(option => {
              if (option.quality === 'automatic') return true;
              if (option.quality === 'flac') return Boolean(currentChannel?.streams.flac);
              if (option.quality === 'low') return Boolean(currentChannel?.streams.low && currentChannel?.streams.low !== currentChannel?.streams.normal);
              if (option.quality === 'normal') return Boolean(currentChannel?.streams.normal);
              return true;
            }).map(option => {
              const selected = (pendingQuality ?? preferences.quality) === option.quality;
              const gold = option.quality === 'flac';
              const customCodec = option.quality !== 'automatic' ? currentChannel?.codecLabels?.[option.quality] : null;
              const description = customCodec && customCodec.startsWith('MP3')
                ? `${customCodec} · ${copy('player.normalDescription').split('·')[1]?.trim() || copy(option.descriptionKey)}`
                : copy(option.descriptionKey);
              return (
                <TouchableOpacity
                  key={option.quality}
                  style={[styles.menuOption, selected && styles.menuOptionSelected]}
                  disabled={isSwitchingQuality}
                  onPress={() => applyQualityChange(option.quality)}>
                  <Icon name={option.icon} size={22} color={gold ? '#FFD700' : selected ? COLORS.primary : COLORS.textMuted} />
                  <View style={styles.menuOptionText}>
                    <Text style={[styles.menuOptionTitle, gold && styles.menuOptionGold]}>{copy(option.labelKey)}</Text>
                    <Text style={styles.menuOptionDescription}>{description}</Text>
                  </View>
                  {isSwitchingQuality && selected ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={selected ? COLORS.primary : COLORS.textMuted} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, width: '100%', height: '100%', backgroundColor: COLORS.background},
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
    opacity: 0.18,
  },
  safe: {flex: 1, paddingHorizontal: SPACING.lg},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  topButton: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
  topLabelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  sleepBadgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  stationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  stationTagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stationTagText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  scrollBody: {
    flexGrow: 1,
    justifyContent: 'space-around',
    paddingBottom: SPACING.lg,
  },
  artWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.md,
  },
  art: {
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  artPlaceholder: {
    borderWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  metaText: {flex: 1, paddingRight: SPACING.md},
  title: {color: COLORS.text, fontSize: 22, fontWeight: '900', lineHeight: 28},
  artist: {color: COLORS.textMuted, fontSize: 15, marginTop: 4},
  heartButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(227,30,36,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary},
  liveText: {color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1},
  goldFlacBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.16)',
    borderColor: '#FFD700',
    borderWidth: 1.2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#FFD700',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  goldFlacText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  liveBar: {flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.border, overflow: 'hidden'},
  liveBarFill: {width: '100%', height: '100%', backgroundColor: COLORS.primary, opacity: 0.5},
  spacer: {height: SPACING.md},
  lyricsPanel: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  lyricsHeader: {
    minHeight: 54,
    paddingLeft: SPACING.md,
    paddingRight: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  lyricsTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  lyricsHeaderActions: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm},
  lyricsProvider: {color: COLORS.textMuted, fontSize: 10, fontWeight: '800'},
  lyricsClose: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  lyricsScroller: {flexGrow: 0, height: 124},
  lyricsContent: {paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: 10},
  lyricsLine: {color: COLORS.text, fontSize: 16, lineHeight: 24},
  lyricsStatusWrap: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  lyricsStatusText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  cellularLyricsContainer: {
    marginTop: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellularLyricsButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  cellularLyricsButtonText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  lyricsLoadingContainer: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  lyricsLoadingText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  menuOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
  },
  qualityMenu: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  menuHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  menuTitle: {color: COLORS.text, fontSize: 20, fontWeight: '900'},
  menuSubtitle: {color: COLORS.textMuted, fontSize: 13, marginTop: 4, marginBottom: SPACING.md},
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: 66,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: SPACING.md,
  },
  menuOptionSelected: {
    backgroundColor: 'rgba(227, 30, 36, 0.1)',
    borderColor: 'rgba(227, 30, 36, 0.35)',
  },
  menuOptionText: {flex: 1},
  menuOptionTitle: {color: COLORS.text, fontSize: 15, fontWeight: '900'},
  menuOptionGold: {color: '#FFD700'},
  menuOptionDescription: {color: COLORS.textMuted, fontSize: 12, marginTop: 3},
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    gap: SPACING.xl,
  },
  sideButton: {width: 56, height: 56, alignItems: 'center', justifyContent: 'center'},
  playButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {marginLeft: 3},
});

export default PlayerScreen;

