import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  useWindowDimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../theme/theme';

export type WrappedPeriod = 'monthly' | 'annual';

export interface WrappedTopStation {
  id?: string;
  name: string;
  color: string;
  percentage?: number;
  minutes?: number;
}

export interface WrappedStats {
  totalMinutes?: number;
  monthlyMinutes?: number;
  annualMinutes?: number;
  topStation?: WrappedTopStation | null;
  goldEarned?: number;
  monthlyGold?: number;
  annualGold?: number;
  peakTimeCategory?: 'night' | 'morning' | 'afternoon' | 'evening';
  favoriteTimeBadge?: string;
  period?: WrappedPeriod;
}

export interface WrappedModalProps {
  visible: boolean;
  onClose: () => void;
  stats?: WrappedStats | null;
  listeningStats?: any;
  user?: {
    display_name?: string;
    gold_balance?: number;
    monthly_rank_score?: number;
    rank_score?: number;
    is_guest?: boolean;
  } | null;
  initialPeriod?: WrappedPeriod;
}

export interface FavoriteTimeBadgeInfo {
  badge: 'Gece Baykuşu' | 'Sabah Savaşçısı' | string;
  icon: string;
  label: string;
  description: string;
  timeRange: string;
}

/**
 * Maps peak listening hours to official RadioTEDU Wrapped badges:
 * - Night (22:00 - 05:00) / Evening -> "Gece Baykuşu"
 * - Morning (05:00 - 11:00) / Day -> "Sabah Savaşçısı"
 */
export function getFavoriteTimeBadge(
  category?: string,
  language: string = 'tr',
): FavoriteTimeBadgeInfo {
  const isTr = !language || language.startsWith('tr');
  const isMorning = category === 'morning' || category === 'afternoon';

  if (isMorning) {
    return {
      badge: isTr ? 'Sabah Savaşçısı' : 'Morning Warrior',
      icon: 'weather-sunset-up',
      label: isTr ? 'Sabah Savaşçısı' : 'Morning Warrior',
      description: isTr
        ? 'Güne müzikle başlayan enerjik dinleyici'
        : 'Energetic listener starting the day with music',
      timeRange: '05:00 – 11:00',
    };
  }

  return {
    badge: isTr ? 'Gece Baykuşu' : 'Night Owl',
    icon: 'owl',
    label: isTr ? 'Gece Baykuşu' : 'Night Owl',
    description: isTr
      ? 'Gece geç saatlerde müziğin ritmini yakalayan dinleyici'
      : 'Catching the rhythm deep into the night',
    timeRange: '22:00 – 05:00',
  };
}

export interface ShareMessageParams {
  period?: WrappedPeriod;
  minutes: number;
  stationName: string;
  gold: number;
  badge: string;
  language?: string;
}

/**
 * Builds localized text and official RadioTEDU hashtags for social story sharing.
 */
export function buildWrappedShareMessage({
  period = 'monthly',
  minutes = 0,
  stationName = 'RadioTEDU',
  gold = 0,
  badge = 'Gece Baykuşu',
  language = 'tr',
}: ShareMessageParams): { message: string; title: string } {
  const isTr = !language || language.startsWith('tr');
  const periodLabel =
    period === 'annual'
      ? isTr
        ? '2026 Yıllık'
        : '2026 Annual'
      : isTr
      ? 'Aylık'
      : 'Monthly';

  const title = isTr
    ? `RadioTEDU Wrapped (${periodLabel} Dinleme Karnem)`
    : `RadioTEDU Wrapped (${periodLabel} Recap)`;

  const message = isTr
    ? `🎉 RadioTEDU Wrapped (${periodLabel} Dinleme Karnem)!\n\n` +
      `⏱️ Toplam Dinleme: ${minutes.toLocaleString('tr-TR')} dakika\n` +
      `📻 En Çok Dinlenen: ${stationName}\n` +
      `🪙 Kazanılan Gold: ${gold.toLocaleString('tr-TR')}\n` +
      `🦉 Dinleme Rozetim: ${badge}\n\n` +
      `Sen de dinleme karneni keşfet ve canlı yayına katıl: https://radiotedu.com\n\n` +
      `#RadioTEDU #RadioTEDUWrapped #TEDU #DinlemeKarnem`
    : `🎉 RadioTEDU Wrapped (${periodLabel} Recap)!\n\n` +
      `⏱️ Total Listening: ${minutes.toLocaleString('en-US')} minutes\n` +
      `📻 Top Station: ${stationName}\n` +
      `🪙 Gold Earned: ${gold.toLocaleString('en-US')}\n` +
      `🦉 Listening Badge: ${badge}\n\n` +
      `Discover your listening recap and tune in: https://radiotedu.com\n\n` +
      `#RadioTEDU #RadioTEDUWrapped #TEDU #DinlemeKarnem`;

  return { message, title };
}

