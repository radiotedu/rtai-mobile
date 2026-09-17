import React, {useEffect, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useTranslation} from 'react-i18next';
import {COLORS, SPACING} from '../theme/theme';
import {
  MoodProfile,
  activateMood,
  clearActiveMood,
  getAvailableMoodProfiles,
  subscribeToMoodChanges,
} from '../services/moodEngineService';

interface MoodFlowShelfProps {
  onMoodSelected?: (mood: MoodProfile) => void;
}

export const MoodFlowShelf: React.FC<MoodFlowShelfProps> = ({onMoodSelected}) => {
  const {t} = useTranslation();
  const [activeMood, setActiveMood] = useState<MoodProfile | null>(null);
  const profiles = getAvailableMoodProfiles();

  useEffect(() => {
    const unsubscribe = subscribeToMoodChanges(mood => {
      setActiveMood(mood);
    });
    return () => unsubscribe();
  }, []);

  const handlePress = async (profile: MoodProfile) => {
    if (activeMood?.id === profile.id) {
      clearActiveMood();
    } else {
      const activated = await activateMood(profile.id);
      if (activated && onMoodSelected) {
        onMoodSelected(activated);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Icon name="waveform" size={18} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>
            {t('moods.sectionTitle', {defaultValue: 'Akıllı Ruh Hali Akışı'})}
          </Text>
        </View>
        {activeMood && (
          <TouchableOpacity
            onPress={clearActiveMood}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            accessibilityRole="button"
            accessibilityLabel={t('moods.clear', {defaultValue: 'Temizle'})}
            testID="mood-clear-button">
            <Text style={styles.clearText}>
              {t('moods.clear', {defaultValue: 'Temizle'})}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID="mood-flow-scroll">
        {profiles.map(profile => {
          const isActive = activeMood?.id === profile.id;
          const localizedTitle = t(profile.titleKey, {
            defaultValue: profile.defaultTitle,
          });

          return (
            <TouchableOpacity
              key={profile.id}
              style={[
                styles.moodCard,
                isActive && {
                  borderColor: profile.accentColor,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                },
              ]}
              onPress={() => handlePress(profile)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${localizedTitle} modu`}
              testID={`mood-card-${profile.id}`}>
              <View
                style={[
                  styles.iconWrap,
                  {backgroundColor: isActive ? profile.accentColor : 'rgba(255,255,255,0.06)'},
                ]}>
                <Icon
                  name={profile.icon}
                  size={20}
                  color={isActive ? '#000' : '#fff'}
                />
              </View>
              <Text
                style={[
                  styles.moodTitle,
                  isActive && {color: profile.accentColor, fontWeight: '700'},
                ]}
                numberOfLines={1}>
                {localizedTitle}
              </Text>
              <Text style={styles.durationBadge}>
                {profile.suggestedDurationMinutes} {t('common.minuteAbbrev', {defaultValue: 'dk'})}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  clearText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    gap: 10,
    paddingVertical: 4,
  },
  moodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12151b',
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodTitle: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  durationBadge: {
    fontSize: 11,
    color: COLORS.textMuted,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
});

export default MoodFlowShelf;
