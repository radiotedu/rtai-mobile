import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import NetInfo from '@react-native-community/netinfo';
import TrackPlayer, {State} from 'react-native-track-player';
import {COLORS, SPACING} from '../theme/theme';
import type {StreamQuality} from '../data/radioChannels';
import {useStreamPreferences} from '../hooks/useStreamPreferences';
import {
  automaticQualityForNetwork,
  isCellularNetwork,
  StreamNetworkSnapshot,
  StreamQualityPreference,
} from '../services/streamPreferences';
import {isPodcastId, playChannelById} from '../services/playbackQueue';

const QUALITY_OPTIONS: Array<{
  value: StreamQualityPreference;
  title: string;
  description: string;
  icon: string;
}> = [
  {
    value: 'automatic',
    title: 'Automatic',
    description: 'Adapts between Low (32 kbit) and Normal (192 kbit). Fallback automatically on slow connection.',
    icon: 'auto-fix',
  },
  {
    value: 'low',
    title: 'Low (32 kbit)',
    description: 'Uses the least data and starts fastest on weak connections (/radio-low).',
    icon: 'signal-cellular-1',
  },
  {
    value: 'normal',
    title: 'Normal (192 kbit)',
    description: 'Standard crystal-clear RadioTEDU stream (/radio).',
    icon: 'signal-cellular-2',
  },
  {
    value: 'flac',
    title: 'FLAC (Lossless)',
    description: 'Uncompressed studio master audio (/radio-flac). Uses considerably more data.',
    icon: 'waveform',
  },
];

const QUALITY_LABELS: Record<StreamQuality, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  flac: 'FLAC',
};

const StreamSettingsScreen = () => {
  const navigation = useNavigation<any>();
  const {preferences, setPreferences, isLoading} = useStreamPreferences();
  const [network, setNetwork] = useState<StreamNetworkSnapshot>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(next => {
      setNetwork(next as StreamNetworkSnapshot);
    });
    return unsubscribe;
  }, []);

  const automaticQuality = useMemo(
    () => automaticQualityForNetwork(network),
    [network],
  );

  const networkLabel =
    network.type === 'cellular'
      ? 'Mobile data'
      : network.type === 'wifi'
        ? 'Wi-Fi'
        : network.type === 'ethernet'
          ? 'Ethernet'
          : network.isConnected === false
            ? 'Offline'
            : 'Connection';

  const applyToCurrentChannel = async () => {
    const track = await TrackPlayer.getActiveTrack();
    const {state} = await TrackPlayer.getPlaybackState();
    if (
      !track?.id ||
      isPodcastId(String(track.id)) ||
      (state !== State.Playing &&
        state !== State.Buffering &&
        state !== State.Loading)
    ) {
      return;
    }
    await playChannelById(String(track.id));
  };

  const updateQuality = async (quality: StreamQualityPreference) => {
    setIsSaving(true);
    setError('');
    try {
      await setPreferences({...preferences, quality});
      await applyToCurrentChannel();
    } catch {
      setError('Streaming quality could not be applied. Your previous stream remains available.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Back">
          <Icon name="chevron-left" size={30} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.navTitleWrap}>
          <Text style={styles.navTitle}>Streaming</Text>
          <Text style={styles.navSubtitle}>Adaptive audio quality</Text>
        </View>
        <View style={styles.backButton}>
          {isSaving || isLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Icon name="check-circle" size={20} color="#63D69A" />
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Icon
              name={network.type === 'cellular' ? 'signal-4g' : 'wifi'}
              size={22}
              color={COLORS.text}
            />
          </View>
          <View style={styles.statusBody}>
            <Text style={styles.statusEyebrow}>{networkLabel}</Text>
            <Text style={styles.statusTitle}>
              Automatic would use {QUALITY_LABELS[automaticQuality]}
            </Text>
          </View>
          <Text style={styles.savedText}>Saved instantly</Text>
        </View>

        <Text style={styles.sectionTitle}>Audio quality</Text>
        <Text style={styles.sectionDescription}>
          Normal is the default RadioTEDU stream. Existing legacy channel links remain available as automatic fallbacks.
        </Text>

        <View style={styles.optionGroup}>
          {QUALITY_OPTIONS.map(option => {
            const selected = preferences.quality === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => updateQuality(option.value)}
                disabled={isSaving}
                accessibilityRole="radio"
                accessibilityState={{checked: selected}}>
                <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                  <Icon
                    name={option.icon}
                    size={21}
                    color={selected ? '#fff' : COLORS.textMuted}
                  />
                </View>
                <View style={styles.optionBody}>
                  <View style={styles.optionTitleRow}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    {option.value === 'normal' ? (
                      <Text style={styles.recommended}>RECOMMENDED</Text>
                    ) : null}
                  </View>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <Icon
                  name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                  size={22}
                  color={selected ? COLORS.primary : COLORS.textMuted}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {preferences.quality === 'flac' && isCellularNetwork(network) ? (
          <View style={styles.warning}>
            <Icon name="alert-outline" size={22} color="#FFB15C" />
            <Text style={styles.warningText}>
              FLAC is selected on mobile data. RadioTEDU will ask for confirmation before playback.
            </Text>
          </View>
        ) : null}

        <View style={styles.channelNote}>
          <Icon name="translate" size={22} color="#8CB4FF" />
          <Text style={styles.channelNoteText}>
            RadioTEDU English and RadioTEDU Français are separate stations. This quality choice applies to them too.
          </Text>
        </View>

        {error ? (
          <View style={styles.error}>
            <Icon name="alert-circle-outline" size={18} color={COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  navbar: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleWrap: {flex: 1, alignItems: 'center'},
  navTitle: {color: COLORS.text, fontSize: 18, fontWeight: '900'},
  navSubtitle: {color: COLORS.textMuted, fontSize: 11, marginTop: 2},
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 64,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: 18,
    backgroundColor: '#202024',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    marginBottom: SPACING.xl,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(227,30,36,0.16)',
  },
  statusBody: {flex: 1},
  statusEyebrow: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  statusTitle: {color: COLORS.text, fontSize: 14, fontWeight: '800', marginTop: 3},
  savedText: {color: COLORS.textMuted, fontSize: 10, fontWeight: '700'},
  sectionTitle: {color: COLORS.text, fontSize: 22, fontWeight: '900'},
  sectionDescription: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: SPACING.md,
  },
  optionGroup: {gap: 10},
  option: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  optionSelected: {
    borderColor: 'rgba(227,30,36,0.62)',
    backgroundColor: 'rgba(227,30,36,0.09)',
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  optionIconSelected: {backgroundColor: COLORS.primary},
  optionBody: {flex: 1},
  optionTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  optionTitle: {color: COLORS.text, fontSize: 15, fontWeight: '800'},
  optionDescription: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  recommended: {
    color: '#79DFA8',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 14,
    backgroundColor: 'rgba(255,159,67,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,159,67,0.34)',
  },
  warningText: {flex: 1, color: '#FFD2A4', fontSize: 12, lineHeight: 18},
  channelNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 14,
    backgroundColor: 'rgba(53,120,229,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(53,120,229,0.34)',
  },
  channelNoteText: {flex: 1, color: '#BFD4FF', fontSize: 12, lineHeight: 18},
  error: {
    flexDirection: 'row',
    gap: 8,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    borderRadius: 12,
    backgroundColor: 'rgba(255,59,48,0.10)',
  },
  errorText: {flex: 1, color: COLORS.error, fontSize: 12, lineHeight: 17},
});

export default StreamSettingsScreen;
