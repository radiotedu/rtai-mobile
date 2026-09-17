import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
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
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

  useEffect(() => {
    const unsubRoom = subscribeToJamRoom(room => {
      setActiveRoom(room);
    });

    const unsubRx = subscribeToJamReactions(rx => {
      spawnFloatingEmoji(rx.emoji);
    });

    return () => {
      unsubRoom();
      unsubRx();
    };
  }, []);

  const spawnFloatingEmoji = (emoji: string) => {
    const id = `fl-${Date.now()}-${Math.random()}`;
    const animY = new Animated.Value(0);
    const animOpacity = new Animated.Value(1);
    const leftOffset = Math.random() * (SCREEN_WIDTH - 100) + 20;

    const newEmoji: FloatingEmoji = {
      id,
      emoji,
      animY,
      animOpacity,
      leftOffset,
    };

    setFloatingEmojis(prev => [...prev.slice(-15), newEmoji]);

    Animated.parallel([
      Animated.timing(animY, {
        toValue: -180,
        duration: 1800,
        useNativeDriver: true,
      }),
      Animated.timing(animOpacity, {
        toValue: 0,
        duration: 1800,
        useNativeDriver: true,
      }),
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
    try {
      await Share.share({
        message: `RadioTEDU Campus Jam: Birlikte ${activeRoom.channelName} dinleyelim! Oda Kodu: ${activeRoom.code} 🎧 https://radiotedu.com/jam`,
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
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerBadgeWrap}>
              <Icon name="account-group" size={20} color={COLORS.primary} />
              <Text style={styles.headerTitle}>BİRLİKTE DİNLE (CAMPUS JAM)</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              testID="campus-jam-close-btn">
              <Icon name="close" size={24} color={COLORS.text} />
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
                    transform: [{translateY: fe.animY}],
                  },
                ]}>
                {fe.emoji}
              </Animated.Text>
            ))}
          </View>

          {!activeRoom ? (
            /* No Active Room: Options to Create or Join */
            <View style={styles.idleView}>
              <View style={styles.heroBox}>
                <Icon name="headphones" size={48} color={COLORS.primary} />
                <Text style={styles.heroTitle}>Arkadaşlarınla Senkronize Dinle</Text>
                <Text style={styles.heroSub}>
                  Oda açarak veya bir koda katılarak kampüsteki arkadaşlarınla aynı anda aynı şarkıyı dinle, anlık tepki gönder!
                </Text>
              </View>

              <TouchableOpacity
                style={styles.createBtn}
                onPress={handleCreateRoom}
                accessibilityRole="button"
                accessibilityLabel="Yeni Jam Odası Başlat"
                testID="campus-jam-create-btn">
                <Icon name="plus-circle" size={20} color="#fff" />
                <Text style={styles.createBtnText}>Yeni Oda Başlat ({channelName})</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>VEYA KODA KATIL</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.joinBox}>
                <TextInput
                  style={styles.codeInput}
                  placeholder="6 Haneli Oda Kodu"
                  placeholderTextColor={COLORS.textMuted}
                  value={joinCodeInput}
                  onChangeText={setJoinCodeInput}
                  keyboardType="number-pad"
                  maxLength={6}
                  testID="campus-jam-code-input"
                />
                <TouchableOpacity
                  style={styles.joinBtn}
                  onPress={handleJoinRoom}
                  accessibilityRole="button"
                  accessibilityLabel="Odaya Katıl"
                  testID="campus-jam-join-btn">
                  <Text style={styles.joinBtnText}>Katıl</Text>
                </TouchableOpacity>
              </View>
              {joinError ? <Text style={styles.errorText}>{joinError}</Text> : null}
            </View>
          ) : (
            /* Active Room View */
            <View style={styles.activeRoomView}>
              {/* Room Code Card */}
              <View style={styles.codeCard}>
                <Text style={styles.codeCardLabel}>ODA KODU</Text>
                <Text style={styles.codeText} testID="campus-jam-room-code">
                  {activeRoom.code}
                </Text>
                <View style={styles.codeActions}>
                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={handleShareInvite}
                    accessibilityRole="button"
                    accessibilityLabel="Oda Kodunu Paylaş"
                    testID="campus-jam-share-btn">
                    <Icon name="share-variant" size={16} color="#fff" />
                    <Text style={styles.shareBtnText}>Davet Et</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Station & Listener Stats */}
              <View style={styles.statsCard}>
                <View style={styles.stationBadge}>
                  <Icon name="radio" size={16} color={COLORS.primary} />
                  <Text style={styles.stationBadgeText}>{activeRoom.channelName}</Text>
                </View>
                <View style={styles.listenerBadge}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.listenerBadgeText} testID="campus-jam-listener-count">
                    {activeRoom.listeners.length} Dinleyici
                  </Text>
                </View>
              </View>

              {/* Listeners Row */}
              <View style={styles.listenersSection}>
                <Text style={styles.listenersTitle}>Odada Dinleyenler:</Text>
                <View style={styles.listenersWrap}>
                  {activeRoom.listeners.map((listener, idx) => (
                    <View key={listener.id || idx} style={styles.listenerPill}>
                      <Icon
                        name={listener.isHost ? 'crown' : 'account'}
                        size={14}
                        color={listener.isHost ? '#f59e0b' : COLORS.text}
                      />
                      <Text style={styles.listenerName} numberOfLines={1}>
                        {listener.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Live Emoji Reaction Bursts */}
              <View style={styles.reactionsSection}>
                <Text style={styles.reactionsTitle}>Canlı Tepki Gönder:</Text>
                <View style={styles.emojiRow}>
                  {POPULAR_JAM_EMOJIS.map(emoji => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.emojiBtn}
                      onPress={() => handleSendReaction(emoji)}
                      accessibilityRole="button"
                      accessibilityLabel={`Tepki ver: ${emoji}`}
                      testID={`jam-reaction-${emoji}`}>
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Leave Button */}
              <TouchableOpacity
                style={styles.leaveBtn}
                onPress={handleLeaveRoom}
                accessibilityRole="button"
                accessibilityLabel="Odadan Ayrıl"
                testID="campus-jam-leave-btn">
                <Icon name="exit-to-app" size={18} color="#ef4444" />
                <Text style={styles.leaveBtnText}>
                  {activeRoom.isHost ? 'Odayı Kapat' : 'Odadan Ayrıl'}
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#12151c',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  headerBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  closeBtn: {
    padding: 4,
  },
  floatingLayer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  floatingEmojiText: {
    position: 'absolute',
    bottom: 120,
    fontSize: 32,
  },
  idleView: {
    paddingVertical: SPACING.md,
  },
  heroBox: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: 8,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: SPACING.md,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: SPACING.md,
    gap: 8,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  joinBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  joinBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  activeRoomView: {
    paddingVertical: SPACING.sm,
    gap: 14,
  },
  codeCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(227, 30, 36, 0.08)',
    borderRadius: 16,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(227, 30, 36, 0.25)',
  },
  codeCardLabel: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  codeText: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 6,
    marginVertical: 4,
  },
  codeActions: {
    flexDirection: 'row',
    marginTop: 6,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  stationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stationBadgeText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  listenerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  listenerBadgeText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '700',
  },
  listenersSection: {
    gap: 6,
  },
  listenersTitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  listenersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  listenerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
  },
  listenerName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  reactionsSection: {
    gap: 8,
    marginTop: 4,
  },
  reactionsTitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 10,
  },
  emojiBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  emojiText: {
    fontSize: 24,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    marginTop: 6,
    gap: 6,
  },
  leaveBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
});