export const WrappedModal: React.FC<WrappedModalProps> = ({
  visible,
  onClose,
  stats,
  listeningStats,
  user,
  initialPeriod = 'monthly',
}) => {
  const { i18n } = useTranslation();
  const [period, setPeriod] = useState<WrappedPeriod>(initialPeriod);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Responsive 9:16 aspect ratio calculation tailored for Instagram Stories & WhatsApp Status
  const cardMetrics = useMemo(() => {
    const maxCardHeight = Math.min(windowHeight * 0.82, 640);
    const maxCardWidth = Math.min(windowWidth * 0.92, 360);
    let h = Math.min(maxCardHeight, maxCardWidth * (16 / 9));
    let w = h * (9 / 16);
    if (w > maxCardWidth) {
      w = maxCardWidth;
      h = w * (16 / 9);
    }
    return { width: Math.round(w), height: Math.round(h) };
  }, [windowWidth, windowHeight]);

  // Resolve active metrics based on period and available data
  const currentMinutes = useMemo(() => {
    if (stats?.totalMinutes !== undefined) {
      return stats.totalMinutes;
    }
    if (period === 'monthly') {
      if (stats?.monthlyMinutes !== undefined) return stats.monthlyMinutes;
      const weekly = listeningStats?.totalMinutesThisWeek || 0;
      return weekly > 0 ? Math.max(weekly * 4, weekly) : 0;
    } else {
      if (stats?.annualMinutes !== undefined) return stats.annualMinutes;
      return (
        listeningStats?.totalMinutesAllTime ||
        listeningStats?.totalMinutesThisWeek ||
        0
      );
    }
  }, [period, stats, listeningStats]);

  const topStation: WrappedTopStation = useMemo(() => {
    if (stats?.topStation) {
      return stats.topStation;
    }
    if (listeningStats?.topGenre) {
      return {
        id: listeningStats.topGenre.id,
        name: listeningStats.topGenre.name || 'RadioTEDU',
        color: listeningStats.topGenre.color || '#E31E24',
        percentage: listeningStats.topGenre.percentage || 100,
        minutes: listeningStats.topGenre.minutes || 0,
      };
    }
    return {
      id: 'radiotedu-main',
      name: 'RadioTEDU',
      color: '#E31E24',
      percentage: 100,
      minutes: currentMinutes,
    };
  }, [stats, listeningStats, currentMinutes]);

  const currentGold = useMemo(() => {
    if (stats?.goldEarned !== undefined) {
      return stats.goldEarned;
    }
    if (period === 'monthly') {
      return (
        stats?.monthlyGold ??
        user?.monthly_rank_score ??
        user?.gold_balance ??
        0
      );
    } else {
      return (
        stats?.annualGold ??
        user?.rank_score ??
        user?.gold_balance ??
        0
      );
    }
  }, [period, stats, user]);

  const peakCategory = stats?.peakTimeCategory || listeningStats?.peakTimeCategory || 'night';
  const badgeInfo = useMemo(() => {
    if (stats?.favoriteTimeBadge) {
      return {
        badge: stats.favoriteTimeBadge,
        icon: stats.favoriteTimeBadge.includes('Sabah') ? 'weather-sunset-up' : 'owl',
        label: stats.favoriteTimeBadge,
        description: stats.favoriteTimeBadge.includes('Sabah')
          ? 'Güne müzikle başlayan enerjik dinleyici'
          : 'Gece geç saatlerde müziğin ritmini yakalayan dinleyici',
        timeRange: stats.favoriteTimeBadge.includes('Sabah') ? '05:00 – 11:00' : '22:00 – 05:00',
      };
    }
    return getFavoriteTimeBadge(peakCategory, i18n.language);
  }, [stats?.favoriteTimeBadge, peakCategory, i18n.language]);

  const handleNativeShare = async () => {
    try {
      const { message, title } = buildWrappedShareMessage({
        period,
        minutes: currentMinutes,
        stationName: topStation.name,
        gold: currentGold,
        badge: badgeInfo.badge,
        language: i18n.language || 'tr',
      });

      await Share.share(
        Platform.OS === 'ios'
          ? { message, title }
          : { message, title },
        { dialogTitle: title },
      );
    } catch {
      // User cancelled share
    }
  };

  const isTr = !i18n.language || i18n.language.startsWith('tr');
  const hoursEquivalent = Math.floor(currentMinutes / 60);
  const minutesRemainder = currentMinutes % 60;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="wrapped-modal"
    >
      <View style={styles.overlay}>
        <View style={styles.modalContentWrapper}>
          {/* Top Dismiss Bar */}
          <View style={[styles.headerDismissBar, { width: cardMetrics.width }]}>
            <Text style={styles.headerDismissTitle}>
              {isTr ? 'Dinleme Karnem' : 'Listening Recap'}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeCircleButton}
              activeOpacity={0.7}
              testID="wrapped-close-button"
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
            >
              <Icon name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Period Selector Tabs */}
          <View style={[styles.periodSelectorBar, { width: cardMetrics.width }]}>
            <TouchableOpacity
              style={[
                styles.periodTab,
                period === 'monthly' && styles.periodTabActive,
              ]}
              onPress={() => setPeriod('monthly')}
              activeOpacity={0.8}
              testID="wrapped-period-monthly"
            >
              <Text
                style={[
                  styles.periodTabText,
                  period === 'monthly' && styles.periodTabTextActive,
                ]}
              >
                {isTr ? 'Bu Ay (Aylık)' : 'This Month'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.periodTab,
                period === 'annual' && styles.periodTabActive,
              ]}
              onPress={() => setPeriod('annual')}
              activeOpacity={0.8}
              testID="wrapped-period-annual"
            >
              <Text
                style={[
                  styles.periodTabText,
                  period === 'annual' && styles.periodTabTextActive,
                ]}
              >
                {isTr ? '2026 (Yıllık)' : '2026 Annual'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 9:16 Visual Recap Card */}
          <View
            style={[
              styles.cardContainer,
              { width: cardMetrics.width, height: cardMetrics.height },
            ]}
            testID="wrapped-card"
          >
            {/* Ambient Glow Circles */}
            <View
              style={[
                styles.ambientGlowTop,
                { backgroundColor: topStation.color || COLORS.primary },
              ]}
            />
            <View style={styles.ambientGlowBottom} />

            <ScrollView
              contentContainerStyle={styles.cardScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Card Masthead */}
              <View style={styles.mastheadRow}>
                <View style={styles.brandBadge}>
                  <Icon name="radio-tower" size={14} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={styles.brandTitleText}>RadioTEDU</Text>
                </View>
                <View style={styles.editionTag}>
                  <Text style={styles.editionTagText}>
                    {period === 'annual' ? '2026 WRAPPED' : 'AYLIK WRAPPED'}
                  </Text>
                </View>
              </View>

              {/* User Persona Greeting */}
              <View style={styles.greetingSection}>
                <Text style={styles.greetingName} numberOfLines={1}>
                  {user?.display_name || (isTr ? 'RadioTEDU Dinleyicisi' : 'RadioTEDU Listener')}
                </Text>
                <Text style={styles.greetingSubtitle}>
                  {isTr
                    ? 'İşte senin kişisel dinleme yolculuğun'
                    : 'Your personalized sound journey'}
                </Text>
              </View>

              {/* Total Listening Minutes Block */}
              <View style={styles.minutesCard} testID="wrapped-total-minutes">
                <View style={styles.minutesBadgeRow}>
                  <Icon name="clock-fast" size={16} color="#FFD700" style={{ marginRight: 4 }} />
                  <Text style={styles.minutesBadgeText}>
                    {isTr ? 'TOPLAM DİNLEME' : 'TOTAL TIME'}
                  </Text>
                </View>
                <Text
                  style={styles.minutesNumber}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {currentMinutes.toLocaleString(isTr ? 'tr-TR' : 'en-US')}
                </Text>
                <Text style={styles.minutesLabel}>
                  {isTr ? 'DAKİKA RADYO DİNLENDİ' : 'MINUTES OF RADIO'}
                </Text>
                {hoursEquivalent > 0 && (
                  <Text style={styles.hoursDetail}>
                    {isTr
                      ? `(${hoursEquivalent} saat ${minutesRemainder} dakika kesintisiz)`
                      : `(${hoursEquivalent} hrs ${minutesRemainder} mins uninterrupted)`}
                  </Text>
                )}
              </View>

              {/* Top Station Block with Dynamic Branded Accent */}
              <View
                style={[
                  styles.stationCard,
                  { borderColor: topStation.color || COLORS.primary },
                ]}
                testID="wrapped-top-station"
              >
                <View style={styles.stationTopRow}>
                  <View
                    style={[
                      styles.stationDot,
                      { backgroundColor: topStation.color || COLORS.primary },
                    ]}
                  />
                  <Text style={styles.stationKicker}>
                    {isTr ? '1 NUMARALI İSTASYON' : '#1 TOP STATION'}
                  </Text>
                  {topStation.percentage !== undefined && (
                    <View
                      style={[
                        styles.percentageBadge,
                        { backgroundColor: topStation.color || COLORS.primary },
                      ]}
                    >
                      <Text style={styles.percentageText}>%{topStation.percentage}</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.stationName,
                    { color: topStation.color || '#FFFFFF' },
                  ]}
                  numberOfLines={1}
                >
                  {topStation.name}
                </Text>
              </View>

              {/* Dual Stat Tiles: Gold Earned & Favorite Listening Time */}
              <View style={styles.dualTilesRow}>
                {/* Gold Earned Tile */}
                <View style={styles.statTile} testID="wrapped-gold-earned">
                  <View style={styles.tileHeader}>
                    <Icon name="star-circle" size={18} color="#FFD700" />
                    <Text style={styles.tileKicker}>
                      {isTr ? 'GOLD' : 'GOLD'}
                    </Text>
                  </View>
                  <Text style={styles.tileValue} numberOfLines={1}>
                    +{currentGold.toLocaleString(isTr ? 'tr-TR' : 'en-US')}
                  </Text>
                  <Text style={styles.tileLabel}>
                    {isTr ? 'Kazanılan Gold' : 'Gold Earned'}
                  </Text>
                </View>

                {/* Favorite Time Badge Tile */}
                <View style={styles.statTile} testID="wrapped-time-badge">
                  <View style={styles.tileHeader}>
                    <Icon
                      name={badgeInfo.icon}
                      size={18}
                      color={badgeInfo.icon === 'owl' ? '#00D2FF' : '#FF9500'}
                    />
                    <Text style={styles.tileKicker}>
                      {badgeInfo.timeRange}
                    </Text>
                  </View>
                  <Text style={styles.tileValue} numberOfLines={1}>
                    {badgeInfo.badge}
                  </Text>
                  <Text style={styles.tileLabel}>
                    {isTr ? 'Dinleme Rozeti' : 'Vibe Badge'}
                  </Text>
                </View>
              </View>

              {/* Card Watermark Footer */}
              <View style={styles.cardFooter}>
                <Text style={styles.footerBrand}>radiotedu.com</Text>
                <Text style={styles.footerNote}>RadioTEDU Ankara Stüdyoları</Text>
              </View>
            </ScrollView>
          </View>

          {/* Bottom Share Action Button */}
          <TouchableOpacity
            style={[styles.shareButton, { width: cardMetrics.width }]}
            onPress={handleNativeShare}
            activeOpacity={0.85}
            testID="wrapped-share-button"
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Hikâyende Paylaş' : 'Share on Story'}
          >
            <Icon name="share-variant" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.shareButtonText}>
              {isTr ? 'Hikâyende Paylaş (Instagram / WhatsApp)' : 'Share on Story & WhatsApp'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default WrappedModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 8, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  modalContentWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDismissBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  headerDismissTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E0E0E6',
    letterSpacing: 0.5,
  },
  closeCircleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  periodSelectorBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  periodTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  periodTabActive: {
    backgroundColor: COLORS.primary,
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A0A0A8',
  },
  periodTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cardContainer: {
    aspectRatio: 9 / 16,
    backgroundColor: 'rgba(18, 18, 26, 0.95)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 170,
    height: 170,
    borderRadius: 85,
    opacity: 0.2,
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.primary,
    opacity: 0.15,
  },
  cardScroll: {
    flexGrow: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  mastheadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(227, 30, 38, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(227, 30, 38, 0.4)',
  },
  brandTitleText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  editionTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  editionTagText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  greetingSection: {
    marginBottom: 12,
  },
  greetingName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontSize: 12,
    color: '#A0A0B0',
    marginTop: 2,
  },
  minutesCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  minutesBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  minutesBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  minutesNumber: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1.5,
  },
  minutesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C0C0D0',
    letterSpacing: 1.2,
    marginTop: -2,
  },
  hoursDetail: {
    fontSize: 10,
    color: '#8A8A9A',
    marginTop: 4,
  },
  stationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 10,
  },
  stationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  stationKicker: {
    color: '#A0A0B0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    flex: 1,
  },
  percentageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  percentageText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  stationName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  dualTilesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  statTile: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    justifyContent: 'center',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tileKicker: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8A8A9A',
  },
  tileValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  tileLabel: {
    fontSize: 10,
    color: '#A0A0B0',
  },
  cardFooter: {
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerBrand: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D0D0E0',
    letterSpacing: 0.8,
  },
  footerNote: {
    fontSize: 9,
    color: '#707080',
    marginTop: 1,
  },
  shareButton: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
