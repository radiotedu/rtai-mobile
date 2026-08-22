import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {COLORS, SPACING} from '../theme/theme';
import {useAuth} from '../context/AuthContext';
import {
  ArcadeGame,
  MarketItem,
  fetchGames,
  fetchMarketItems,
} from '../services/gamificationService';
import {BUILTIN_GAMES, getGameRouteForSlug, isPracticeGame} from './games/gameRoutes';
import {screenCopy} from '../i18n/screenCopy';
import {gameListCopy} from '../i18n/gameListCopy';
import {logSafeError} from '../utils/safeLog';

const GamesScreen = () => {
  const navigation = useNavigation<any>();
  const {i18n} = useTranslation();
  const copy = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      screenCopy(i18n.language, key, values),
    [i18n.language],
  );
  const {user} = useAuth();
  const [games, setGames] = useState<ArcadeGame[]>([]);
  const [market, setMarket] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isAccountRequired = !user || user.is_guest;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextGames, nextMarket] = await Promise.all([
        user ? fetchGames() : Promise.resolve([]),
        user ? fetchMarketItems() : Promise.resolve([]),
      ]);
      setGames(nextGames);
      setMarket(nextMarket);
    } catch (error) {
      logSafeError('games.load', error);
      Alert.alert(copy('home.errorTitle'), copy('games.empty'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [copy, user]);

  useEffect(() => {
    load();
  }, [load]);

  // Always show the games bundled in the app, enriched with the backend record
  // (real id + daily point limit) when the slug exists on the server. This is
  // why the list no longer reads "no active games on the server" when the
  // arcade-games registry is empty.
  const displayGames = useMemo<ArcadeGame[]>(() => {
    const serverBySlug = new Map(
      games.filter(g => !!g.slug).map(g => [g.slug as string, g]),
    );
    const builtins: ArcadeGame[] = BUILTIN_GAMES.map(b => {
      const server = serverBySlug.get(b.slug);
      return {
        id: server?.id ?? `builtin:${b.slug}`,
        slug: b.slug,
        title: server?.title ?? b.title,
        description: server?.description ?? b.description,
        daily_point_limit: server?.daily_point_limit ?? b.daily_point_limit,
      };
    });
    const builtinSlugs = new Set(BUILTIN_GAMES.map(b => b.slug));
    const extras = games.filter(g => g.slug && !builtinSlugs.has(g.slug));
    return [...builtins, ...extras];
  }, [games]);

  const handlePlay = (game: ArcadeGame) => {
    if (isAccountRequired && !isPracticeGame(game)) {
      Alert.alert(copy('study.loginRequired'), copy('games.account'));
      return;
    }

    const routeName = getGameRouteForSlug(game.slug);
    if (!routeName) {
      Alert.alert(copy('games.soon'), copy('games.soon'));
      return;
    }

    navigation.navigate(routeName, {game});
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevron-left" size={30} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navbarTitle}>{copy('games.title')}</Text>
        <View style={styles.navbarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Icon name="gamepad-variant" size={34} color="#111" />
          <Text style={styles.title}>{copy('games.heroTitle')}</Text>
          <Text style={styles.subtitle}>
            {copy('games.heroSubtitle')}
          </Text>
        </View>

        {isAccountRequired ? (
          <View style={styles.accountCard}>
            <Icon name="lock-outline" size={24} color={COLORS.primary} />
            <Text style={styles.accountText}>{copy('games.account')}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{copy('games.active')}</Text>
        {loading && !refreshing ? (
          <ActivityIndicator color={COLORS.primary} style={styles.loader} />
        ) : displayGames.length === 0 ? (
          <Empty text={copy('games.empty')} />
        ) : (
          displayGames.map((game) => (
            <View key={game.id} style={styles.gameCard}>
              <View style={styles.gameIcon}>
                <Icon name={getGameIcon(game.slug)} size={28} color={COLORS.primary} />
              </View>
              <View style={styles.gameBody}>
                {(() => {
                  const localized = gameListCopy(game.slug, i18n.language, {
                    title: game.title,
                    description: game.description ?? '',
                  });
                  return (
                    <>
                      <Text style={styles.gameTitle}>{localized.title}</Text>
                      {localized.description ? <Text style={styles.gameDescription} numberOfLines={2}>{localized.description}</Text> : null}
                    </>
                  );
                })()}
                <View style={styles.gameMetaRow}>
                  <Text style={styles.gameMeta}>
                    {isPracticeGame(game)
                      ? copy('games.practiceNoRewards')
                      : copy('games.dailyLimit', {points: game.daily_point_limit ?? 0})}
                  </Text>
                  <Text style={styles.gameMeta}>{copy('games.slug', {slug: game.slug || '—'})}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.playButton, !getGameRouteForSlug(game.slug) && styles.disabledButton]}
                  onPress={() => handlePlay(game)}
                  activeOpacity={0.82}>
                  <Text style={styles.playButtonText}>
                    {getGameRouteForSlug(game.slug) ? copy('games.play') : copy('games.soon')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <View style={styles.marketHeader}>
          <Text style={styles.sectionTitle}>{copy('games.market')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Market')}>
            <Text style={styles.marketLink}>{copy('games.all')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {market.slice(0, 8).map((item) => (
            <View key={item.id} style={styles.marketCard}>
              <Text style={styles.marketTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.marketCost}>{item.cost_points} Gold</Text>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
};

function getGameIcon(slug?: string) {
  if (slug === 'snake') {
    return 'snake';
  }
  if (slug === 'memory') {
    return 'cards-outline';
  }
  if (slug === 'tetris') {
    return 'view-grid-plus-outline';
  }
  if (slug === 'rhythm-tap') {
    return 'music-note-eighth';
  }
  if (slug === 'word-guess') {
    return 'head-question-outline';
  }
  return 'controller-classic';
}

function Empty({text}: {text: string}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  navbar: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm},
  backButton: {width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)'},
  navbarTitle: {color: COLORS.text, fontSize: 18, fontWeight: '900'},
  navbarSpacer: {width: 44},
  content: {padding: SPACING.lg, paddingBottom: SPACING.xl},
  hero: {borderRadius: 28, padding: SPACING.lg, backgroundColor: '#F4C542'},
  title: {color: '#111', fontSize: 26, fontWeight: '900', lineHeight: 32, marginTop: SPACING.md},
  subtitle: {color: 'rgba(0,0,0,0.68)', fontSize: 14, lineHeight: 21, marginTop: SPACING.sm, fontWeight: '600'},
  accountCard: {flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', padding: SPACING.md, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginTop: SPACING.lg},
  accountText: {flex: 1, color: COLORS.textMuted, fontSize: 13, lineHeight: 18},
  sectionTitle: {color: COLORS.text, fontSize: 19, fontWeight: '900', marginTop: SPACING.xl, marginBottom: SPACING.sm},
  loader: {paddingVertical: SPACING.lg},
  gameCard: {flexDirection: 'row', gap: SPACING.md, padding: SPACING.md, borderRadius: 22, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm},
  gameIcon: {width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(227,30,36,0.12)'},
  gameBody: {flex: 1},
  gameTitle: {color: COLORS.text, fontSize: 17, fontWeight: '900'},
  gameDescription: {color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4},
  gameMetaRow: {flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm},
  gameMeta: {color: COLORS.textMuted, fontSize: 11, fontWeight: '700'},
  playButton: {height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, marginTop: SPACING.md},
  playButtonText: {color: '#fff', fontSize: 13, fontWeight: '900'},
  disabledButton: {opacity: 0.6},
  marketHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  marketLink: {color: COLORS.primary, fontSize: 13, fontWeight: '900', marginTop: SPACING.xl, marginBottom: SPACING.sm},
  marketCard: {width: 130, minHeight: 96, padding: SPACING.md, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginRight: SPACING.sm},
  marketTitle: {color: COLORS.text, fontSize: 13, fontWeight: '800', minHeight: 38},
  marketCost: {color: COLORS.primary, fontWeight: '900', marginTop: SPACING.sm},
  empty: {padding: SPACING.lg, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border},
  emptyText: {color: COLORS.textMuted, textAlign: 'center', lineHeight: 20},
});

export default GamesScreen;
