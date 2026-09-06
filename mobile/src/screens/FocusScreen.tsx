import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {useActiveTrack} from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {COLORS, SPACING} from '../theme/theme';
import {playChannelById} from '../services/playbackQueue';
import {
  isPipSupported,
  isPipAllowed,
  requestPipPermission,
  enterPictureInPicture,
} from '../services/pipService';

type Phase = 'work' | 'shortBreak' | 'longBreak';

const DURATIONS: Record<Phase, number> = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};
const SESSIONS_BEFORE_LONG_BREAK = 4;
const TASKS_KEY = '@radiotedu/focus_tasks';

// Ambient channels offered for focusing (ids from RADIO_CHANNELS).
const AMBIENT = [
  {id: 'radiotedu-jazz', labelKey: 'focus.jazz', icon: 'saxophone'},
  {id: 'radiotedu-classic', labelKey: 'focus.classic', icon: 'music-clef-treble'},
  {id: 'radiotedu-lofi', labelKey: 'focus.lofi', icon: 'headphones'},
];

type Task = {id: string; text: string; done: boolean};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const FocusScreen = ({navigation}: any) => {
  const {t} = useTranslation();
  const activeTrack = useActiveTrack();

  // --- Pomodoro ---
  const [phase, setPhase] = useState<Phase>('work');
  const [secondsLeft, setSecondsLeft] = useState(DURATIONS.work);
  const [isRunning, setIsRunning] = useState(false);
  const [completedWork, setCompletedWork] = useState(0);
  const [pipModalVisible, setPipModalVisible] = useState(false);
  const [miniHudVisible, setMiniHudVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePipClick = useCallback(async () => {
    const supported = await isPipSupported();
    if (!supported) {
      setMiniHudVisible(prev => !prev);
      return;
    }
    const allowed = await isPipAllowed();
    if (!allowed) {
      setPipModalVisible(true);
      return;
    }
    const entered = await enterPictureInPicture(16, 9);
    if (!entered) {
      setMiniHudVisible(prev => !prev);
    }
  }, []);

  const goToPhase = useCallback((next: Phase) => {
    setPhase(next);
    setSecondsLeft(DURATIONS[next]);
  }, []);

  const advancePhase = useCallback(() => {
    Vibration.vibrate(400);
    if (phase === 'work') {
      const done = completedWork + 1;
      setCompletedWork(done);
      goToPhase(
        done % SESSIONS_BEFORE_LONG_BREAK === 0 ? 'longBreak' : 'shortBreak',
      );
    } else {
      goToPhase('work');
    }
  }, [phase, completedWork, goToPhase]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  // When the countdown hits zero, move to the next phase.
  useEffect(() => {
    if (secondsLeft === 0 && isRunning) {
      advancePhase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const toggleRun = () => setIsRunning(r => !r);
  const reset = () => {
    setIsRunning(false);
    goToPhase(phase);
  };
  const skip = () => {
    setIsRunning(false);
    advancePhase();
  };

  // --- Tasks ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(TASKS_KEY)
      .then(raw => {
        if (raw) {
          setTasks(JSON.parse(raw));
        }
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((next: Task[]) => {
    setTasks(next);
    AsyncStorage.setItem(TASKS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const addTask = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    persist([{id: `${secondsLeft}-${tasks.length}-${text}`, text, done: false}, ...tasks]);
    setDraft('');
  };
  const toggleTask = (id: string) =>
    persist(tasks.map(x => (x.id === id ? {...x, done: !x.done} : x)));
  const removeTask = (id: string) => persist(tasks.filter(x => x.id !== id));

  // --- Ambient ---
  const playAmbient = (id: string) =>
    playChannelById(id).catch(() => {});

  const phaseColor = phase === 'work' ? COLORS.primary : '#1DB954';
  const totalRounds = SESSIONS_BEFORE_LONG_BREAK;
  const currentRound = (completedWork % SESSIONS_BEFORE_LONG_BREAK) + 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
          <Icon name="arrow-left" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{t('focus.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('focus.subtitle')}</Text>
        </View>
        <View style={{width: 26}} />
      </View>

      <FlatList
        data={tasks}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {/* PiP Mini HUD Mode */}
            {miniHudVisible ? (
              <View style={[styles.miniHud, {borderColor: phaseColor}]}>
                <View style={styles.miniHudHeader}>
                  <View style={styles.miniHudBadge}>
                    <View style={[styles.miniHudDot, {backgroundColor: phaseColor}]} />
                    <Text style={[styles.miniHudBadgeText, {color: phaseColor}]}>
                      {t(`focus.${phase}`).toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setMiniHudVisible(false)}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                    accessibilityRole="button"
                    accessibilityLabel="Tam Ekran">
                    <Icon name="fullscreen" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.miniHudTimer, {color: phaseColor}]}>
                  {formatTime(secondsLeft)}
                </Text>
                <View style={styles.miniHudControls}>
                  <TouchableOpacity onPress={reset} style={styles.miniHudSmallBtn}>
                    <Icon name="restart" size={18} color={COLORS.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={toggleRun}
                    style={[styles.miniHudPlayBtn, {backgroundColor: phaseColor}]}>
                    <Icon name={isRunning ? 'pause' : 'play'} size={22} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={skip} style={styles.miniHudSmallBtn}>
                    <Icon name="skip-next" size={18} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Pomodoro timer */}
            <View style={[styles.timerCard, {borderColor: phaseColor}]}>
              <Text style={[styles.phaseLabel, {color: phaseColor}]}>
                {t(`focus.${phase}`)}
              </Text>
              <Text style={styles.timer}>{formatTime(secondsLeft)}</Text>
              <Text style={styles.round}>
                {t('focus.round', {current: currentRound, total: totalRounds})}
              </Text>
              <View style={styles.controls}>
                <TouchableOpacity onPress={reset} style={styles.secondaryBtn}>
                  <Icon name="restart" size={22} color={COLORS.text} />
                  <Text style={styles.secondaryBtnText}>{t('focus.reset')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleRun}
                  style={[styles.primaryBtn, {backgroundColor: phaseColor}]}>
                  <Icon
                    name={isRunning ? 'pause' : 'play'}
                    size={26}
                    color="#fff"
                  />
                  <Text style={styles.primaryBtnText}>
                    {isRunning ? t('focus.pause') : t('focus.start')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={skip} style={styles.secondaryBtn}>
                  <Icon name="skip-next" size={22} color={COLORS.text} />
                  <Text style={styles.secondaryBtnText}>{t('focus.skip')}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.pipBtn}
                onPress={handlePipClick}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Picture-in-Picture Modu">
                <Icon
                  name="picture-in-picture-bottom-right"
                  size={18}
                  color={phaseColor}
                  style={{marginRight: 6}}
                />
                <Text style={[styles.pipBtnText, {color: phaseColor}]}>
                  {miniHudVisible ? 'Tam Ekran Görünümüne Dön' : 'Picture-in-Picture (PiP) Modu'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Ambient sounds */}
            <Text style={styles.sectionTitle}>{t('focus.ambient')}</Text>
            <View style={styles.ambientRow}>
              {AMBIENT.map(a => {
                const active = activeTrack?.id === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => playAmbient(a.id)}
                    style={[styles.ambientBtn, active && styles.ambientBtnActive]}>
                    <Icon
                      name={active ? 'pause-circle' : a.icon}
                      size={26}
                      color={active ? COLORS.primary : COLORS.text}
                    />
                    <Text
                      style={[
                        styles.ambientLabel,
                        active && {color: COLORS.primary},
                      ]}>
                      {t(a.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tasks header + input */}
            <Text style={styles.sectionTitle}>{t('focus.tasks')}</Text>
            <View style={styles.taskInputRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('focus.addTaskPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                style={styles.taskInput}
                onSubmitEditing={addTask}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={addTask} style={styles.addBtn}>
                <Icon name="plus" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        }
        renderItem={({item}) => (
          <View style={styles.taskRow}>
            <TouchableOpacity
              onPress={() => toggleTask(item.id)}
              style={styles.taskCheck}>
              <Icon
                name={item.done ? 'check-circle' : 'circle-outline'}
                size={24}
                color={item.done ? '#1DB954' : COLORS.textMuted}
              />
              <Text style={[styles.taskText, item.done && styles.taskTextDone]}>
                {item.text}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeTask(item.id)}>
              <Icon name="trash-can-outline" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('focus.noTasks')}</Text>
        }
      />

      {/* Picture-in-Picture Permission Modal */}
      <Modal
        visible={pipModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPipModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconWrap, {backgroundColor: `${COLORS.primary}20`}]}>
              <Icon name="picture-in-picture-bottom-right" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>Picture-in-Picture (PiP) İzni</Text>
            <Text style={styles.modalDesc}>
              RadioTEDU Odak Sayacı'nı diğer uygulamaların üzerinde küçük bir pencere olarak kullanabilmek için PiP izni gerekiyor. Ayarlardan izin vermek istiyor musunuz?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPipModalVisible(false)}
                activeOpacity={0.7}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={async () => {
                  setPipModalVisible(false);
                  await requestPipPermission();
                }}
                activeOpacity={0.85}>
                <Text style={styles.modalConfirmText}>İzin Ver (Ayarları Aç)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerTitle: {color: COLORS.text, fontSize: 18, fontWeight: 'bold', textAlign: 'center'},
  headerSubtitle: {color: COLORS.textMuted, fontSize: 12, textAlign: 'center'},
  list: {padding: SPACING.md, paddingBottom: 100},
  timerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 2,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  phaseLabel: {fontSize: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase'},
  timer: {color: COLORS.text, fontSize: 64, fontWeight: '800', marginVertical: SPACING.sm},
  round: {color: COLORS.textMuted, fontSize: 13, marginBottom: SPACING.md},
  controls: {flexDirection: 'row', alignItems: 'center', gap: SPACING.md},
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: 30,
  },
  primaryBtnText: {color: '#fff', fontSize: 16, fontWeight: '700'},
  secondaryBtn: {alignItems: 'center', gap: 2},
  secondaryBtnText: {color: COLORS.text, fontSize: 11},
  sectionTitle: {color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: SPACING.sm},
  ambientRow: {flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg},
  ambientBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  ambientBtnActive: {borderColor: COLORS.primary},
  ambientLabel: {color: COLORS.text, fontSize: 13, fontWeight: '600'},
  taskInputRow: {flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md},
  taskInput: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    height: 48,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    marginBottom: SPACING.sm,
  },
  taskCheck: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1},
  taskText: {color: COLORS.text, fontSize: 15, flex: 1},
  taskTextDone: {textDecorationLine: 'line-through', color: COLORS.textMuted},
  empty: {color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.md},
  pipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pipBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  miniHud: {
    backgroundColor: '#12161A',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1.5,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  miniHudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  miniHudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniHudDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  miniHudBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  miniHudTimer: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1,
  },
  miniHudControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
  },
  miniHudSmallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniHudPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#181C20',
    borderRadius: 20,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDesc: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  modalCancelText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default FocusScreen;
