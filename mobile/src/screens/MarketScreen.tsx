import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {COLORS, SPACING} from '../theme/theme';
import {useAuth} from '../context/AuthContext';
import {useTranslation} from 'react-i18next';
import {appCopy} from '../i18n/appCopy';
import {
  GamificationPoints,
  MarketItem,
  fetchGamificationMe,
  fetchMarketItems,
  redeemMarketItem,
} from '../services/gamificationService';
import {logSafeError} from '../utils/safeLog';

const MarketScreen = () => {
  const navigation = useNavigation<any>();
  const {user} = useAuth();
  const {i18n} = useTranslation();
  const copy = useCallback((key: string, values: Record<string, string | number> = {}) => appCopy(i18n.language, key, values), [i18n.language]);
  const [items, setItems] = useState<MarketItem[]>([]);
  const [points, setPoints] = useState<GamificationPoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const redemptionKeys = useRef<Record<string, string>>({});
  const isAccountRequired = !user || user.is_guest;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [marketItems, profile] = await Promise.all([
        user ? fetchMarketItems() : Promise.resolve([]),
        user ? fetchGamificationMe() : Promise.resolve(null),
      ]);
      setItems(marketItems);
      setPoints((profile as any)?.points ?? null);
    } catch (error) {
      logSafeError('market.load', error);
      Alert.alert(copy('common.error'), copy('market.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [copy, user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRedeem = async (item: MarketItem) => {
    if (isAccountRequired) {
      Alert.alert(copy('market.required'), copy('market.requiredText'));
      return;
    }

    const idempotencyKey = redemptionKeys.current[item.id]
      ?? `market:${item.id}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    redemptionKeys.current[item.id] = idempotencyKey;
    setRedeemingId(item.id);
    try {
      const result = await redeemMarketItem(item.id, idempotencyKey);
      delete redemptionKeys.current[item.id];
      setPoints((current) => ({
        ...(current ?? {lifetime_points: 0, spendable_points: 0}),
        spendable_points: Number(result?.spendable_points ?? current?.spendable_points ?? 0),
      }));
      Alert.alert(copy('market.requested'), copy('market.requestedText'));
    } catch (error: any) {
      logSafeError('market.redeem', error);
      Alert.alert(copy('common.error'), copy('market.error'));
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevron-left" size={30} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navbarTitle}>{copy('market.title')}</Text>
        <View style={styles.navbarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        showsVerticalScrollIndicator={false}>
        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Gold</Text>
          <Text style={styles.walletValue}>{points?.spendable_points ?? 0}</Text>
          <Text style={styles.walletText}>{copy('leaderboard.lifetime')}</Text>
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator color={COLORS.primary} style={styles.loader} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{copy('market.empty')}</Text>
          </View>
        ) : (
          items.map((item) => {
            const isRedeeming = redeemingId === item.id;
            const canAfford = (points?.spendable_points ?? 0) >= Number(item.cost_points ?? 0);
            return (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemIcon}>
                  <Icon name={getItemIcon(item)} size={26} color={COLORS.primary} />
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.description ? <Text style={styles.itemDescription} numberOfLines={3}>{item.description}</Text> : null}
                  <View style={styles.itemFooter}>
                <Text style={styles.itemCost}>{item.cost_points} Gold</Text>
                    <TouchableOpacity
                      style={[styles.redeemButton, (!canAfford || isAccountRequired || isRedeeming) && styles.disabledButton]}
                      disabled={!canAfford || isAccountRequired || isRedeeming}
                      onPress={() => handleRedeem(item)}>
                      <Text style={styles.redeemButtonText}>
                        {isAccountRequired ? copy('market.required') : isRedeeming ? copy('events.claiming') : canAfford ? copy('events.claim') : copy('market.insufficient')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

function getItemIcon(item: MarketItem) {
  if (item.item_kind === 'badge') {
    return 'shield-star-outline';
  }
  if (item.item_kind === 'coupon') {
    return 'ticket-percent-outline';
  }
  if (item.item_kind === 'physical') {
    return 'gift-outline';
  }
  return 'shopping-outline';
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  navbar: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm},
  backButton: {width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)'},
  navbarTitle: {color: COLORS.text, fontSize: 18, fontWeight: '900'},
  navbarSpacer: {width: 44},
  content: {padding: SPACING.lg, paddingBottom: SPACING.xl},
  walletCard: {borderRadius: 28, padding: SPACING.lg, backgroundColor: '#2A0709', borderWidth: 1, borderColor: 'rgba(227,30,36,0.4)'},
  walletLabel: {color: COLORS.textMuted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1},
  walletValue: {color: COLORS.text, fontSize: 52, fontWeight: '900', marginTop: SPACING.xs},
  walletText: {color: COLORS.textMuted, fontSize: 13, lineHeight: 19},
  loader: {paddingVertical: SPACING.xl},
  itemCard: {flexDirection: 'row', gap: SPACING.md, padding: SPACING.md, borderRadius: 22, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, marginTop: SPACING.md},
  itemIcon: {width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(227,30,36,0.12)'},
  itemBody: {flex: 1},
  itemTitle: {color: COLORS.text, fontSize: 17, fontWeight: '900'},
  itemDescription: {color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4},
  itemFooter: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md},
  itemCost: {color: COLORS.primary, fontSize: 15, fontWeight: '900'},
  redeemButton: {backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm},
  redeemButtonText: {color: '#fff', fontSize: 13, fontWeight: '900'},
  disabledButton: {opacity: 0.5},
  empty: {padding: SPACING.lg, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginTop: SPACING.lg},
  emptyText: {color: COLORS.textMuted, textAlign: 'center'},
});

export default MarketScreen;
