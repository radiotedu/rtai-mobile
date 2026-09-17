import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  SafeAreaView,
  ScrollView,
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
import {RADIO_CHANNELS} from '../data/radioChannels';
import {
  CampusJamRoom,
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
import {Analytics} from '../services/analyticsService';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

interface FloatingEmoji {
  id: string;
  emoji: string;
  animY: Animated.Value;
  animX: Animated.Value;
  animScale: Animated.Value;
  animRotate: Animated.Value;
  animOpacity: Animated.Value;
  leftOffset: number;
}

interface CampusJamModalProps {
  visible: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
}

/**
 * Interactive Emoji Reaction Button with micro-spring bounce
 */
const EmojiReactionButton: React.FC<{
  emoji: string;
  onPress: (emoji: string) => void;
  testID: string;
}> = ({emoji, onPress, testID}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.8,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => onPress(emoji)}
      accessibilityRole="button"
      accessibilityLabel={`Tepki ver: ${emoji}`}
      testID={testID}>
      <Animated.View
        style={[
          styles.emojiBtn,
          {
            transform: [{scale: scaleAnim}],
          },
        ]}>
        <Text style={styles.emojiText}>{emoji}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export const CampusJamModal: React.FC<CampusJamModalProps> = ({
  visible,
  onClose,
  channelId,
  channelName,
}) => {
  const {t} = useTranslation();
  const [activeRoom, setActiveRoom] = useState<CampusJamRoom | null>(getActiveJamRoom());
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);
  const toastTimeoutRef = useRef<any>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

  // Resolve station theme color (RadioTEDU red, Classical gold, Jazz purple, Lo-Fi cyan, Energize yellow, Rock orange)
  const stationColor =
    RADIO_CHANNELS.find(c => c.id === channelId)?.color || COLORS.primary;

  // Concentric Acoustic Ripple Waves (Clubhouse / X Spaces style speaking/listening halo)
  const ripple1Scale = useRef(new Animated.Value(1)).current;
  const ripple1Opacity = useRef(new Animated.Value(0.65)).current;
  const ripple2Scale = useRef(new Animated.Value(1)).current;
  const ripple2Opacity = useRef(new Animated.Value(0.45)).current;
  const ambientPulse = useRef(new Animated.Value(1)).current;

  // 7-Bar Stereo Graphic Equalizer (Dancing social-music spectrum)
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.6)).current;
  const bar3 = useRef(new Animated.Value(0.85)).current;
  const bar4 = useRef(new Animated.Value(0.4)).current;
  const bar5 = useRef(new Animated.Value(0.75)).current;
  const bar6 = useRef(new Animated.Value(0.5)).current;
  const bar7 = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const unsubRoom = subscribeToJamRoom(room => {
      setActiveRoom(room);
    });

    const unsubRx = subscribeToJamReactions(rx => {
      spawnFloatingEmoji(rx.emoji);
    });

    if (visible) {
      Analytics.jamModalOpened(channelId);
    }

    if (process.env.NODE_ENV === 'test') {
      return () => {
        unsubRoom();
        unsubRx();
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
        }
      };
    }

    // 1. Concentric Ripple 1 Loop
    const ripple1Loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ripple1Scale, {
            toValue: 1.55,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ripple1Opacity, {
            toValue: 0,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ripple1Scale, {toValue: 1.0, duration: 0, useNativeDriver: true}),
          Animated.timing(ripple1Opacity, {toValue: 0.65, duration: 0, useNativeDriver: true}),
        ]),
      ]),
    );

    // 2. Concentric Ripple 2 Loop (staggered)
    const ripple2Loop = Animated.loop(
      Animated.sequence([
        Animated.delay(650),
        Animated.parallel([
          Animated.timing(ripple2Scale, {
            toValue: 1.7,
            duration: 1900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ripple2Opacity, {
            toValue: 0,
            duration: 1900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ripple2Scale, {toValue: 1.0, duration: 0, useNativeDriver: true}),
          Animated.timing(ripple2Opacity, {toValue: 0.45, duration: 0, useNativeDriver: true}),
        ]),
      ]),
    );

    // 3. Ambient Breathing Backlight
    const ambientLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientPulse, {
          toValue: 1.18,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ambientPulse, {
          toValue: 1.0,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    // 4. 7-Bar Equalizer Loops
    const animateBar = (anim: Animated.Value, min: number, max: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {toValue: max, duration, useNativeDriver: true}),
          Animated.timing(anim, {toValue: min, duration: duration * 1.08, useNativeDriver: true}),
        ]),
      );
    };

    const eqLoop = Animated.parallel([
      animateBar(bar1, 0.25, 0.85, 340),
      animateBar(bar2, 0.35, 1.0, 420),
      animateBar(bar3, 0.4, 0.9, 310),
      animateBar(bar4, 0.2, 1.0, 480),
      animateBar(bar5, 0.3, 0.8, 360),
      animateBar(bar6, 0.25, 0.95, 410),
      animateBar(bar7, 0.3, 0.75, 330),
    ]);

    ripple1Loop.start();
    ripple2Loop.start();
    ambientLoop.start();
    eqLoop.start();

    return () => {
      unsubRoom();
      unsubRx();
      ripple1Loop.stop();
      ripple2Loop.stop();
      ambientLoop.stop();
      eqLoop.stop();
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [channelId]);

  const spawnFloatingEmoji = (emoji: string) => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    const id = `fl-${Date.now()}-${Math.random()}`;
    const animY = new Animated.Value(0);
    const animX = new Animated.Value(0);
    const animScale = new Animated.Value(0.3);
    const animRotate = new Animated.Value(0);
    const animOpacity = new Animated.Value(1);

    const leftOffset = Math.random() * (SCREEN_WIDTH - 130) + 40;
    const lateralShift = (Math.random() - 0.5) * 70;
    const rotateAngle = (Math.random() - 0.5) * 30; // -15deg to +15deg

    const newEmoji: FloatingEmoji = {
      id,
      emoji,
      animY,
      animX,
      animScale,
      animRotate,
      animOpacity,
      leftOffset,
    };

    setFloatingEmojis(prev => [...prev.slice(-14), newEmoji]);

    Animated.parallel([
      // Upward float
      Animated.timing(animY, {
        toValue: -260,
        duration: 2100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Lateral sinusoidal shift
      Animated.timing(animX, {
        toValue: lateralShift,
        duration: 2100,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      // Rotation
      Animated.timing(animRotate, {
        toValue: rotateAngle,
        duration: 2100,
        useNativeDriver: true,
      }),
      // Pop scale up on birth then settle
      Animated.sequence([
        Animated.timing(animScale, {
          toValue: 1.35,
          duration: 280,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.timing(animScale, {
          toValue: 1.0,
          duration: 1820,
          useNativeDriver: true,
        }),
      ]),
      // Fade out towards the end
      Animated.sequence([
        Animated.delay(1200),
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
      Analytics.jamRoomCreated(channelId, channelName);
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
        Analytics.jamRoomJoined(channelId);
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
      toastTimeoutRef.current = setTimeout(() => setCopiedToast(false), 2400);
    }

    try {
      await Share.share({
        message: `RadioTEDU Campus Jam: Gel birlikte ${activeRoom.channelName} dinleyelim! Oda Kodumuz: ${activeRoom.code} 🎧 https://radiotedu.com/jam`,
      });
    } catch (err) {
      logSafeError('campusJam.share', err);
    }
  };

  const handleSendReaction = (emoji?: string) => {
    const em = emoji || '🔥';
    sendJamReaction(em);
    Analytics.jamReactionSent(em);
  };

  const handleLeaveRoom = () => {
    const isHost = Boolean(activeRoom?.isHost);
    leaveJamRoom();
    Analytics.jamRoomLeft(isHost);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.container}>
          {/* Dynamic Station Ambient Light Backdrop */}
          <Animated.View
            style={[
              styles.ambientBackdropGlow,
              {
                backgroundColor: stationColor,
                transform: [{scale: ambientPulse}],
              },
            ]}
            pointerEvents="none"
          />

          {/* Drag Handle Bar */}
          <View style={styles.dragPill} />

          {/* Top Header Bar */}
          <View style={styles.headerRow}>
            <View style={styles.headerBadgeWrap}>
              <View style={styles.jamLiveDot} />
              <Text style={styles.headerBrandText}>RadioTEDU</Text>
              <View style={styles.headerDividerDot} />
              <Text style={styles.headerSubBadge}>CAMPUS JAM</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              testID="campus-jam-close-btn">
              <Icon name="close" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          </View>

          {/* Floating Emoji Physics Layer */}
          <View style={styles.floatingLayer} pointerEvents="none">
            {floatingEmojis.map(fe => {
              const spin = fe.animRotate.interpolate({
                inputRange: [-30, 30],
                outputRange: ['-30deg', '30deg'],
              });
              return (
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
                        {rotate: spin},
                      ],
                    },
                  ]}>
                  {fe.emoji}
                </Animated.Text>
              );
            })}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}>
            {!activeRoom ? (
              /* =========================================================================
                 IDLE VIEW: Acoustic Hero + Live Equalizer + Create Jam + PIN Entry
                 ========================================================================= */
              <View style={styles.idleView}>
                {/* Social Stage Hero with Acoustic Concentric Waves */}
                <View style={styles.heroAuraWrapper}>
                  <Animated.View
                    style={[
                      styles.heroAuraCircle,
                      {
                        borderColor: stationColor,
                        transform: [{scale: ripple2Scale}],
                        opacity: ripple2Opacity,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.heroAuraCircle,
                      {
                        borderColor: stationColor,
                        transform: [{scale: ripple1Scale}],
                        opacity: ripple1Opacity,
                      },
                    ]}
                  />
                  <View style={[styles.heroCenterIcon, {backgroundColor: stationColor}]}>
                    <Icon name="headphones" size={38} color="#ffffff" />
                  </View>
                </View>

                <Text style={styles.heroTitle}>Birlikte Canlı Dinle</Text>
                <Text style={styles.heroSub}>
                  Kampüsteki arkadaşlarınla aynı anda aynı radyo akışını canlı dinle, anlık tepkiler paylaş!
                </Text>

                {/* Station Preview Card with 7 Dancing Equalizer Waves */}
                <View style={styles.stationSyncCard}>
                  <View style={[styles.stationIconBox, {backgroundColor: `${stationColor}25`}]}>
                    <Icon name="radio-tower" size={22} color={stationColor} />
                  </View>
                  <View style={styles.stationCardInfo}>
                    <Text style={styles.stationCardLabel}>ŞU ANKİ İSTASYON</Text>
                    <Text style={styles.stationCardTitle}>{channelName}</Text>
                  </View>

                  {/* 7-Bar Dynamic Equalizer */}
                  <View style={styles.equalizerWrap}>
                    <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar1}]}]} />
                    <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar2}]}]} />
                    <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar3}]}]} />
                    <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar4}]}]} />
                    <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar5}]}]} />
                    <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar6}]}]} />
                    <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar7}]}]} />
                  </View>
                </View>

                {/* Primary Action: Create Jam Room */}
                <TouchableOpacity
                  style={[styles.spotifyCreateBtn, {backgroundColor: stationColor}]}
                  onPress={handleCreateRoom}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Yeni Jam Odası Başlat"
                  testID="campus-jam-create-btn">
                  <Icon name="play-circle" size={22} color="#fff" />
                  <Text style={styles.spotifyCreateBtnText}>
                    Yeni Jam Başlat ({channelName})
                  </Text>
                </TouchableOpacity>

                {/* Divider */}
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
                          isFocused && [styles.pinBoxFocused, {borderColor: stationColor}],
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

                {/* Join Room Button */}
                <TouchableOpacity
                  style={[
                    styles.spotifyJoinBtn,
                    joinCodeInput.length === 6 && styles.spotifyJoinBtnActive,
                  ]}
                  onPress={handleJoinRoom}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Odaya Katıl"
                  testID="campus-jam-join-btn">
                  <Icon name="arrow-right-circle" size={20} color="#fff" />
                  <Text style={styles.spotifyJoinBtnText}>Odaya Katıl</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* =========================================================================
                 ACTIVE ROOM VIEW: Clubhouse / X Spaces Social Stage & Spotify Jam Session
                 ========================================================================= */
              <View style={styles.activeRoomView}>
                {/* 1. BROADCASTER / STAGE HERO (Clubhouse / Spaces Speaking Stage) */}
                <View style={[styles.stageSectionCard, {borderColor: `${stationColor}40`}]}>
                  <View style={styles.stageHeaderRow}>
                    <View style={styles.stageTagWrap}>
                      <Icon name="broadcast" size={13} color={stationColor} />
                      <Text style={[styles.stageTagText, {color: stationColor}]}>
                        CANLI SAHNE
                      </Text>
                    </View>
                    <View style={styles.stageCodecBadge}>
                      <View style={styles.liveGreenBeacon} />
                      <Text style={styles.stageCodecText}>128k AAC · STEREO</Text>
                    </View>
                  </View>

                  <View style={styles.stageCenterRow}>
                    {/* Host Avatar with Concentric Acoustic Ripples */}
                    <View style={styles.hostAcousticWrapper}>
                      <Animated.View
                        style={[
                          styles.hostRippleCircle,
                          {
                            borderColor: '#f59e0b',
                            transform: [{scale: ripple2Scale}],
                            opacity: ripple2Opacity,
                          },
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.hostRippleCircle,
                          {
                            borderColor: '#f59e0b',
                            transform: [{scale: ripple1Scale}],
                            opacity: ripple1Opacity,
                          },
                        ]}
                      />
                      <View style={styles.hostAvatarCircle}>
                        <Text style={styles.hostAvatarInitial}>
                          {activeRoom.hostName
                            ? activeRoom.hostName.slice(0, 2).toUpperCase()
                            : 'TD'}
                        </Text>
                        <View style={styles.hostCrownFloatingBadge}>
                          <Icon name="crown" size={13} color="#f59e0b" />
                        </View>
                      </View>
                    </View>

                    {/* Host Details and Station Info */}
                    <View style={styles.hostInfoColumn}>
                      <View style={styles.hostRolePill}>
                        <Text style={styles.hostRolePillText}>👑 ODA KURUCUSU / HOST</Text>
                      </View>
                      <Text style={styles.hostNameText} numberOfLines={1}>
                        {activeRoom.hostName || 'RadioTEDU Host'}
                      </Text>
                      <View style={styles.stageStationRow}>
                        <Icon name="radio" size={15} color={stationColor} />
                        <Text style={styles.stageStationText} numberOfLines={1}>
                          {activeRoom.channelName}
                        </Text>
                      </View>
                    </View>

                    {/* 7-Bar Stereo Equalizer on Stage */}
                    <View style={styles.equalizerWrap}>
                      <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar1}]}]} />
                      <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar2}]}]} />
                      <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar3}]}]} />
                      <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar4}]}]} />
                      <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar5}]}]} />
                      <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar6}]}]} />
                      <Animated.View style={[styles.eqBar, {transform: [{scaleY: bar7}]}]} />
                    </View>
                  </View>
                </View>

                {/* 2. SPOTIFY JAM ROOM CODE HERO CARD */}
                <View style={[styles.codeHeroCard, {borderColor: `${stationColor}40`}]}>
                  <Text style={[styles.codeCardBadge, {color: stationColor}]}>
                    CAMPUS JAM KODU
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={handleShareInvite}
                    style={styles.codeTouchWrap}>
                    <Text style={styles.codeText} testID="campus-jam-room-code">
                      {activeRoom.code}
                    </Text>
                    <View style={[styles.copyIconBubble, {backgroundColor: `${stationColor}20`}]}>
                      <Icon name="content-copy" size={18} color={stationColor} />
                    </View>
                  </TouchableOpacity>
                  {copiedToast ? (
                    <Text style={styles.copiedToastText}>✓ Kod kopyalandı ve paylaşıma hazır!</Text>
                  ) : (
                    <Text style={styles.codeHintText}>
                      Koda dokunarak kopyala veya arkadaşlarınla paylaş
                    </Text>
                  )}
                </View>

                {/* 3. CAMPUS LISTENERS AUDIENCE CLUSTER (Clubhouse Room Grid) */}
                <View style={styles.listenersSection}>
                  <View style={styles.listenersHeaderRow}>
                    <Text style={styles.listenersSectionTitle}>
                      DİNLEYİCİLER & KAMPÜS ARKADAŞLARI
                    </Text>
                    <View style={styles.activeCountRow}>
                      <View style={styles.activePulseGreen} />
                      <Text style={styles.activeCountText} testID="campus-jam-listener-count">
                        {activeRoom.listeners.length} Dinleyici Canlı Bağlantıda
                      </Text>
                    </View>
                  </View>

                  <View style={styles.listenersGrid}>
                    {activeRoom.listeners.map((listener, idx) => {
                      const initials = listener.name
                        ? listener.name.slice(0, 2).toUpperCase()
                        : 'TD';
                      return (
                        <View key={listener.id || idx} style={styles.listenerCard}>
                          <View
                            style={[
                              styles.listenerAvatarBubble,
                              listener.isHost && styles.listenerAvatarHostBorder,
                            ]}>
                            <Text style={styles.listenerInitial}>{initials}</Text>
                            {listener.isHost ? (
                              <View style={styles.listenerCrownBadge}>
                                <Icon name="crown" size={11} color="#f59e0b" />
                              </View>
                            ) : (
                              <View style={styles.listenerSyncDot} />
                            )}
                          </View>
                          <Text style={styles.listenerName} numberOfLines={1}>
                            {listener.name || 'Öğrenci'}
                          </Text>
                        </View>
                      );
                    })}

                    {/* Plus Invite Listener Tile */}
                    <TouchableOpacity
                      style={styles.listenerCard}
                      onPress={handleShareInvite}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Arkadaş Davet Et">
                      <View style={[styles.listenerAvatarBubble, styles.listenerPlusBubble]}>
                        <Icon name="plus" size={20} color="#94a3b8" />
                      </View>
                      <Text style={styles.listenerInviteText}>Davet Et</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 4. SHARE INVITE FULL PILL BUTTON */}
                <TouchableOpacity
                  style={[styles.spotifySharePill, {backgroundColor: stationColor}]}
                  onPress={handleShareInvite}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Oda Kodunu Paylaş"
                  testID="campus-jam-share-btn">
                  <Icon name="share-variant" size={18} color="#fff" />
                  <Text style={styles.spotifySharePillText}>Arkadaşlarını Jam'e Davet Et</Text>
                </TouchableOpacity>

                {/* 5. INTERACTIVE FLOATING EMOJI REACTION DECK */}
                <View style={styles.reactionDeck}>
                  <View style={styles.reactionDeckHeader}>
                    <Icon name="lightning-bolt" size={14} color="#f59e0b" />
                    <Text style={styles.reactionDeckTitle}>CANLI TEPKİ GÖNDER</Text>
                  </View>
                  <View style={styles.emojiRow}>
                    {POPULAR_JAM_EMOJIS.map(emoji => (
                      <EmojiReactionButton
                        key={emoji}
                        emoji={emoji}
                        onPress={handleSendReaction}
                        testID={`jam-reaction-${emoji}`}
                      />
                    ))}
                  </View>
                </View>

                {/* 6. LEAVE / CLOSE SESSION BUTTON */}
                <TouchableOpacity
                  style={styles.leavePill}
                  onPress={handleLeaveRoom}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Odadan Ayrıl"
                  testID="campus-jam-leave-btn">
                  <Icon name="door-open" size={16} color="#ef4444" />
                  <Text style={styles.leavePillText}>
                    {activeRoom.isHost ? 'Oturumu Kapat (Host)' : 'Odadan Ayrıl'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0c0f17',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: SPACING.lg,
    paddingTop: 10,
    paddingBottom: 20,
    maxHeight: '94%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  ambientBackdropGlow: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.18,
  },
  dragPill: {
    width: 42,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.24)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  jamLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  headerBrandText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  headerDividerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  headerSubBadge: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
  scrollContent: {
    paddingBottom: 24,
  },

  /* IDLE VIEW STYLES */
  idleView: {
    paddingVertical: 4,
  },
  heroAuraWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 10,
  },
  heroAuraCircle: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
  },
  heroCenterIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  heroSub: {
    color: '#94a3b8',
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
    borderRadius: 18,
    padding: 14,
    width: '100%',
    marginBottom: 16,
  },
  stationIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stationCardInfo: {
    flex: 1,
  },
  stationCardLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  stationCardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  equalizerWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 26,
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
    paddingVertical: 15,
    borderRadius: 26,
    width: '100%',
    gap: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  spotifyCreateBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  pinBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 10,
  },
  pinBox: {
    width: 44,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  pinBoxFilled: {
    borderColor: '#22c55e',
  },
  pinDigit: {
    color: '#ffffff',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    borderRadius: 24,
    width: '100%',
    marginTop: 14,
    gap: 8,
  },
  spotifyJoinBtnActive: {
    backgroundColor: '#22c55e',
  },
  spotifyJoinBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },

  /* ACTIVE ROOM VIEW STYLES */
  activeRoomView: {
    paddingVertical: 2,
    gap: 12,
  },

  /* STAGE SECTION (Clubhouse / Spaces) */
  stageSectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
  },
  stageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stageTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stageTagText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  stageCodecBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveGreenBeacon: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  stageCodecText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stageCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hostAcousticWrapper: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostRippleCircle: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
  },
  hostAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarInitial: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  hostCrownFloatingBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  hostInfoColumn: {
    flex: 1,
    paddingHorizontal: 12,
  },
  hostRolePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  hostRolePillText: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hostNameText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  stageStationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  stageStationText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },

  /* CODE HERO CARD */
  codeHeroCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  codeCardBadge: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  codeTouchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  codeText: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 7,
  },
  copyIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeHintText: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
  },
  copiedToastText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
  },

  /* LISTENERS AUDIENCE SECTION */
  listenersSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  listenersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listenersSectionTitle: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  activeCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activePulseGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  activeCountText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '800',
  },
  listenersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  listenerCard: {
    alignItems: 'center',
    width: 58,
  },
  listenerAvatarBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listenerAvatarHostBorder: {
    borderColor: '#f59e0b',
    backgroundColor: '#332308',
  },
  listenerPlusBubble: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
  },
  listenerInitial: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  listenerCrownBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 1.5,
  },
  listenerSyncDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#0c0f17',
  },
  listenerName: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  listenerInviteText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },

  /* SHARE PILL BUTTON */
  spotifySharePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 24,
    gap: 8,
    elevation: 3,
  },
  spotifySharePillText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* REACTION DECK */
  reactionDeck: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  reactionDeckHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  reactionDeckTitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  emojiBtn: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
