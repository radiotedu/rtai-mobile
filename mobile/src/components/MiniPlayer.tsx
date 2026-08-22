import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import TrackPlayer, {
  usePlaybackState,
  State,
  useActiveTrack,
} from 'react-native-track-player';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {COLORS} from '../theme/theme';
import {useNavigation, useNavigationState} from '@react-navigation/native';
import {playChannelById} from '../services/playbackQueue';
import {useMetadata} from '../context/MetadataContext';
import {useChannels} from '../context/ChannelContext';
import {shouldUseStationOnlyPresentation, RADIO_CHANNELS} from '../data/radioChannels';
import {logSafeError} from '../utils/safeLog';

const IMMERSIVE_GAME_ROUTES = new Set([
  'SnakeGame',
  'MemoryGame',
  'TetrisGame',
  'RhythmTapGame',
  'WordGuessGame',
]);

export function getDeepestActiveRouteName(state: any): string | undefined {
  let currentState = state;
  let activeRouteName: string | undefined;

  while (currentState?.routes?.length) {
    const index = typeof currentState.index === 'number' ? currentState.index : 0;
    const activeRoute = currentState.routes[index];
    if (!activeRoute) {
      break;
    }

    activeRouteName = activeRoute.name;
    currentState = activeRoute.state;
  }

  return activeRouteName;
}

export function shouldHideMiniPlayerForRoute(activeRouteName?: string): boolean {
  return (
    !activeRouteName ||
    activeRouteName === 'MainTabs' ||
    activeRouteName === 'Radio' ||
    activeRouteName === 'Profile' ||
    activeRouteName === 'Jukebox' ||
    activeRouteName === 'Player' ||
    IMMERSIVE_GAME_ROUTES.has(activeRouteName)
  );
}

const MiniPlayer = () => {
  const playbackState = usePlaybackState();
  const track = useActiveTrack();
  const navigation = useNavigation<any>();
  const {metadata} = useMetadata();
  const {activeChannels} = useChannels();
  const [isChangingChannel, setIsChangingChannel] = React.useState(false);

  const activeRouteName = useNavigationState(getDeepestActiveRouteName);
  const shouldHideForRoute = shouldHideMiniPlayerForRoute(activeRouteName);

  const state = playbackState?.state;
  const isPlaying = state === State.Playing;

  const [lastTrack, setLastTrack] = React.useState<any>(null);

  // Keep lastTrack updated whenever we have a valid track
  React.useEffect(() => {
    if (track) {
      setLastTrack(track);
    }
  }, [track]);

  // Use active track OR fallback to last known track to prevent flicker
  const displayTrack = track || lastTrack;
  const displayChannel = RADIO_CHANNELS.find(channel => channel.id === String(displayTrack?.id ?? ''));
  const stationOnlyPresentation = shouldUseStationOnlyPresentation(displayChannel, (displayTrack as any)?.streamQuality);

  // Simplified visibility: Show if we have ANY track info (current or last known)
  // Only hide on specific screens.
  if (
    (!displayTrack && !isChangingChannel) ||
    shouldHideForRoute
  ) {
    return null;
  }

  const skipToPrevious = async () => {
    console.log(
      '[MiniPlayer] skipToPrevious called. TrackID:',
      displayTrack?.id,
    );

    let prevIndex = activeChannels.length - 1; // Default to last channel

    if (displayTrack?.id) {
      const currentIndex = activeChannels.findIndex(
        c => c.id === displayTrack.id,
      );
      if (currentIndex !== -1) {
        prevIndex =
          (currentIndex - 1 + activeChannels.length) % activeChannels.length;
      } else {
        console.log(
          '[MiniPlayer] Current track not in active list, defaulting to last active.',
        );
      }
    } else {
      console.log(
        '[MiniPlayer] No active track ID, defaulting to last active.',
      );
    }

    const prevChannel = activeChannels[prevIndex];
    console.log('[MiniPlayer] Skipping to:', prevChannel.name);

    try {
      setIsChangingChannel(true);
      // Play within the existing browsable queue so the car browse list and
      // notification controls stay intact (no full reset).
      await playChannelById(prevChannel.id);
    } catch (error) {
      logSafeError('miniPlayer.previous', error);
    } finally {
      setTimeout(() => setIsChangingChannel(false), 500);
    }
  };

  const skipToNext = async () => {
    console.log('[MiniPlayer] skipToNext called. TrackID:', displayTrack?.id);

    let nextIndex = 0; // Default to first channel

    if (displayTrack?.id) {
      const currentIndex = activeChannels.findIndex(
        c => c.id === displayTrack.id,
      );
      if (currentIndex !== -1) {
        nextIndex = (currentIndex + 1) % activeChannels.length;
      } else {
        console.log(
          '[MiniPlayer] Current track not in active list, defaulting to first active.',
        );
      }
    } else {
      console.log(
        '[MiniPlayer] No active track ID, defaulting to first active.',
      );
    }

    const nextChannel = activeChannels[nextIndex];
    console.log('[MiniPlayer] Skipping to:', nextChannel.name);

    try {
      setIsChangingChannel(true);
      // Play within the existing browsable queue so the car browse list and
      // notification controls stay intact (no full reset).
      await playChannelById(nextChannel.id);
    } catch (error) {
      logSafeError('miniPlayer.next', error);
    } finally {
      setTimeout(() => setIsChangingChannel(false), 500);
    }
  };

  const isBuffering = state === State.Buffering || state === State.Connecting;

  const togglePlayback = async () => {
    if (state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  // Use context metadata if available, fallback to track data (or last known track)
  const displayTitle = stationOnlyPresentation ? 'RadioTEDU Lo-Fi' : metadata?.title || displayTrack?.title;
  const displayArtist = stationOnlyPresentation ? '' : metadata?.artist || displayTrack?.artist;
  const displayArtwork = stationOnlyPresentation ? displayTrack?.artwork : metadata?.artwork || displayTrack?.artwork;
  const displayArtworkSource = typeof displayArtwork === 'string' ? {uri: displayArtwork} : displayArtwork;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.artworkContainer}>
          {displayArtworkSource &&
          displayArtwork !== 'https://radiotedu.com/logo.png' ? (
            <Image source={displayArtworkSource} style={styles.artwork} />
          ) : <View style={styles.placeholderArtwork} />}
        </View>

        <TouchableOpacity
          style={styles.infoContainer}
          onPress={() => navigation.navigate('Player')}>
          <Text style={styles.title} numberOfLines={1}>
            {displayTitle}
          </Text>
          {displayArtist ? <Text style={styles.artist} numberOfLines={1}>{displayArtist}</Text> : null}
        </TouchableOpacity>

        <View style={styles.controls}>
          <TouchableOpacity onPress={skipToPrevious} style={styles.iconButton}>
            <Icon name="skip-previous" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlayback} style={styles.playButton}>
            {isBuffering ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color="#fff"
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={skipToNext} style={styles.iconButton}>
            <Icon name="skip-next" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90, // Raised to clear the Total Tab Bar (approx 60-80px)
    left: 8,
    right: 8,
    backgroundColor: '#282828',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artworkContainer: {
    marginRight: 12,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: 4,
  },
  placeholderArtwork: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: '#404040',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: '#b3b3b3',
    fontSize: 12,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
});

export default MiniPlayer;
