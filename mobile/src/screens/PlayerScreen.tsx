import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import NetInfo from '@react-native-community/netinfo';
import TrackPlayer, {
  State,
  useActiveTrack,
  usePlaybackState,
} from 'react-native-track-player';
import {COLORS, SPACING} from '../theme/theme';
import {
  HIGH_QUALITY_MOBILE_DATA_WARNING,
  RADIO_CHANNELS,
  RadioChannel,
  StreamQuality,
} from '../data/radioChannels';
import {isPodcastId, playChannelById} from '../services/playbackQueue';
import {
  loadFavoriteChannelIds,
  saveFavoriteChannelIds,
  toggleFavoriteChannelId,
} from '../services/radioFavorites';
import {useMetadata} from '../context/MetadataContext';
import {useChannels} from '../context/ChannelContext';
import {useStreamPreferences} from '../hooks/useStreamPreferences';
import {isCellularNetwork, StreamNetworkSnapshot} from '../services/streamPreferences';

const FALLBACK_ARTWORK = 'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu.png';

const QUALITY_OPTIONS: Array<{
  quality: StreamQuality;
  label: string;
  bitrate: string;
}> = [
  {quality: 'low', label: 'Low', bitrate: '32k'},
  {quality: 'normal', label: 'Normal', bitrate: '192k'},
  {quality: 'flac', label: 'FLAC', bitrate: 'Lossless'},
];

/**
 * Full-screen, Spotify-style "now playing" view: a large album-art hero with
 * the song + artist beneath it, quality switcher, golden FLAC indicator,
 * and transport controls.
 */
