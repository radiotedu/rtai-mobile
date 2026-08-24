import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import TrackPlayer, {
  State,
  useActiveTrack,
  usePlaybackState,
} from 'react-native-track-player';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {COLORS, SPACING} from '../theme/theme';
import {screenCopy} from '../i18n/screenCopy';
import {getChannelCopy} from '../i18n/channelCopy';
import {logSafeError} from '../utils/safeLog';
import api from '../services/api';
import {
  RADIO_CHANNELS,
  RadioChannel,
  isStationOnlyChannel,
  shouldUseStationOnlyPresentation,
} from '../data/radioChannels';
import {playChannelById} from '../services/playbackQueue';
import {useMetadata} from '../context/MetadataContext';
import {useChannels} from '../context/ChannelContext';
import GlobalHeader from '../components/GlobalHeader';
import PageTransition from '../components/PageTransition';
import {
  buildFavoriteChannelOrder,
  loadFavoriteChannelIds,
  orderVotingChannelLast,
  saveFavoriteChannelIds,
  toggleFavoriteChannelId,
} from '../services/radioFavorites';

const RadioScreen = () => {
  const navigation = useNavigation<any>();
  const {i18n} = useTranslation();
  const copy = (key: string, values?: Record<string, string | number>) =>
    screenCopy(i18n.language, key, values);
  const playbackState = usePlaybackState();
  const activeTrack = useActiveTrack();
  const {metadata, clearMetadata} = useMetadata();
  const {activeChannels, isChecking} = useChannels();
  const [selectedChannel, setSelectedChannel] = useState<RadioChannel>(RADIO_CHANNELS[0]);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [currentVote, setCurrentVote] = useState<'up' | 'down' | null>(null);

  const state = playbackState?.state;
  const isPlaying = state === State.Playing && currentPlayingId === selectedChannel.id;
  const isBuffering =
    (state === State.Buffering || state === State.Loading) &&
    currentPlayingId === selectedChannel.id;

  const orderedChannels = useMemo(
    () => buildFavoriteChannelOrder(activeChannels, favoriteIds),
    [activeChannels, favoriteIds],
  );
  const allChannels = useMemo(
    () => orderVotingChannelLast([
      ...orderedChannels.favorites,
      ...orderedChannels.remaining,
    ]),
    [orderedChannels],
  );

  useEffect(() => {
    loadFavoriteChannelIds()
      .then(setFavoriteIds)
      .catch((error) => logSafeError('radio.favoritesLoad', error));
  }, []);

  // Reset the per-track up/down vote whenever the station or the playing song
  // changes, so a previous "like"/"dislike" doesn't stay highlighted on a new
  // channel or a new song.
  useEffect(() => {
    setCurrentVote(null);
  }, [selectedChannel.id, activeTrack?.id, metadata?.title]);

  useEffect(() => {
    if (!isChecking && activeChannels.length > 0) {
      const isCurrentActive = activeChannels.find((channel) => channel.id === selectedChannel.id);
      if (!isCurrentActive) {
        setSelectedChannel(activeChannels[0]);
      }
    }
  }, [activeChannels, isChecking, selectedChannel.id]);

  useEffect(() => {
    if (activeTrack?.id && activeTrack.id !== selectedChannel.id) {
      const channel = activeChannels.find((item) => item.id === activeTrack.id);
      if (channel) {
        setSelectedChannel(channel);
      }
    }
  }, [activeTrack?.id, activeChannels, selectedChannel.id]);

  useEffect(() => {
    fetchHistory(selectedChannel.id);
    const interval = setInterval(() => fetchHistory(selectedChannel.id), 60000);
    return () => clearInterval(interval);
  }, [selectedChannel.id]);

  const fetchHistory = async (channelId: string) => {
    const channel = RADIO_CHANNELS.find(item => item.id === channelId);
    if (isStationOnlyChannel(channel)) {
      setHistory([]);
      setIsLoadingHistory(false);
      return;
    }
    try {
      setIsLoadingHistory(true);
      const response = await api.get(`/radio/history/${channelId}`);
      setHistory(response.data.data || []);
    } catch (error) {
      logSafeError('radio.history', error);
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const playChannel = async (channel: RadioChannel) => {
    setSelectedChannel(channel);
    clearMetadata();
    const result = await playChannelById(channel.id);
    if (result.played) {
      setCurrentPlayingId(channel.id);
    }
  };

  // Tapping a station plays it AND opens the full-screen player.
  const openChannel = (channel: RadioChannel) => {
    playChannel(channel);
    navigation.navigate('Player');
  };

  const togglePlayback = async () => {
    const currentState = await TrackPlayer.getState();
    if (currentState === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await playChannel(selectedChannel);
    }
  };

  const skipToNextChannel = () => {
    const currentIndex = activeChannels.findIndex((channel) => channel.id === selectedChannel.id);
    const nextChannel = activeChannels[(currentIndex + 1) % activeChannels.length];
    if (nextChannel) {
      playChannel(nextChannel);
    }
  };

  const skipToPreviousChannel = () => {
    const currentIndex = activeChannels.findIndex((channel) => channel.id === selectedChannel.id);
    const previousIndex = currentIndex <= 0 ? activeChannels.length - 1 : currentIndex - 1;
    const previousChannel = activeChannels[previousIndex];
    if (previousChannel) {
      playChannel(previousChannel);
    }
  };

  const toggleFavorite = async (channelId: string) => {
    const nextFavorites = toggleFavoriteChannelId(favoriteIds, channelId);
    setFavoriteIds(nextFavorites);
    try {
      await saveFavoriteChannelIds(nextFavorites);
    } catch (error) {
      logSafeError('radio.favoritesSave', error);
    }
  };

  const openHistory = () => {
    fetchHistory(selectedChannel.id);
    setShowHistoryModal(true);
  };

  const selectedCopy = getChannelCopy(selectedChannel.copyKey, i18n.language, {
    name: selectedChannel.name,
    description: selectedChannel.description,
  });
  const currentQuality = useMemo(() => {
    if (activeTrack?.id !== selectedChannel.id) return 'normal';
    const url = String(activeTrack?.url ?? '');
    if (url.includes('-flac')) return 'flac';
    if (url.includes('-low')) return 'low';
    return (activeTrack?.streamQuality as any) || 'normal';
  }, [activeTrack?.id, activeTrack?.url, activeTrack?.streamQuality, selectedChannel.id]);
  const stationOnlyPresentation = shouldUseStationOnlyPresentation(selectedChannel, currentQuality);
  const displayTitle = stationOnlyPresentation ? selectedCopy.name : metadata?.title || activeTrack?.title || selectedCopy.name;
  const displayArtist = stationOnlyPresentation ? '' : metadata?.artist || activeTrack?.artist || selectedCopy.description;
  const displayArtwork =
    stationOnlyPresentation ? activeTrack?.artwork || selectedChannel.logo : metadata?.artwork || activeTrack?.artwork || selectedChannel.logo;
  const displayArtworkSource =
    typeof displayArtwork === 'string' ? {uri: displayArtwork} : displayArtwork;

  const renderHistoryItem = ({item}: {item: any}) => (
    <View style={styles.historyItem}>
      <Image
        source={{uri: item.cover_url || 'https://radiotedu.com/logo.png'}}
        style={styles.historyCover}
      />
      <View style={styles.historyInfo}>
        <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.historyArtist} numberOfLines={1}>{item.artist}</Text>
      </View>
      <Text style={styles.historyTime}>
        {new Date(item.played_at).toLocaleTimeString(i18n.resolvedLanguage || i18n.language || 'en', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );

  return (
    <PageTransition>
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <GlobalHeader />

          <View style={styles.nowPlayingCard}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Player')}
              activeOpacity={0.85}
              accessibilityLabel={copy('common.openPlayer')}>
              {displayArtworkSource ? <Image source={displayArtworkSource} style={styles.nowArtwork} /> : <View style={styles.nowArtworkPlaceholder} />}
            </TouchableOpacity>
            <View style={styles.nowBody}>
              <View style={styles.liveRow}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>{copy('radio.live')}</Text>
                </View>
                {currentQuality === 'flac' ? (
                  <View style={styles.hifiBadge}>
                    <Icon name="star-four-points" size={12} color="#FFD54A" />
                    <Text style={styles.hifiText}>Hi-Fi</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.trackTitle} numberOfLines={1}>{displayTitle}</Text>
              <Text style={styles.trackArtist} numberOfLines={1}>{displayArtist}</Text>
            </View>
            <View style={styles.nowActions}>
              <TouchableOpacity style={styles.iconButton} onPress={openHistory}>
                <Icon name="history" size={20} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.playButton} onPress={togglePlayback}>
                {isBuffering ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Icon name={isPlaying ? 'pause' : 'play'} size={25} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.transportRow}>
            <TouchableOpacity style={styles.transportButton} onPress={skipToPreviousChannel}>
              <Icon name="skip-previous" size={22} color={COLORS.textMuted} />
              <Text style={styles.transportText}>{copy('radio.previous')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.votePill, currentVote === 'down' && styles.votePillActive]}
              onPress={() => setCurrentVote(currentVote === 'down' ? null : 'down')}>
              <Icon name={currentVote === 'down' ? 'thumb-down' : 'thumb-down-outline'} size={18} color={currentVote === 'down' ? COLORS.primary : COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.votePill, currentVote === 'up' && styles.votePillActive]}
              onPress={() => setCurrentVote(currentVote === 'up' ? null : 'up')}>
              <Icon name={currentVote === 'up' ? 'thumb-up' : 'thumb-up-outline'} size={18} color={currentVote === 'up' ? COLORS.success : COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.transportButton} onPress={skipToNextChannel}>
              <Text style={styles.transportText}>{copy('radio.next')}</Text>
              <Icon name="skip-next" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{copy('radio.favorites')}</Text>
              <Text style={styles.sectionMeta}>{copy('radio.count', {count: orderedChannels.favorites.length})}</Text>
            </View>

            {orderedChannels.favorites.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoriteList}>
                {orderedChannels.favorites.map((channel) => (
                  <FavoriteCard
                    key={channel.id}
                    channel={channel}
                    isActive={selectedChannel.id === channel.id}
                    isPlaying={currentPlayingId === channel.id && state === State.Playing}
                    onPress={() => openChannel(channel)}
                    onToggleFavorite={() => toggleFavorite(channel.id)}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyFavoriteCard}>
                <Icon name="heart-plus-outline" size={22} color={COLORS.primary} />
                <Text style={styles.emptyFavoriteText}>{copy('radio.favoritesHint')}</Text>
              </View>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{copy('radio.all')}</Text>
              <Text style={styles.sectionMeta}>{copy('radio.count', {count: activeChannels.length})}</Text>
            </View>

            <View style={styles.grid}>
              {allChannels.map((channel) => (
                <ChannelGridCard
                  key={channel.id}
                  channel={channel}
                  isFavorite={favoriteIds.includes(channel.id)}
                  isActive={selectedChannel.id === channel.id}
                  isPlaying={currentPlayingId === channel.id && state === State.Playing}
                  onPress={() => openChannel(channel)}
                  onToggleFavorite={() => toggleFavorite(channel.id)}
                />
              ))}
            </View>
          </ScrollView>

          <HistoryModal
            visible={showHistoryModal}
            channel={selectedChannel}
            history={history}
            isLoading={isLoadingHistory}
            stationOnlyMetadata={isStationOnlyChannel(selectedChannel)}
            renderItem={renderHistoryItem}
            onClose={() => setShowHistoryModal(false)}
          />
        </SafeAreaView>
      </View>
    </PageTransition>
  );
};

function FavoriteCard({
  channel,
  isActive,
  isPlaying,
  onPress,
  onToggleFavorite,
}: {
  channel: RadioChannel;
  isActive: boolean;
  isPlaying: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const {i18n} = useTranslation();
  const channelCopy = getChannelCopy(channel.copyKey, i18n.language, {
    name: channel.name,
    description: channel.description,
  });
  return (
    <TouchableOpacity
      style={[styles.favoriteCard, isActive && {borderColor: channel.color}]}
      onPress={onPress}
      activeOpacity={0.82}>
      <Image source={channel.logo} style={styles.stationLogo} resizeMode="cover" />
      <Text style={styles.favoriteName} numberOfLines={1}>{channelCopy.name}</Text>
      {channel.streams.flac ? <Text style={styles.stationFlacText}>Hi-Fi</Text> : null}
      {!isStationOnlyChannel(channel) ? <Text style={styles.favoriteDesc} numberOfLines={1}>{channelCopy.description}</Text> : null}
      {isPlaying ? <View style={[styles.equalizer, {backgroundColor: channel.color}]} /> : null}
      <TouchableOpacity style={styles.favoriteHeart} onPress={onToggleFavorite}>
        <Icon name="heart" size={18} color={COLORS.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function ChannelGridCard({
  channel,
  isFavorite,
  isActive,
  isPlaying,
  onPress,
  onToggleFavorite,
}: {
  channel: RadioChannel;
  isFavorite: boolean;
  isActive: boolean;
  isPlaying: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const {i18n} = useTranslation();
  const copy = (key: string) => screenCopy(i18n.language, key);
  const channelCopy = getChannelCopy(channel.copyKey, i18n.language, {
    name: channel.name,
    description: channel.description,
  });
  return (
    <TouchableOpacity
      style={[styles.channelCard, isActive && {borderColor: channel.color, backgroundColor: `${channel.color}18`}]}
      onPress={onPress}
      activeOpacity={0.84}>
      <View style={styles.cardTopRow}>
        <Image source={channel.logo} style={styles.stationLogo} resizeMode="cover" />
        <TouchableOpacity onPress={onToggleFavorite} hitSlop={{top: 8, right: 8, bottom: 8, left: 8}}>
          <Icon name={isFavorite ? 'heart' : 'heart-outline'} size={19} color={isFavorite ? COLORS.primary : COLORS.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={styles.channelNameRow}>
        <Text style={styles.channelName} numberOfLines={1}>{channelCopy.name}</Text>
        {channel.streams.flac ? <Text style={styles.stationFlacText}>Hi-Fi</Text> : null}
      </View>
      {!isStationOnlyChannel(channel) ? <Text style={styles.channelDescription} numberOfLines={1}>{channelCopy.description}</Text> : null}
      <View style={styles.cardBottomRow}>
        <Text style={[styles.statusText, isPlaying && {color: channel.color}]}>
          {isPlaying ? copy('common.playing') : copy('common.listen')}
        </Text>
        <Icon name={isPlaying ? 'volume-high' : 'play-circle-outline'} size={18} color={isPlaying ? channel.color : COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function HistoryModal({
  visible,
  channel,
  history,
  isLoading,
  stationOnlyMetadata,
  renderItem,
  onClose,
}: {
  visible: boolean;
  channel: RadioChannel;
  history: any[];
  isLoading: boolean;
  stationOnlyMetadata?: boolean;
  renderItem: ({item}: {item: any}) => React.ReactElement;
  onClose: () => void;
}) {
  const {i18n} = useTranslation();
  const copy = (key: string, values?: Record<string, string | number>) =>
    screenCopy(i18n.language, key, values);
  const channelCopy = getChannelCopy(channel.copyKey, i18n.language, {
    name: channel.name,
    description: channel.description,
  });
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.historyModalContent}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={styles.headerInfo}>
              <Text style={styles.modalTitle}>{copy('radio.historyTitle')}</Text>
              <Text style={styles.modalSubtitle}>{copy('radio.history', {name: channelCopy.name})}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Icon name="close-circle" size={28} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {stationOnlyMetadata ? (
            <View style={styles.emptyHistoryContainer}>
              <Icon name="information-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.noHistoryText}>{copy('radio.noHistory')}</Text>
            </View>
          ) : isLoading && history.length === 0 ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : history.length > 0 ? (
            <FlatList
              data={history}
              renderItem={renderItem}
              keyExtractor={(item, index) => item.id || index.toString()}
              contentContainerStyle={styles.historyFlatList}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyHistoryContainer}>
              <Icon name="clock-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.noHistoryText}>{copy('radio.noHistory')}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  nowPlayingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 24,
    backgroundColor: '#211113',
    borderWidth: 1,
    borderColor: 'rgba(227,30,36,0.28)',
  },
  nowArtwork: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  nowBody: {
    flex: 1,
    marginHorizontal: SPACING.md,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 5,
  },
  liveText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  trackTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  trackArtist: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  nowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  transportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    height: 38,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  transportText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  votePill: {
    width: 42,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  votePillActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 170,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  favoriteList: {
    gap: SPACING.sm,
  },
  favoriteCard: {
    width: 148,
    minHeight: 118,
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
  },
  favoriteName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: SPACING.sm,
  },
  favoriteDesc: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  favoriteHeart: {
    position: 'absolute',
    right: 10,
    top: 10,
  },
  equalizer: {
    position: 'absolute',
    left: SPACING.md,
    bottom: 10,
    width: 34,
    height: 4,
    borderRadius: 999,
  },
  emptyFavoriteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyFavoriteText: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  channelCard: {
    width: '48%',
    minHeight: 124,
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channelName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  hifiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,213,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,213,74,0.48)',
  },
  hifiText: {
    color: '#FFD54A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  nowArtworkPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  stationLogo: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F4F4F4',
  },
  stationLogoPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F4F4F4',
  },
  channelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  stationFlacText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  channelDescription: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  statusText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  historyModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerInfo: {
    flex: 1,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseButton: {
    padding: 4,
  },
  historyFlatList: {
    paddingBottom: 20,
    gap: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  historyCover: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#333',
  },
  historyInfo: {
    flex: 1,
    marginLeft: 14,
  },
  historyTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  historyArtist: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  historyTime: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  modalLoading: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyHistoryContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noHistoryText: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
});

export default RadioScreen;
