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

import {useGamePreferences} from '../../services/gamePreferences';
import {GameHaptics} from './gameHaptics';
import {readGameHistory, recordGameHistory, GameHistoryEntry} from '../../services/gameHistory';
import {arcadeOptions} from '../../i18n/arcadeOptions';

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
  sidebarContent?: React.ReactNode;
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
  sidebarContent,
}: GameShellProps) {
  const {i18n} = useTranslation();
  const copy = (key: string) => appCopy(i18n.language, key);
  const progressCopy = discoveryCopy(i18n.language);
  const {best} = useDeviceBest();
  const preferences = useGamePreferences();
  const animate = !preferences.reducedMotion && preferences.effects !== 'calm';
  const scoreScale = useRef(new Animated.Value(1)).current;
  const ambientAnim = useRef(new Animated.Value(0.08)).current;
  const prevScoreRef = useRef(score);

  useEffect(() => {
    if (animate && score > prevScoreRef.current) {
      Animated.sequence([
        Animated.timing(scoreScale, {toValue: 1.15, duration: 80, useNativeDriver: true}),
        Animated.spring(scoreScale, {toValue: 1, friction: 5, tension: 120, useNativeDriver: true}),
      ]).start();
    }
    prevScoreRef.current = score;
  }, [score, scoreScale, animate]);

  useEffect(() => {
    if (!animate || preferences.effects !== 'lively') {ambientAnim.setValue(0); return;}
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientAnim, {toValue: 0.15, duration: 2200, useNativeDriver: true}),
        Animated.timing(ambientAnim, {toValue: 0.07, duration: 2200, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ambientAnim, animate, preferences.effects]);

  const handleBack = () => {
    GameHaptics.tap();
    onBack();
  };

  const chrome = (<>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
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
          <Animated.Text style={[styles.scoreValue, {color: accentColor, transform: [{scale: scoreScale}]}]}>
            {score}
          </Animated.Text>
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

  </>);
  return (
    <View style={[styles.shell, sidebarContent ? styles.horizontalShell : null]}>
      <Animated.View pointerEvents="none" style={[styles.ambientOrb, {backgroundColor: accentColor, opacity: ambientAnim}]} />
      <View pointerEvents="none" style={[styles.ambientOrbSmall, {borderColor: accentColor}]} />
      {sidebarContent ? (
        <ScrollView style={styles.sidebar} contentContainerStyle={styles.sidebarContent}>
          {chrome}
          {sidebarContent}
        </ScrollView>
      ) : chrome}
      {sidebarContent ? <View style={styles.gameContent}>{children}</View> : children}
    </View>
  );
}

export function ComboMeter({label, value}: {label: string; value: number}) {
  const scale = useRef(new Animated.Value(1)).current;
  const preferences = useGamePreferences();

  useEffect(() => {
    if (preferences.reducedMotion || preferences.effects === 'calm') {
      scale.stopAnimation(); scale.setValue(1); return;
    }
    Animated.sequence([
      Animated.timing(scale, {toValue: value >= 3 ? 1.18 : 1.08, duration: 100, useNativeDriver: true}),
      Animated.spring(scale, {toValue: 1, friction: 4, tension: 120, useNativeDriver: true}),
    ]).start();
  }, [scale, value, preferences.reducedMotion, preferences.effects]);

  return (
    <Animated.View style={[styles.comboMeter, {transform: [{scale}]}, value >= 3 && styles.comboMeterHot]}>
      <View style={styles.comboHeader}>
        {value >= 2 ? <Icon name="fire" size={13} color="#FF9800" style={{marginRight: 4}} /> : null}
        <Text style={[styles.comboLabel, value >= 3 && styles.comboLabelHot]}>{label}</Text>
      </View>
      <Text style={[styles.comboValue, value >= 3 && styles.comboValueHot]}>x{value}</Text>
    </Animated.View>
  );
}

export function FeedbackToast({text}: {text?: string | null}) {
  const preferences = useGamePreferences();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (!text) {
      opacity.setValue(0);
      return;
    }

    if (preferences.reducedMotion || preferences.effects === 'calm') {
      opacity.stopAnimation(); translateY.stopAnimation();
      translateY.setValue(0); opacity.setValue(1);
      const timer = setTimeout(() => opacity.setValue(0), 1000);
      return () => clearTimeout(timer);
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
  }, [opacity, text, translateY, preferences.reducedMotion, preferences.effects]);

  if (!text) {
    return null;
  }

  return (
    <Animated.View style={[styles.feedbackToast, {opacity, transform: [{translateY}]}]}>
      <Icon name="star-four-points" size={13} color="#FFD54A" style={{marginRight: 6}} />
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
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const historyId = useRef<string>();
  useEffect(() => {
    if (!visible) {historyId.current = undefined; return;}
    if (isSubmitting || submitFailed || practice) {return;}
    const id = historyId.current || `${name}-${Date.now()}`;
    historyId.current = id;
    let active = true;
    recordGameHistory({id, game: name, score: Math.max(0, Math.floor(score)),
      gold: Math.max(0, Math.floor(awardedXp)), at: Date.now()})
      .then(readGameHistory).then(entries => {if (active) {setHistory(entries.filter(entry => entry.game === name).slice(0, 3));}});
    return () => {active = false;};
  }, [visible, isSubmitting, submitFailed, practice, name, score, awardedXp]);
  useEffect(() => {
    let active = true;
    if (!visible) {
      setNewBest(false);
      return;
    }
    recordLocalBest(name, score).then(improved => {
      if (active) {
        setNewBest(improved);
        if (improved) {
          GameHaptics.success();
        }
      }
    });
    return () => { active = false; };
  }, [name, score, visible]);

  const handleRestart = () => {
    GameHaptics.tap();
    onRestart();
  };

  const handleExit = () => {
    GameHaptics.tap();
    onExit();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleExit}>
      <ScrollView contentContainerStyle={styles.modalOverlay}>
        <View style={styles.resultCard}>
          <View style={[styles.resultIcon, newBest && styles.resultIconNewBest]}>
            <Icon name={practice ? 'controller-classic' : submitFailed ? 'wifi-alert' : newBest ? 'trophy' : 'trophy-award'} size={38} color={newBest ? '#F4C542' : COLORS.primary} />
          </View>
          <Text style={styles.resultTitle}>{title || copy('games.roundFinished')}</Text>
          {history.length > 0 && <View style={styles.recordCard}>
            <Text style={styles.recordTitle}>{arcadeOptions(i18n.language)[11]}</Text>
            {history.map(entry => <Text key={entry.id} style={styles.personalBest}>
              {new Date(entry.at).toLocaleDateString(i18n.language)} · {entry.score} · +{entry.gold} Gold
            </Text>)}
          </View>}
          <Text style={styles.resultScore}>
            {practice
              ? `${copy('games.score')} ${Math.max(0, Math.floor(score))}`
              : getGameResultMessage(score, awardedXp, copy('games.score'))}
          </Text>
          {best > 0 ? (
            <View style={[styles.recordCard, newBest && styles.newRecordCard]} accessibilityLiveRegion="polite">
              <View style={styles.recordHeader}>
                {newBest ? <Icon name="star-shooting" size={16} color="#F4C542" style={{marginRight: 6}} /> : null}
                <Text style={[styles.recordTitle, newBest && styles.newRecordTitle]}>
                  {newBest ? progressCopy.newBest : progressCopy.best}
                </Text>
              </View>
              <Text style={[styles.recordValue, newBest && styles.newRecordValue]}>{best}</Text>
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
            <TouchableOpacity accessibilityRole="button" style={[styles.primaryButton, styles.retryButton]} onPress={() => { GameHaptics.tap(); onRetrySubmit(); }}>
              <Text style={styles.primaryButtonText}>{copy('games.retrySubmit')}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.resultActions}>
            <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={handleExit}>
              <Text style={styles.secondaryButtonText}>{copy('games.exit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={handleRestart}>
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
  newRecordCard: {backgroundColor: 'rgba(244,197,66,0.12)', borderWidth: 1, borderColor: 'rgba(244,197,66,0.40)'},
  recordHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  recordTitle: {color: COLORS.text, fontSize: 14, textAlign: 'center'},
  newRecordTitle: {color: '#F4C542', fontWeight: '900', letterSpacing: 0.5},
  recordValue: {color: '#F4C542', fontSize: 28, fontWeight: '900', marginTop: 4},
  newRecordValue: {color: '#FFD700', fontSize: 32},
  resultIconNewBest: {backgroundColor: 'rgba(244,197,66,0.16)'},
  retryButton: {flex: 0, alignSelf: 'stretch'},
  horizontalShell: {flexDirection: 'row', gap: SPACING.md},
  sidebar: {width: '32%', flexGrow: 0},
  sidebarContent: {paddingBottom: SPACING.sm},
  gameContent: {flex: 1, minWidth: 0},
  shell: {
    flex: 1,
    backgroundColor: '#101318',
    paddingHorizontal: SPACING.lg,
    overflow: 'hidden',
  },
  ambientOrb: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
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
    borderRadius: 18,
    backgroundColor: '#1A2029',
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
    fontSize: 36,
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
  comboMeterHot: {
    backgroundColor: 'rgba(255,107,0,0.18)',
    borderColor: 'rgba(255,107,0,0.55)',
    shadowColor: '#FF6B00',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  comboHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  comboLabelHot: {
    color: '#FFB27D',
  },
  comboValue: {
    color: '#F4C542',
    fontSize: 18,
    fontWeight: '900',
  },
  comboValueHot: {
    color: '#FF7A00',
    fontSize: 20,
  },
  feedbackToast: {
    alignSelf: 'center',
    position: 'absolute',
    top: 138,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
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
