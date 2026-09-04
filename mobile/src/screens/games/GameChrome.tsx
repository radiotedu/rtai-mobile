import React, {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {COLORS, SPACING} from '../../theme/theme';
import {getGameResultMessage} from './gameSession';
import {useTranslation} from 'react-i18next';
import {appCopy} from '../../i18n/appCopy';
import {screenCopy} from '../../i18n/screenCopy';
import {useRoute} from '@react-navigation/native';
import {discoveryCopy} from '../../i18n/discoveryCopy';
import {getLocalBest, loadLocalBest, recordLocalBest, subscribeToLocalBests} from '../../services/localGameBests';

function useDeviceBest() {
  const {name} = useRoute();
  const best = useSyncExternalStore(subscribeToLocalBests, () => getLocalBest(name));
  useEffect(() => { loadLocalBest(name); }, [name]);
  return {name, best};
}

interface GameShellProps {
  title: string;
  subtitle?: string;
  icon?: string;
  accentColor?: string;
  score: number;
  progressLabel?: string;
  rightLabel?: string;
  onBack: () => void;
  children: React.ReactNode;
}

export function GameShell({
  title,
  subtitle,
  icon = 'controller-classic',
  accentColor = COLORS.primary,
  score,
  progressLabel,
  rightLabel,
  onBack,
  children,
}: GameShellProps) {
  const {i18n} = useTranslation();
  const copy = (key: string) => appCopy(i18n.language, key);
  const progressCopy = discoveryCopy(i18n.language);
  const {best} = useDeviceBest();
  return (
    <View style={styles.shell}>
      <View pointerEvents="none" style={[styles.ambientOrb, {backgroundColor: accentColor}]} />
      <View pointerEvents="none" style={[styles.ambientOrbSmall, {borderColor: accentColor}]} />
      <View style={styles.navbar}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Icon name="chevron-left" size={30} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <View style={[styles.titleIcon, {backgroundColor: `${accentColor}22`, borderColor: `${accentColor}66`}]}>
              <Icon name={icon} size={19} color={accentColor} />
            </View>
            <Text style={styles.navbarTitle}>{title}</Text>
          </View>
          {subtitle ? <Text style={styles.navbarSubtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.navbarSpacer} />
      </View>

      <View style={[styles.scoreCard, {borderColor: `${accentColor}66`}]}>
        <View pointerEvents="none" style={[styles.scoreGlow, {backgroundColor: `${accentColor}18`}]} />
        <View>
          <Text style={styles.scoreLabel}>{copy('games.score')}</Text>
          <Text style={[styles.scoreValue, {color: accentColor}]}>{score}</Text>
        </View>
        <View style={styles.scoreMeta}>
          {progressLabel ? <Text style={[styles.progressLabel, {borderColor: `${accentColor}55`}]}>{progressLabel}</Text> : null}
          {rightLabel ? <Text style={styles.rightLabel}>{rightLabel}</Text> : null}
        </View>
      </View>

      <Text style={styles.personalBest}>
        {best > 0 ? `${progressCopy.best}: ${best}` : progressCopy.firstRound}
      </Text>
      {best > 0 ? (
        <View style={styles.goalTrack} accessibilityRole="progressbar" accessibilityLabel={progressCopy.target} accessibilityValue={{min: 0, max: best, now: Math.min(Math.max(score, 0), best)}}>
          <View style={[styles.goalFill, {backgroundColor: accentColor, width: `${Math.min(100, Math.max(0, score / best * 100))}%`}]} />
        </View>
      ) : null}

      {children}
    </View>
  );
}

export function ComboMeter({label, value}: {label: string; value: number}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, {toValue: 1.08, duration: 120, useNativeDriver: true}),
      Animated.timing(scale, {toValue: 1, duration: 140, useNativeDriver: true}),
    ]).start();
  }, [scale, value]);

  return (
    <Animated.View style={[styles.comboMeter, {transform: [{scale}]}]}>
      <Text style={styles.comboLabel}>{label}</Text>
      <Text style={styles.comboValue}>x{value}</Text>
    </Animated.View>
  );
}

export function FeedbackToast({text}: {text?: string | null}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (!text) {
      opacity.setValue(0);
      return;
    }

    translateY.setValue(10);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {toValue: 1, duration: 120, useNativeDriver: true}),
        Animated.timing(translateY, {toValue: 0, duration: 120, useNativeDriver: true}),
      ]),
      Animated.delay(680),
      Animated.timing(opacity, {toValue: 0, duration: 180, useNativeDriver: true}),
    ]).start();
  }, [opacity, text, translateY]);

  if (!text) {
    return null;
  }

  return (
    <Animated.View style={[styles.feedbackToast, {opacity, transform: [{translateY}]}]}>
      <Text style={styles.feedbackText}>{text}</Text>
    </Animated.View>
  );
}

