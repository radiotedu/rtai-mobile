import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {fetchRoomAccess, RoomAccess} from '../services/ecosystem';
import {COLORS, SPACING} from '../theme/theme';
import {logSafeError} from '../utils/safeLog';

export default function RoomQrScreen() {
  const navigation = useNavigation<any>();
  const [access, setAccess] = useState<RoomAccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoomAccess().then(setAccess).catch(accessError => {
      logSafeError('ecosystem.room-access', accessError);
      setError('ERP oda katılım yetkiniz doğrulanamadı.');
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="arrow-left" size={23} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Oda QR</Text>
        <View style={styles.back} />
      </View>
      <View style={styles.content}>
        {!access && !error ? <ActivityIndicator color={COLORS.primary} size="large" /> : null}
        {error ? (
          <View style={styles.card}>
            <Icon name="shield-alert-outline" size={44} color={COLORS.error} />
            <Text style={styles.title}>Erişim doğrulanamadı</Text>
            <Text style={styles.text}>{error}</Text>
          </View>
        ) : null}
        {access ? (
          <View style={styles.card}>
            <View style={styles.icon}>
              <Icon name="qrcode-scan" size={50} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Oda katılımı hazır</Text>
            <Text style={styles.text}>{access.instructions}</Text>
            <View style={styles.note}>
              <Icon name="shield-check-outline" size={21} color={COLORS.success} />
              <Text style={styles.noteText}>
                Bu bölüm yalnızca ERP hesabı bağlı ve oda katılım yetkisi açık RadioTEDU üyelerinde görünür.
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  header: {height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md},
  back: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  headerTitle: {color: COLORS.text, fontSize: 18, fontWeight: '900'},
  content: {flex: 1, padding: SPACING.lg, justifyContent: 'center'},
  card: {alignItems: 'center', borderRadius: 26, padding: SPACING.xl, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border},
  icon: {width: 94, height: 94, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(227,30,36,0.12)'},
  title: {color: COLORS.text, fontSize: 23, fontWeight: '900', marginTop: SPACING.lg},
  text: {color: COLORS.textMuted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: SPACING.sm},
  note: {flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, borderRadius: 16, backgroundColor: COLORS.surface, marginTop: SPACING.lg},
  noteText: {flex: 1, color: COLORS.textMuted, fontSize: 12, lineHeight: 18},
});
