import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {fetchMyTickets, MobileTicket} from '../services/ecosystem';
import {COLORS, SPACING} from '../theme/theme';
import {logSafeError} from '../utils/safeLog';

export default function MyTicketsScreen() {
  const navigation = useNavigation<any>();
  const [tickets, setTickets] = useState<MobileTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setTickets(await fetchMyTickets());
    } catch (loadError) {
      logSafeError('ecosystem.tickets', loadError);
      setError('Biletleriniz şu anda alınamıyor. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="arrow-left" size={23} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Biletlerim</Text>
        <View style={styles.back} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={COLORS.primary}
          />
        }>
        <Text style={styles.intro}>
          Satın aldığınız veya ücretsiz aldığınız RadioTEDU biletleri, mobil hesap e-postanızla eşleştirilir.
        </Text>
        {loading ? <ActivityIndicator color={COLORS.primary} size="large" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && tickets.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="ticket-confirmation-outline" size={38} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Bu e-posta adresine ait aktif bir bilet bulunamadı.</Text>
          </View>
        ) : null}
        {tickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function TicketCard({ticket}: {ticket: MobileTicket}) {
  const openTicket = async () => {
    try {
      await Linking.openURL(ticket.detail_url);
    } catch (openError) {
      logSafeError('ecosystem.ticket-link', openError);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Icon name="ticket-confirmation" size={30} color={COLORS.primary} />
        <View style={styles.cardBody}>
          <Text style={styles.title}>{ticket.title}</Text>
          <Text style={styles.meta}>
            {ticket.date} {ticket.starts_at ? `· ${ticket.starts_at.slice(0, 5)}` : ''}
          </Text>
        </View>
        {ticket.checked_in ? <Text style={styles.used}>GİRİŞ YAPILDI</Text> : null}
      </View>
      <Text style={styles.location}>{ticket.location || 'RadioTEDU etkinliği'}</Text>
      <View style={styles.codeRow}>
        <Text style={styles.codeLabel}>BİLET KODU</Text>
        <Text style={styles.code}>{ticket.code}</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={() => openTicket()}>
        <Icon name="qrcode" size={20} color="#fff" />
        <Text style={styles.buttonText}>QR bileti aç</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  header: {height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md},
  back: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  headerTitle: {color: COLORS.text, fontSize: 18, fontWeight: '900'},
  content: {padding: SPACING.lg, paddingBottom: SPACING.xl},
  intro: {color: COLORS.textMuted, fontSize: 13, lineHeight: 20, marginBottom: SPACING.lg},
  error: {color: COLORS.error, textAlign: 'center', padding: SPACING.lg},
  empty: {alignItems: 'center', gap: SPACING.md, padding: SPACING.xl, backgroundColor: COLORS.surface, borderRadius: 20},
  emptyText: {color: COLORS.textMuted, textAlign: 'center'},
  card: {backgroundColor: COLORS.card, borderRadius: 22, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md},
  cardTop: {flexDirection: 'row', alignItems: 'center', gap: SPACING.md},
  cardBody: {flex: 1},
  title: {color: COLORS.text, fontSize: 17, fontWeight: '900'},
  meta: {color: COLORS.textMuted, marginTop: 4},
  used: {color: COLORS.success, fontSize: 9, fontWeight: '900'},
  location: {color: COLORS.textMuted, marginTop: SPACING.md},
  codeRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md, padding: SPACING.md, borderRadius: 14, backgroundColor: COLORS.surface},
  codeLabel: {color: COLORS.textMuted, fontSize: 10, fontWeight: '800'},
  code: {color: COLORS.text, fontSize: 18, fontWeight: '900', letterSpacing: 1.4},
  button: {height: 48, borderRadius: 14, backgroundColor: COLORS.primary, marginTop: SPACING.md, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center'},
  buttonText: {color: '#fff', fontWeight: '900'},
});