export function GameResultModal({
  visible,
  title,
  score,
  awardedXp,
  isSubmitting,
  submitFailed,
  practice,
  onRetrySubmit,
  onRestart,
  onExit,
}: {
  visible: boolean;
  title?: string;
  score: number;
  awardedXp: number;
  isSubmitting?: boolean;
  submitFailed?: boolean;
  practice?: boolean;
  onRetrySubmit?: () => void;
  onRestart: () => void;
  onExit: () => void;
}) {
  const {i18n} = useTranslation();
  const copy = (key: string) => appCopy(i18n.language, key);
  const catalogCopy = (key: string) => screenCopy(i18n.language, key);
  const progressCopy = discoveryCopy(i18n.language);
  const {name, best} = useDeviceBest();
  const [newBest, setNewBest] = useState(false);
  useEffect(() => {
    let active = true;
    if (!visible) {
      setNewBest(false);
      return;
    }
    recordLocalBest(name, score).then(improved => {
      if (active) { setNewBest(improved); }
    });
    return () => { active = false; };
  }, [name, score, visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onExit}>
      <ScrollView contentContainerStyle={styles.modalOverlay}>
        <View style={styles.resultCard}>
          <View style={styles.resultIcon}>
            <Icon name={practice ? 'controller-classic' : submitFailed ? 'wifi-alert' : 'trophy-award'} size={38} color={COLORS.primary} />
          </View>
          <Text style={styles.resultTitle}>{title || copy('games.roundFinished')}</Text>
          <Text style={styles.resultScore}>
            {practice
              ? `${copy('games.score')} ${Math.max(0, Math.floor(score))}`
              : getGameResultMessage(score, awardedXp, copy('games.score'))}
          </Text>
          {best > 0 ? (
            <View style={styles.recordCard} accessibilityLiveRegion="polite">
              <Text style={styles.recordTitle}>{newBest ? progressCopy.newBest : progressCopy.best}</Text>
              <Text style={styles.recordValue}>{best}</Text>
            </View>
          ) : null}
          <Text style={styles.resultSubtitle}>
            {practice
              ? catalogCopy('games.practiceNoRewards')
              : isSubmitting
              ? copy('games.submitting')
              : submitFailed
                ? copy('games.submitFailed')
                : copy('games.saved')}
          </Text>

          {!practice && submitFailed && onRetrySubmit ? (
            <TouchableOpacity accessibilityRole="button" style={[styles.primaryButton, styles.retryButton]} onPress={onRetrySubmit}>
              <Text style={styles.primaryButtonText}>{copy('games.retrySubmit')}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.resultActions}>
            <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={onExit}>
              <Text style={styles.secondaryButtonText}>{copy('games.exit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={onRestart}>
              <Text style={styles.primaryButtonText}>{copy('games.restart')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  personalBest: {color: COLORS.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: SPACING.sm},
  goalTrack: {height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginTop: 6, overflow: 'hidden'},
  goalFill: {height: 4, borderRadius: 2},
  recordCard: {alignItems: 'center', width: '100%', padding: SPACING.md, marginTop: SPACING.md, borderRadius: 14, backgroundColor: COLORS.surface},
  recordTitle: {color: COLORS.text, fontSize: 14, textAlign: 'center'},
  recordValue: {color: '#F4C542', fontSize: 28, fontWeight: '900', marginTop: 4},
  retryButton: {flex: 0, alignSelf: 'stretch'},
  shell: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    overflow: 'hidden',
  },
  ambientOrb: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.08,
    right: -120,
    top: 100,
  },
  ambientOrbSmall: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 18,
    opacity: 0.08,
    left: -55,
    bottom: 70,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerText: {
    alignItems: 'center',
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  navbarTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
  },
  navbarSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  navbarSpacer: {
    width: 44,
  },
  scoreCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 24,
    backgroundColor: '#171719',
    borderWidth: 1,
    overflow: 'hidden',
  },
  scoreGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    left: -65,
    top: -88,
  },
  scoreLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  scoreValue: {
    color: COLORS.primary,
    fontSize: 42,
    fontWeight: '900',
  },
  scoreMeta: {
    alignItems: 'flex-end',
  },
  progressLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  rightLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  comboMeter: {
    alignSelf: 'center',
    minWidth: 104,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
    backgroundColor: 'rgba(244,197,66,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244,197,66,0.45)',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  comboLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  comboValue: {
    color: '#F4C542',
    fontSize: 18,
    fontWeight: '900',
  },
  feedbackToast: {
    alignSelf: 'center',
    position: 'absolute',
    top: 138,
    zIndex: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  feedbackText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  modalOverlay: {
    flexGrow: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  resultCard: {
    borderRadius: 30,
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'rgba(227,30,36,0.3)',
    alignItems: 'center',
  },
  resultIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(227,30,36,0.12)',
    marginBottom: SPACING.md,
  },
  resultTitle: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
  },
  resultScore: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '900',
    marginTop: SPACING.sm,
  },
  resultSubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  resultActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
    marginTop: SPACING.lg,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    padding: SPACING.sm,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginTop: SPACING.md,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    padding: SPACING.sm,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.md,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
});
