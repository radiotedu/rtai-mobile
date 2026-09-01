import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import GlobalHeader from '../components/GlobalHeader';
import PageTransition from '../components/PageTransition';
import {COLORS, SPACING} from '../theme/theme';
import api from '../services/api';
import {STORAGE_API} from '../services/config';
import {MarketItem, fetchMarketItems} from '../services/gamificationService';
import {useTranslation} from 'react-i18next';
import {appCopy} from '../i18n/appCopy';
import {screenCopy} from '../i18n/screenCopy';
import {logSafeError} from '../utils/safeLog';

type LeaderboardPeriod = 'total' | 'monthly';
type LeaderboardCategory = 'total' | 'listening' | 'events' | 'games' | 'social' | 'jukebox';

const categories: Array<{value: LeaderboardCategory; key: string}> = [
  {value: 'total', key: 'leaderboard.category.total'},
  {value: 'jukebox', key: 'leaderboard.category.jukebox'},
  {value: 'listening', key: 'leaderboard.category.listening'},
  {value: 'events', key: 'leaderboard.category.events'},
  {value: 'games', key: 'leaderboard.category.games'},
  {value: 'social', key: 'leaderboard.category.social'},
];

const LeaderboardScreen = () => {
  const navigation = useNavigation<any>();
  const {i18n} = useTranslation();
  const copy = (key: string, values: Record<string, string | number> = {}) => {
    const screenValue = screenCopy(i18n.language, key, values);
    return screenValue === key ? appCopy(i18n.language, key, values) : screenValue;
  };
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [market, setMarket] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<LeaderboardPeriod>('total');
  const [category, setCategory] = useState<LeaderboardCategory>('total');
  const requestSeqRef = useRef(0);

  useEffect(() => {
    fetchLeaderboard(period, category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, category]);

  useEffect(() => {
    fetchMarketItems()
      .then(setMarket)
      .catch((error) => logSafeError('leaderboard.market', error));
  }, []);

  const fetchLeaderboard = async (
    nextPeriod: LeaderboardPeriod = period,
    nextCategory: LeaderboardCategory = category,
  ) => {
    const requestSeq = ++requestSeqRef.current;
    setLoading(true);

    try {
      const response = await api.get('/users/leaderboard', {
        params: {
          period: nextPeriod,
          category: nextCategory,
        },
      });

      if (requestSeq !== requestSeqRef.current) {
        return;
      }

      setLeaderboard(response.data.data.leaderboard || []);
    } catch (error) {
      logSafeError('leaderboard.load', error);
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard(period, category);
  };

  const renderItem = ({item, index}: {item: any; index: number}) => {
    let rankColor = COLORS.text;
    let rankIcon = null;

    if (index === 0) {
      rankColor = '#FFD700';
      rankIcon = 'crown';
    } else if (index === 1) {
      rankColor = '#C0C0C0';
      rankIcon = 'medal';
    } else if (index === 2) {
      rankColor = '#CD7F32';
      rankIcon = 'medal-outline';
    }

    return (
      <View style={styles.itemContainer}>
        <View style={styles.rankContainer}>
          {rankIcon ? (
            <Icon name={rankIcon} size={24} color={rankColor} />
          ) : (
            <Text style={styles.rankText}>{index + 1}</Text>
          )}
        </View>

        <LeaderboardAvatar avatarUrl={item.avatar_url} displayName={item.display_name} />

        <View style={styles.infoContainer}>
          <Text style={styles.name}>{item.display_name || copy('profile.guest')}</Text>
          <Text style={styles.songsAdded}>{item.total_songs_added ?? 0} {copy('leaderboard.songs')} · {item.monthly_rank_score ?? 0} {copy('leaderboard.monthly')}</Text>
        </View>

        <View style={styles.pointsContainer}>
          <Text style={styles.points}>{item.score ?? item.monthly_rank_score ?? item.rank_score ?? 0}</Text>
          <Text style={styles.pointsLabel}>{copy('leaderboard.lifetime')}</Text>
        </View>
      </View>
    );
  };

  return (
    <PageTransition>
      <SafeAreaView style={styles.container}>
        <GlobalHeader />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{copy('leaderboard.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {copy('leaderboard.subtitle')}
          </Text>
          <View style={styles.periodToggle}>
            {(['total', 'monthly'] as const).map((value) => (
              <TouchableOpacity
                key={value}
                onPress={() => setPeriod(value)}
                style={[
                  styles.periodButton,
                  period === value && styles.periodButtonActive,
                ]}>
                <Text
                  style={[
                    styles.periodButtonText,
                    period === value && styles.periodButtonTextActive,
                  ]}>
                  {value === 'monthly' ? copy('leaderboard.monthly') : copy('leaderboard.lifetime')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {categories.map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => setCategory(item.value)}
                style={[styles.categoryChip, category === item.value && styles.categoryChipActive]}>
                <Text style={[styles.categoryChipText, category === item.value && styles.categoryChipTextActive]}>
                  {copy(item.key)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={leaderboard}
            renderItem={renderItem}
            keyExtractor={(item, index) => String(item.id ?? index)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              <View style={styles.marketBlock}>
                <View style={styles.marketHeader}>
                  <Text style={styles.marketTitle}>{copy('leaderboard.market')}</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Market')}>
                    <Text style={styles.marketAction}>{copy('market.title')}</Text>
                  </TouchableOpacity>
                </View>
                {market.slice(0, 4).map((item) => (
                  <View key={item.id} style={styles.rewardRow}>
                    <Icon name="shopping-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.rewardText} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.rewardCost}>{item.cost_points} Gold</Text>
                  </View>
                ))}
              </View>
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
            }
          />
        )}
      </SafeAreaView>
    </PageTransition>
  );
};

function LeaderboardAvatar({avatarUrl, displayName}: {avatarUrl?: string | null; displayName?: string}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const resolvedUrl = resolveLeaderboardAvatarUrl(avatarUrl);

  useEffect(() => {
    setLoadFailed(false);
  }, [resolvedUrl]);

  if (resolvedUrl && !loadFailed) {
    return (
      <Image
        source={{uri: resolvedUrl}}
        style={styles.avatar}
        onError={() => setLoadFailed(true)}
      />
    );
  }

  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarInitials}>{getLeaderboardInitials(displayName ?? '')}</Text>
    </View>
  );
}

function resolveLeaderboardAvatarUrl(value?: string | null): string | null {
  const avatar = value?.trim();
  if (!avatar) {
    return null;
  }
  if (/^https?:\/\//i.test(avatar)) {
    return avatar;
  }
  return `${STORAGE_API.replace(/\/$/, '')}/${avatar.replace(/^\//, '')}`;
}

export function getLeaderboardInitials(value: string): string {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => Array.from(part)[0] ?? '')
    .join('');
  return (initials || 'R').toLocaleUpperCase();
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {fontSize: 24, fontWeight: '900', color: COLORS.text},
  headerSubtitle: {fontSize: 14, color: COLORS.textMuted, marginTop: 4},
  periodToggle: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING.md,
  },
  periodButton: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  categoryRow: {
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  categoryChip: {
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: 'rgba(227,30,36,0.18)',
    borderColor: COLORS.primary,
  },
  categoryChipText: {color: COLORS.textMuted, fontSize: 12, fontWeight: '800'},
  categoryChipTextActive: {color: COLORS.text},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  listContent: {padding: SPACING.md, paddingBottom: 100},
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  rankText: {fontSize: 18, fontWeight: 'bold', color: COLORS.textMuted},
  avatar: {width: 40, height: 40, borderRadius: 20, marginRight: SPACING.md},
  avatarFallback: {alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(227,30,36,0.18)'},
  avatarInitials: {color: COLORS.text, fontSize: 14, fontWeight: '900'},
  infoContainer: {flex: 1},
  name: {fontSize: 16, fontWeight: 'bold', color: COLORS.text},
  songsAdded: {fontSize: 12, color: COLORS.textMuted, marginTop: 2},
  pointsContainer: {alignItems: 'flex-end'},
  points: {fontSize: 16, fontWeight: 'bold', color: COLORS.primary},
  pointsLabel: {fontSize: 10, color: COLORS.textMuted},
  marketBlock: {marginTop: SPACING.lg, padding: SPACING.md, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border},
  marketHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm},
  marketTitle: {color: COLORS.text, fontSize: 17, fontWeight: '900'},
  marketAction: {color: COLORS.primary, fontSize: 13, fontWeight: '900'},
  rewardRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm},
  rewardText: {flex: 1, color: COLORS.text, fontSize: 13, fontWeight: '700'},
  rewardCost: {color: COLORS.primary, fontWeight: '900'},
});

export default LeaderboardScreen;
