import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import GlobalHeader from '../../components/GlobalHeader';
import PageTransition from '../../components/PageTransition';
import {
  AvatarCatalogItem,
  AvatarProfile,
  AvatarSlot,
  equipAvatarItem,
  fetchAvatarCatalog,
  fetchAvatarProfile,
  purchaseAvatarItem,
} from '../../services/studyService';
import {COLORS, SPACING} from '../../theme/theme';
import {appCopy} from '../../i18n/appCopy';
import {logSafeError} from '../../utils/safeLog';

export const AVATAR_CLOSET_SLOTS: Array<{id: AvatarSlot; titleKey: string; icon: string}> = [
  {id: 'hair', titleKey: 'avatar.slot.hair', icon: 'hair-dryer-outline'},
  {id: 'top', titleKey: 'avatar.slot.top', icon: 'tshirt-crew-outline'},
  {id: 'bottom', titleKey: 'avatar.slot.bottom', icon: 'human-male-height'},
  {id: 'shoes', titleKey: 'avatar.slot.shoes', icon: 'shoe-sneaker'},
  {id: 'accessory', titleKey: 'avatar.slot.accessory', icon: 'glasses'},
];

const emptyProfile: AvatarProfile = {ownedItemIds: [], equipped: {}};

const AvatarClosetScreen = () => {
  const navigation = useNavigation<any>();
  const {i18n} = useTranslation();
  const copy = useCallback(
    (key: string, values: Record<string, string | number> = {}) =>
      appCopy(i18n.language, key, values),
    [i18n.language],
  );
  const [catalog, setCatalog] = useState<AvatarCatalogItem[]>([]);
  const [profile, setProfile] = useState<AvatarProfile>(emptyProfile);
  const [walletPoints, setWalletPoints] = useState<AvatarProfile['points']>(undefined);
  const [activeSlot, setActiveSlot] = useState<AvatarSlot>('top');
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const loadCloset = useCallback(async () => {
    setLoading(true);
    try {
      const [nextCatalog, nextProfile] = await Promise.all([fetchAvatarCatalog(), fetchAvatarProfile()]);
      setCatalog(nextCatalog);
      setProfile(nextProfile);
      setWalletPoints(nextProfile.points);
    } catch (error) {
      logSafeError('study.avatar.load', error);
      Alert.alert(copy('avatar.connectionTitle'), copy('avatar.loadError'));
    } finally {
      setLoading(false);
    }
  }, [copy]);

  useEffect(() => {
    loadCloset();
  }, [loadCloset]);

  const visibleItems = useMemo(() => catalog.filter(item => item.slot === activeSlot && item.enabled !== false), [catalog, activeSlot]);
  const owned = useMemo(() => new Set(profile.ownedItemIds), [profile.ownedItemIds]);

  const handleItemPress = async (item: AvatarCatalogItem) => {
    setBusyItemId(item.itemId);
    try {
      if (!item.isDefault && !owned.has(item.itemId)) {
        const purchase = await purchaseAvatarItem(item.itemId);
        setProfile(current => ({
          ...current,
          ownedItemIds: purchase.ownedItemIds ?? [...current.ownedItemIds, item.itemId],
        }));
        setWalletPoints(purchase.points ?? walletPoints);
      }

      const equipment = await equipAvatarItem({slot: item.slot, itemId: item.itemId});
      setProfile(current => ({...current, equipped: {...current.equipped, ...equipment.equipped}}));
    } catch (error) {
      logSafeError('study.avatar.apply', error);
      Alert.alert(copy('avatar.applyTitle'), copy('avatar.applyError'));
    } finally {
      setBusyItemId(null);
    }
  };

  return (
    <PageTransition>
      <SafeAreaView style={styles.container}>
        <GlobalHeader />
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel={copy('common.back')}>
            <Icon name="chevron-left" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>{copy('avatar.title')}</Text>
            <Text style={styles.subtitle}>{copy('avatar.subtitle')}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.walletCard}>
                <View>
                  <Text style={styles.walletLabel}>{copy('avatar.points')}</Text>
                  <Text style={styles.walletMeta}>{copy('avatar.spendable')}</Text>
                </View>
                <Text style={styles.walletAmount}>{walletPoints?.spendable_points ?? 0}</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotRow}>
              {AVATAR_CLOSET_SLOTS.map(slot => {
                const active = activeSlot === slot.id;
                return (
                  <TouchableOpacity key={slot.id} style={[styles.slotButton, active && styles.slotButtonActive]} onPress={() => setActiveSlot(slot.id)}>
                    <Icon name={slot.icon} size={20} color={active ? '#fff' : COLORS.primary} />
                    <Text style={[styles.slotText, active && styles.slotTextActive]}>{copy(slot.titleKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {visibleItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{copy('avatar.empty')}</Text>
              </View>
            ) : (
              visibleItems.map(item => {
                const isOwned = item.isDefault || owned.has(item.itemId);
                const equipped = profile.equipped[item.slot] === item.itemId;
                return (
                  <TouchableOpacity key={item.itemId} style={styles.itemCard} onPress={() => handleItemPress(item)} disabled={busyItemId === item.itemId || equipped}>
                    <View style={styles.itemIcon}>
                      <Icon name={equipped ? 'check-circle' : isOwned ? 'hanger' : 'lock-outline'} size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.itemBody}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemMeta}>
                        {isOwned ? copy('avatar.owned') : copy('avatar.pointsCost', {points: item.costPoints})}
                      </Text>
                    </View>
                    <Text style={styles.itemAction}>
                      {equipped ? copy('avatar.equipped') : isOwned ? copy('avatar.equip') : copy('avatar.buy')}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </PageTransition>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  topRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md},
  backButton: {width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface},
  title: {color: COLORS.text, fontSize: 24, fontWeight: '900'},
  subtitle: {color: COLORS.textMuted, fontSize: 12, marginTop: 2},
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  content: {padding: SPACING.lg, paddingBottom: SPACING.xl},
  walletCard: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderRadius: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md},
  walletLabel: {color: COLORS.text, fontSize: 14, fontWeight: '900'},
  walletMeta: {color: COLORS.textMuted, fontSize: 11, marginTop: 3},
  walletAmount: {color: COLORS.primary, fontSize: 24, fontWeight: '900'},
  slotRow: {gap: SPACING.sm, paddingBottom: SPACING.md},
  slotButton: {flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, minHeight: 42, paddingHorizontal: SPACING.md, borderRadius: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border},
  slotButtonActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  slotText: {color: COLORS.text, fontSize: 12, fontWeight: '800'},
  slotTextActive: {color: '#fff'},
  emptyCard: {padding: SPACING.lg, borderRadius: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border},
  emptyText: {color: COLORS.textMuted, textAlign: 'center'},
  itemCard: {flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm},
  itemIcon: {width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(227,30,36,0.12)'},
  itemBody: {flex: 1},
  itemTitle: {color: COLORS.text, fontSize: 15, fontWeight: '900'},
  itemMeta: {color: COLORS.textMuted, fontSize: 12, marginTop: 3},
  itemAction: {color: COLORS.primary, fontSize: 12, fontWeight: '900'},
});

export default AvatarClosetScreen;