const PlayerScreen = () => {
  const navigation = useNavigation<any>();
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();
  const {metadata} = useMetadata();
  const {activeChannels} = useChannels();
  const {preferences, setPreferences} = useStreamPreferences();
  const {width, height} = useWindowDimensions();

  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [isSwitchingQuality, setIsSwitchingQuality] = useState(false);

  useEffect(() => {
    loadFavoriteChannelIds()
      .then(setFavoriteIds)
      .catch(() => {});
  }, []);

  const channelList = activeChannels.length ? activeChannels : RADIO_CHANNELS;

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

  const displayArtwork =
    metadata?.artwork ||
    (activeTrack?.artwork as string) ||
    currentChannel?.logo ||
    FALLBACK_ARTWORK;
  const displayTitle =
    metadata?.title || activeTrack?.title || currentChannel?.name || 'RadioTEDU';
  const displayArtist =
    metadata?.artist ||
    (activeTrack?.artist as string) ||
    currentChannel?.description ||
    'RadioTEDU';

  const isLive = !!currentChannel || (!!activeTrack && !isPodcastId(activeTrack.id));
  const currentQuality: StreamQuality = (activeTrack?.streamQuality as StreamQuality) || (preferences.quality === 'automatic' ? 'normal' : preferences.quality) || 'normal';
  const isFlacActive = currentQuality === 'flac';

  // The heart reflects the CURRENT station's favorite state
  const isFavorite = currentChannel
    ? favoriteIds.includes(currentChannel.id)
    : false;

  const togglePlayback = async () => {
    const {state: current} = await TrackPlayer.getPlaybackState();
    if (current === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
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

  const handleSelectQuality = async (quality: StreamQuality) => {
    if (quality === currentQuality && !isSwitchingQuality) {
      return;
    }

    if (quality === 'flac') {
      const net = (await NetInfo.fetch()) as StreamNetworkSnapshot;
      if (isCellularNetwork(net)) {
        Alert.alert(
          'FLAC over mobile data',
          currentChannel?.mobileDataWarning || HIGH_QUALITY_MOBILE_DATA_WARNING,
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Play FLAC',
              onPress: () => applyQualityChange(quality),
            },
          ],
        );
        return;
      }
    }

    await applyQualityChange(quality);
  };

  const applyQualityChange = async (quality: StreamQuality) => {
    setIsSwitchingQuality(true);
    try {
      await setPreferences({quality});
      if (currentChannel) {
        await playChannelById(currentChannel.id, quality);
      }
    } catch (err) {
      console.log('Quality change error:', err);
    } finally {
      setIsSwitchingQuality(false);
    }
  };

  const artSize = Math.min(width - SPACING.lg * 4, height * 0.38, 320);

  return (
    <View style={styles.container}>
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
            accessibilityLabel="Kapat">
            <Icon name="chevron-down" size={30} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topLabel} numberOfLines={1}>
            {isLive ? 'CANLI YAYIN' : 'ÇALIYOR'}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('StreamSettings')}
            style={styles.topButton}
            accessibilityLabel="Streaming quality settings">
            <Icon name="tune-variant" size={23} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <View style={styles.artWrap}>
            <Image
              source={{uri: displayArtwork}}
              style={[styles.art, {width: artSize, height: artSize}]}
              resizeMode="cover"
            />
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaText}>
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
              accessibilityLabel={isFavorite ? 'Favoriden çıkar' : 'Favoriye ekle'}>
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
                <Text style={styles.liveText}>LIVE</Text>
              </View>

              {/* Golden FLAC Symbol / Badge when FLAC is chosen */}
              {isFlacActive ? (
                <View style={styles.goldFlacBadge}>
                  <Icon name="star-four-points" size={14} color="#FFD700" />
                  <Text style={styles.goldFlacText}>FLAC</Text>
                </View>
              ) : null}

              <View style={styles.liveBar}>
                <View style={styles.liveBarFill} />
              </View>
            </View>
          ) : (
            <View style={styles.spacer} />
          )}

          {/* Quick Audio Quality Selector on Now Playing Page */}
          {isLive && currentChannel ? (
            <View style={styles.qualitySelectorRow}>
              <Text style={styles.qualitySelectorLabel}>Kalite:</Text>
              <View style={styles.qualityPills}>
                {QUALITY_OPTIONS.map(opt => {
                  const isSelected = currentQuality === opt.quality;
                  const isGold = opt.quality === 'flac' && isSelected;
                  return (
                    <TouchableOpacity
                      key={opt.quality}
                      style={[
                        styles.qualityPill,
                        isSelected && styles.qualityPillActive,
                        isGold && styles.qualityPillGold,
                      ]}
                      onPress={() => handleSelectQuality(opt.quality)}
                      disabled={isSwitchingQuality}>
                      {isGold ? (
                        <Icon name="star-four-points" size={12} color="#FFD700" style={{marginRight: 3}} />
                      ) : null}
                      <Text
                        style={[
                          styles.qualityPillText,
                          isSelected && styles.qualityPillTextActive,
                          isGold && styles.qualityPillTextGold,
                        ]}>
                        {opt.label} ({opt.bitrate})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {isSwitchingQuality ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={{marginLeft: 8}} />
              ) : null}
            </View>
          ) : null}

          <View style={styles.controls}>
            <TouchableOpacity
              onPress={() => goToOffset(-1)}
              style={styles.sideButton}
              accessibilityLabel="Önceki">
              <Icon name="skip-previous" size={40} color={COLORS.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={togglePlayback}
              style={styles.playButton}
              accessibilityLabel={isPlaying ? 'Duraklat' : 'Oynat'}>
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
              onPress={() => goToOffset(1)}
              style={styles.sideButton}
              accessibilityLabel="Sonraki">
              <Icon name="skip-next" size={40} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
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
  topLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
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
  qualitySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingHorizontal: 4,
  },
  qualitySelectorLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginRight: 8,
  },
  qualityPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  qualityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  qualityPillActive: {
    backgroundColor: 'rgba(227, 30, 36, 0.2)',
    borderColor: COLORS.primary,
  },
  qualityPillGold: {
    backgroundColor: 'rgba(255, 215, 0, 0.16)',
    borderColor: '#FFD700',
  },
  qualityPillText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  qualityPillTextActive: {
    color: '#fff',
    fontWeight: '900',
  },
  qualityPillTextGold: {
    color: '#FFD700',
    fontWeight: '900',
  },
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

