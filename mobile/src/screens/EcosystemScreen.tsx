import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import GlobalHeader from '../components/GlobalHeader';
import PageTransition from '../components/PageTransition';
import {useAuth} from '../context/AuthContext';
import {ecosystemCopy} from '../i18n/ecosystemCopy';
import {
  BILET_HOME_URL,
  EcosystemTicket,
  RoomAccess,
  STUDIO_RESERVATION_URL,
  fetchEcosystemTickets,
  fetchRoomAccessEligibility,
  trustedTicketDetailUrl,
} from '../services/ecosystemService';
import {COLORS, SPACING} from '../theme/theme';

const EcosystemScreen = () => {
  const navigation = useNavigation<any>();
  const {i18n} = useTranslation();
  const copy = ecosystemCopy(i18n.language);
  const {user} = useAuth();
  const hasAccount = Boolean(user && !user.is_guest);
  const requestRevision = useRef(0);
  const [tickets, setTickets] = useState<EcosystemTicket[]>([]);
  const [roomAccess, setRoomAccess] = useState<RoomAccess | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ticketError, setTicketError] = useState(false);

  const load = useCallback(async () => {
    const revision = ++requestRevision.current;
    if (!hasAccount) {
      setTickets([]);
      setRoomAccess(null);
      setTicketError(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLoading(true);
    const [ticketResult, roomResult] = await Promise.allSettled([
      fetchEcosystemTickets(),
      fetchRoomAccessEligibility(),
    ]);
    if (requestRevision.current !== revision) {
      return;
    }

    if (ticketResult.status === 'fulfilled') {
      setTickets(ticketResult.value);
      setTicketError(false);
    } else {
      setTickets([]);
      setTicketError(true);
    }
    setRoomAccess(roomResult.status === 'fulfilled' ? roomResult.value : null);
    setLoading(false);
    setRefreshing(false);
  }, [hasAccount]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
      return () => {
        requestRevision.current += 1;
      };
    }, [load]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    load().catch(() => undefined);
  }, [load]);

  const openUrl = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(copy.navTitle, copy.openFailed);
    }
  }, [copy.navTitle, copy.openFailed]);

  const openTicket = useCallback((ticket: EcosystemTicket) => {
    const url = trustedTicketDetailUrl(ticket.detail_url);
    if (!url) {
      Alert.alert(copy.navTitle, copy.openFailed);
      return;
    }
    openUrl(url).catch(() => undefined);
  }, [copy.navTitle, copy.openFailed, openUrl]);

  return (
    <PageTransition>
      <SafeAreaView style={styles.container}>
        <GlobalHeader />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.primary} />
          }
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroGlow} />
            <Text style={styles.kicker}>{copy.kicker}</Text>
            <Text style={styles.heroTitle}>{copy.heroTitle}</Text>
            <Text style={styles.heroSubtitle}>{copy.heroSubtitle}</Text>
          </View>

          {!hasAccount ? (
            <View style={styles.accountCard}>
              <Icon name="account-lock-outline" size={30} color={COLORS.primary} />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{copy.accountTitle}</Text>
                <Text style={styles.cardText}>{copy.accountBody}</Text>
              </View>
              <TouchableOpacity
                style={styles.compactButton}
                onPress={() => navigation.navigate('Auth', {screen: 'Login'})}>
                <Text style={styles.buttonText}>{copy.signIn}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}>
                <Icon name="ticket-confirmation-outline" size={26} color={COLORS.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{copy.ticketsTitle}</Text>
                <Text style={styles.cardText}>{copy.ticketsBody}</Text>
              </View>
            </View>

            {hasAccount && loading && !refreshing ? (
              <ActivityIndicator style={styles.loader} color={COLORS.primary} />
            ) : null}
            {hasAccount && ticketError ? (
              <Text style={styles.errorText}>{copy.ticketsError}</Text>
            ) : null}
            {hasAccount && !loading && !ticketError && tickets.length === 0 ? (
              <Text style={styles.emptyText}>{copy.ticketsEmpty}</Text>
            ) : null}
            {hasAccount ? tickets.map(ticket => (
              <View key={String(ticket.id)} style={styles.ticket}>
                <View style={styles.flex}>
                  <Text style={styles.ticketTitle}>{ticket.title}</Text>
                  <Text style={styles.ticketMeta}>
                    {[ticket.date, ticket.location].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={[styles.ticketStatus, ticket.checked_in && styles.ticketStatusDone]}>
                    {ticket.checked_in ? copy.checkedIn : copy.ready}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={copy.openTicket}
                  style={styles.iconButton}
                  onPress={() => openTicket(ticket)}>
                  <Icon name="qrcode" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            )) : null}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => openUrl(BILET_HOME_URL).catch(() => undefined)}>
              <Text style={styles.secondaryButtonText}>{copy.newTicket}</Text>
              <Icon name="open-in-new" size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}>
                <Icon name="calendar-clock-outline" size={26} color={COLORS.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{copy.reservationTitle}</Text>
                <Text style={styles.cardText}>{copy.reservationBody}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => openUrl(STUDIO_RESERVATION_URL).catch(() => undefined)}>
              <Text style={styles.buttonText}>{copy.openReservation}</Text>
              <Icon name="arrow-right" size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {roomAccess ? (
            <View style={[styles.card, styles.roomCard]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, styles.verifiedIcon]}>
                  <Icon name="qrcode-scan" size={27} color={COLORS.success} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{copy.roomTitle}</Text>
                  <Text style={styles.verifiedText}>{copy.roomVerified}</Text>
                </View>
              </View>
              <Text style={styles.cardText}>{copy.roomBody}</Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </PageTransition>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md, paddingBottom: 110, gap: SPACING.md},
  hero: {
    position: 'relative',
    overflow: 'hidden',
    padding: SPACING.lg,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(227,30,36,0.42)',
    backgroundColor: '#1B1113',
  },
  heroGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -55,
    top: -75,
    backgroundColor: 'rgba(227,30,36,0.20)',
  },
  kicker: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroTitle: {marginTop: SPACING.sm, color: COLORS.text, fontSize: 28, lineHeight: 34, fontWeight: '900'},
  heroSubtitle: {marginTop: SPACING.sm, color: COLORS.textMuted, fontSize: 14, lineHeight: 21},
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  card: {
    padding: SPACING.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  roomCard: {borderColor: 'rgba(52,199,89,0.35)'},
  cardHeader: {flexDirection: 'row', alignItems: 'center', gap: SPACING.md},
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(227,30,36,0.12)',
  },
  verifiedIcon: {backgroundColor: 'rgba(52,199,89,0.12)'},
  flex: {flex: 1},
  cardTitle: {color: COLORS.text, fontSize: 17, lineHeight: 22, fontWeight: '800'},
  cardText: {marginTop: 4, color: COLORS.textMuted, fontSize: 13, lineHeight: 19},
  loader: {marginVertical: SPACING.lg},
  errorText: {marginTop: SPACING.md, color: COLORS.error, fontSize: 13},
  emptyText: {marginTop: SPACING.md, color: COLORS.textMuted, fontSize: 13},
  ticket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  ticketTitle: {color: COLORS.text, fontSize: 15, fontWeight: '800'},
  ticketMeta: {marginTop: 4, color: COLORS.textMuted, fontSize: 12},
  ticketStatus: {marginTop: 6, color: COLORS.primary, fontSize: 11, fontWeight: '800'},
  ticketStatusDone: {color: COLORS.success},
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  primaryButton: {
    marginTop: SPACING.md,
    minHeight: 48,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    marginTop: SPACING.md,
    minHeight: 46,
    paddingHorizontal: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
  },
  compactButton: {
    minHeight: 40,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  buttonText: {color: COLORS.text, fontSize: 13, fontWeight: '900'},
  secondaryButtonText: {color: COLORS.text, fontSize: 13, fontWeight: '800'},
  verifiedText: {marginTop: 4, color: COLORS.success, fontSize: 12, fontWeight: '800'},
});

export default EcosystemScreen;
