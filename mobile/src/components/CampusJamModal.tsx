import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useTranslation} from 'react-i18next';
import {COLORS, SPACING} from '../theme/theme';
import {
  CampusJamRoom,
  JamReaction,
  POPULAR_JAM_EMOJIS,
  createJamRoom,
  getActiveJamRoom,
  joinJamRoom,
  leaveJamRoom,
  sendJamReaction,
  subscribeToJamReactions,
  subscribeToJamRoom,
} from '../services/campusJamService';
import {logSafeError} from '../utils/safeLog';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

interface FloatingEmoji {
  id: string;
  emoji: string;
  animY: Animated.Value;
  animX: Animated.Value;
  animScale: Animated.Value;
  animOpacity: Animated.Value;
  leftOffset: number;
}

interface CampusJamModalProps {
  visible: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
}

export const CampusJamModal: React.FC<CampusJamModalProps> = ({
  visible,
  onClose,
  channelId,
  channelName,
}) => {
  const {t} = useTranslation();
  const [activeRoom, setActiveRoom] = useState<CampusJamRoom | null>(getActiveJamRoom());
  const [selectedTab, setSelectedTab] = useState<'create' | 'join'>('create');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);
  const toastTimeoutRef = useRef<any>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

  // Animation values for Spotify-style glow and visualizer
  const auraScale = useRef(new Animated.Value(1)).current;
  const auraOpacity = useRef(new Animated.Value(0.35)).current;

  // Equalizer bar scales
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.6)).current;
  const bar3 = useRef(new Animated.Value(0.9)).current;
  const bar4 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const unsubRoom = subscribeToJamRoom(room => {
      setActiveRoom(room);
    });

    const unsubRx = subscribeToJamReactions(rx => {
      spawnFloatingEmoji(rx.emoji);
    });

    if (process.env.NODE_ENV === 'test') {
      return () => {
        unsubRoom();
        unsubRx();
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
        }
      };
    }

    // Start pulsing aura loop
    const auraLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(auraScale, {
            toValue: 1.25,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(auraOpacity, {
            toValue: 0.75,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(auraScale, {
            toValue: 1.0,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(auraOpacity, {
            toValue: 0.35,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    auraLoop.start();

    // Start equalizer bars loop
    const animateBar = (anim: Animated.Value, min: number, max: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {toValue: max, duration, useNativeDriver: true}),
          Animated.timing(anim, {toValue: min, duration: duration * 1.1, useNativeDriver: true}),
        ]),
      );
    };

    const eqLoop = Animated.parallel([
      animateBar(bar1, 0.25, 1.0, 380),
      animateBar(bar2, 0.35, 1.0, 440),
      animateBar(bar3, 0.3, 0.9, 320),
      animateBar(bar4, 0.2, 0.8, 500),
    ]);
    eqLoop.start();

    return () => {
      unsubRoom();
      unsubRx();
      auraLoop.stop();
      eqLoop.stop();
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const spawnFloatingEmoji = (emoji: string) => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    const id = `fl-${Date.now()}-${Math.random()}`;
    const animY = new Animated.Value(0);
    const animX = new Animated.Value(0);
    const animScale = new Animated.Value(0.4);
    const animOpacity = new Animated.Value(1);
    const leftOffset = Math.random() * (SCREEN_WIDTH - 120) + 40;
    const lateralShift = (Math.random() - 0.5) * 60;

    const newEmoji: FloatingEmoji = {
      id,
      emoji,
      animY,
      animX,
      animScale,
      animOpacity,
      leftOffset,
    };

    setFloatingEmojis(prev => [...prev.slice(-15), newEmoji]);

    Animated.parallel([
      Animated.timing(animY, {
        toValue: -220,
        duration: 2000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(animX, {
        toValue: lateralShift,
        duration: 2000,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(animScale, {
          toValue: 1.4,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(animScale, {
          toValue: 1.0,
          duration: 1700,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(1100),
        Animated.timing(animOpacity, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    });
  };

  const handleCreateRoom = async () => {
    setJoinError(null);
    try {
      await createJamRoom(channelId, channelName);
    } catch (err) {
      logSafeError('campusJam.createRoom', err);
    }
  };

  const handleJoinRoom = async () => {
    setJoinError(null);
    if (joinCodeInput.trim().length !== 6) {
      setJoinError('Lütfen 6 haneli geçerli bir oda kodu girin.');
      return;
    }

    try {
      const joined = await joinJamRoom(joinCodeInput, channelId, channelName);
      if (!joined) {
        setJoinError('Oda bulunamadı. Kodu kontrol edin.');
      } else {
        setJoinCodeInput('');
      }
    } catch (err) {
      logSafeError('campusJam.joinRoom', err);
      setJoinError('Odaya bağlanırken hata oluştu.');
    }
  };

  const handleShareInvite = async () => {
    if (!activeRoom) return;
    setCopiedToast(true);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    if (process.env.NODE_ENV !== 'test') {
      toastTimeoutRef.current = setTimeout(() => setCopiedToast(false), 2200);
    }

    try {
      await Share.share({
        message: `RadioTEDU Campus Jam: Gel birlikte ${activeRoom.channelName} dinleyelim! Oda Kodumuz: ${activeRoom.code} 🎧 https://radiotedu.com/jam`,
      });
    } catch (err) {
      logSafeError('campusJam.share', err);
    }
  };

  const handleSendReaction = (emoji: string) => {
    sendJamReaction(emoji);
  };

  const handleLeaveRoom = () => {
    leaveJamRoom();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.container}>
          {/* Spotify Sheet Drag Handle */}
          <View style={styles.dragPill} />

          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerBadgeWrap}>
              <View style={styles.jamLiveDot} />
              <Text style={styles.headerTitle}>SPOTIFY JAM · CAMPUS LOUNGE</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              testID="campus-jam-close-btn">
              <Icon name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Floating Emojis Layer */}
          <View style={styles.floatingLayer} pointerEvents="none">
            {floatingEmojis.map(fe => (
              <Animated.Text
                key={fe.id}
                style={[
                  styles.floatingEmojiText,
                  {
                    left: fe.leftOffset,
                    opacity: fe.animOpacity,
                    transform: [
                      {translateY: fe.animY},
                      {translateX: fe.animX},
                      {scale: fe.animScale},
                    ],
                  },
                ]}>
                {fe.emoji}
              </Animated.Text>
            ))}
          </View>

          {!activeRoom ? (
            /* =========================================================================
               IDLE VIEW (Create or Join Tabs)
               ========================================================================= */
            <View style={styles.idleView}>
              {/* Hero Animation Aura */}
              <View style={styles.heroAuraWrapper}>
                <Animated.View
                  style={[
                    styles.heroAuraCircle,
                    {
                      transform: [{scale: auraScale}],
                      opacity: auraOpacity,
                    },
                  ]}
                />
                <View style={styles.heroCenterIcon}>
                  <Icon name="headphones" size={42} color="#fff" />
                </View>
              </View>

              <Text style={styles.heroTitle}>Birlikte Dinlemeye Başla</Text>
              <Text style={styles.heroSub}>
                Kampüsteki arkadaşlarınla aynı anda aynı radyo akışını canlı dinle, anlık tepkiler paylaş!
              </Text>

              {/* Station Preview Card with Dancing Waves */}
              <View style={styles.stationSyncCard}>
                <View style={styles.stationIconBox}>
                  <Icon name="radio-tower" size={22} color={COLORS.primary} />
                </View>
                <View style={styles.stationCardInfo}>
                  <Text style={styles.stationCardLabel}>ŞU ANKİ İSTASYON</Text>
                  <Text style={styles.stationCardTitle}>{channelName}</Text>
                </View>
                {/* Dancing Equalizer */}
                <View style={styles.equalizerWrap}>
                  <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar1}]}]} />
                  <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar2}]}]} />
                  <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar3}]}]} />
                  <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar4}]}]} />
                </View>
              </View>

              {/* Spotify Create Jam Button */}
              <TouchableOpacity
                style={styles.spotifyCreateBtn}
                onPress={handleCreateRoom}
                accessibilityRole="button"
                accessibilityLabel="Yeni Jam Odası Başlat"
                testID="campus-jam-create-btn">
                <Icon name="play-circle" size={22} color="#fff" />
                <Text style={styles.spotifyCreateBtnText}>
                  Yeni Jam Başlat ({channelName})
                </Text>
              </TouchableOpacity>

              {/* Spotify Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>VEYA BİR KODA KATIL</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* 6-Box Pin Code Display */}
              <View style={styles.pinBoxesRow}>
                {[0, 1, 2, 3, 4, 5].map(idx => {
                  const digit = joinCodeInput[idx] || '';
                  const isFocused = joinCodeInput.length === idx;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.pinBox,
                        isFocused && styles.pinBoxFocused,
                        digit ? styles.pinBoxFilled : null,
                      ]}>
                      <Text style={styles.pinDigit}>{digit}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Hidden / Transparent actual TextInput */}
              <TextInput
                style={styles.hiddenInput}
                placeholder="6 haneli kodu yazın"
                placeholderTextColor="transparent"
                value={joinCodeInput}
                onChangeText={txt => setJoinCodeInput(txt.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                testID="campus-jam-code-input"
              />

              {joinError ? <Text style={styles.errorText}>{joinError}</Text> : null}

              <TouchableOpacity
                style={[
                  styles.spotifyJoinBtn,
                  joinCodeInput.length === 6 && styles.spotifyJoinBtnActive,
                ]}
                onPress={handleJoinRoom}
                accessibilityRole="button"
                accessibilityLabel="Odaya Katıl"
                testID="campus-jam-join-btn">
                <Icon name="arrow-right-circle" size={20} color="#fff" />
                <Text style={styles.spotifyJoinBtnText}>Odaya Katıl</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* =========================================================================
               ACTIVE ROOM VIEW (Spotify Jam Real-Time Session)
               ========================================================================= */
            <View style={styles.activeRoomView}>
              {/* Overlapping Avatar Orbit Cluster */}
              <View style={styles.avatarOrbitSection}>
                <View style={styles.avatarRow}>
                  {activeRoom.listeners.map((listener, idx) => {
                    const initials = listener.name
                      ? listener.name.slice(0, 2).toUpperCase()
                      : 'TD';
                    return (
                      <View
                        key={listener.id || idx}
                        style={[
                          styles.avatarBubble,
                          idx > 0 && {marginLeft: -14},
                          listener.isHost && styles.avatarHostBorder,
                        ]}>
                        <Text style={styles.avatarInitial}>{initials}</Text>
                        {listener.isHost ? (
                          <View style={styles.crownBadge}>
                            <Icon name="crown" size={12} color="#f59e0b" />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                  {/* Plus Invite Avatar */}
                  <TouchableOpacity
                    style={[styles.avatarBubble, styles.avatarPlusBubble, {marginLeft: -14}]}
                    onPress={handleShareInvite}
                    accessibilityRole="button"
                    accessibilityLabel="Arkadaş Davet Et">
                    <Icon name="plus" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Live Count Badge */}
                <View style={styles.activeCountRow}>
                  <View style={styles.activePulseGreen} />
                  <Text style={styles.activeCountText} testID="campus-jam-listener-count">
                    {activeRoom.listeners.length} Dinleyici Canlı Bağlantıda
                  </Text>
                </View>
              </View>

              {/* Spotify Jam Code Hero Card */}
              <View style={styles.codeHeroCard}>
                <Text style={styles.codeCardBadge}>KATILIM KODU</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleShareInvite}
                  style={styles.codeTouchWrap}>
                  <Text style={styles.codeText} testID="campus-jam-room-code">
                    {activeRoom.code}
                  </Text>
                  <Icon name="content-copy" size={18} color={COLORS.primary} />
                </TouchableOpacity>
                {copiedToast ? (
                  <Text style={styles.copiedToastText}>✓ Kod kopyalandı ve paylaşıldı!</Text>
                ) : (
                  <Text style={styles.codeHintText}>Arkadaşların bu kodu girerek odaya katılabilir</Text>
                )}
              </View>

              {/* Station Sync Card */}
              <View style={styles.activeStationCard}>
                <View style={styles.activeStationLeft}>
                  <Icon name="radio" size={20} color={COLORS.primary} />
                  <View>
                    <Text style={styles.activeStationName}>{activeRoom.channelName}</Text>
                    <Text style={styles.activeStationStatus}>Eşzamanlı Çalıyor</Text>
                  </View>
                </View>

                <View style={styles.equalizerWrap}>
                  <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar1}]}]} />
                  <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar2}]}]} />
                  <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar3}]}]} />
                  <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar4}]}]} />
                </View>
              </View>

              {/* Share Invite Full Pill Button */}
              <TouchableOpacity
                style={styles.spotifySharePill}
                onPress={handleShareInvite}
                accessibilityRole="button"
                accessibilityLabel="Oda Kodunu Paylaş"
                testID="campus-jam-share-btn">
                <Icon name="share-variant" size={18} color="#fff" />
                <Text style={styles.spotifySharePillText}>Arkadaşlarını Jam'e Davet Et</Text>
              </TouchableOpacity>

              {/* Floating Emoji Reactions Deck */}
              <View style={styles.reactionDeck}>
                <Text style={styles.reactionDeckTitle}>CANLI TEPKİ GÖNDER</Text>
                <View style={styles.emojiRow}>
                  {POPULAR_JAM_EMOJIS.map(emoji => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.emojiBtn}
                      onPress={() => handleSendReaction(emoji)}
                      activeOpacity={0.6}
                      accessibilityRole="button"
                      accessibilityLabel={`Tepki ver: ${emoji}`}
                      testID={`jam-reaction-${emoji}`}>
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Leave Session Button */}
              <TouchableOpacity
                style={styles.leavePill}
                onPress={handleLeaveRoom}
                accessibilityRole="button"
                accessibilityLabel="Odadan Ayrıl"
                testID="campus-jam-leave-btn">
                <Icon name="door-open" size={16} color="#ef4444" />
                <Text style={styles.leavePillText}>
                  {activeRoom.isHost ? 'Oturumu Kapat' : 'Odadan Ayrıl'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0e1117',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingTop: 12,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dragPill: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  jamLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  headerTitle: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  floatingLayer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  floatingEmojiText: {
    position: 'absolute',
    bottom: 120,
    fontSize: 34,
  },

  /* TAB SWITCHER */
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 4,
    marginBottom: SPACING.md,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(227, 30, 36, 0.85)',
  },
  tabBtnText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#fff',
  },

  /* CREATE TAB */
  idleView: {
    paddingVertical: 4,
  },
  createTabContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  heroAuraWrapper: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  heroAuraCircle: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(227, 30, 36, 0.25)',
  },
  heroCenterIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  heroSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: SPACING.md,
    marginTop: 6,
    marginBottom: 16,
  },
  stationSyncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    width: '100%',
    marginBottom: 18,
  },
  stationIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(227, 30, 36, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stationCardInfo: {
    flex: 1,
  },
  stationCardLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  stationCardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  equalizerWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 28,
    paddingRight: 4,
  },
  eqBar: {
    width: 3.5,
    height: 22,
    backgroundColor: '#22c55e',
    borderRadius: 2,
  },
  spotifyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 26,
    width: '100%',
    gap: 10,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  spotifyCreateBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  /* JOIN TAB */
  joinTabContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  joinHeroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(227, 30, 36, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  joinTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  joinSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    width: '100%',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pinBoxesRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  pinBox: {
    width: 44,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxFocused: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(227, 30, 36, 0.08)',
  },
  pinBoxFilled: {
    borderColor: '#22c55e',
  },
  pinDigit: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  hiddenInput: {
    height: 40,
    width: '100%',
    color: 'transparent',
    position: 'absolute',
    opacity: 0.01,
  },
  spotifyJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 14,
    borderRadius: 24,
    width: '100%',
    marginTop: 16,
    gap: 8,
  },
  spotifyJoinBtnActive: {
    backgroundColor: '#22c55e',
  },
  spotifyJoinBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },

  /* ACTIVE ROOM VIEW */
  activeRoomView: {
    paddingVertical: 4,
    gap: 12,
  },
  avatarOrbitSection: {
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  avatarHostBorder: {
    borderColor: '#f59e0b',
    backgroundColor: '#332308',
  },
  avatarPlusBubble: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  crownBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 2,
  },
  activeCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activePulseGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  activeCountText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
  },

  /* CODE HERO CARD */
  codeHeroCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(227, 30, 36, 0.08)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(227, 30, 36, 0.35)',
  },
  codeCardBadge: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  codeTouchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  codeText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 8,
  },
  codeHintText: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  copiedToastText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
  },

  /* ACTIVE STATION CARD */
  activeStationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  activeStationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeStationName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  activeStationStatus: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '600',
  },

  /* SHARE BUTTON */
  spotifySharePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 24,
    gap: 8,
    elevation: 3,
  },
  spotifySharePillText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* REACTION DECK */
  reactionDeck: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  reactionDeckTitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  emojiBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  emojiText: {
    fontSize: 24,
  },

  /* LEAVE BUTTON */
  leavePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
  },
  leavePillText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
});
