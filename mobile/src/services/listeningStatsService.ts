import AsyncStorage from '@react-native-async-storage/async-storage';
import {RADIO_CHANNELS} from '../data/radioChannels';

export const LISTENING_STATS_KEY = '@radiotedu/listening_stats';

export interface RawListeningStats {
  version: number;
  weekStartTimestamp: number;
  secondsThisWeek: number;
  secondsAllTime: number;
  secondsByStation: Record<string, number>;
  secondsByHour: Record<number, number>; // 0 - 23
  activeDaysThisWeek: string[]; // YYYY-MM-DD
  lastListenedDate: string; // YYYY-MM-DD
}

export interface GenreStatItem {
  id: string;
  name: string;
  color: string;
  minutes: number;
  percentage: number;
}

export type PeakTimeCategory = 'night' | 'morning' | 'afternoon' | 'evening';

export interface ListeningStatsSummary {
  totalMinutesThisWeek: number;
  totalMinutesAllTime: number;
  hoursThisWeek: number;
  minutesRemainderThisWeek: number;
  topGenre: GenreStatItem | null;
  genreBreakdown: GenreStatItem[];
  peakTimeCategory: PeakTimeCategory;
  peakTimeLabel: string;
  daysActiveThisWeek: number;
}

const STATION_GENRE_NAMES: Record<string, string> = {
  'radiotedu-main': 'RadioTEDU Hit',
  'radiotedu-classic': 'Klasik Müzik',
  'radiotedu-jazz': 'Caz & Blues',
  'radiotedu-lofi': 'Lo-Fi & Chill',
  'radiotedu-energize': 'Energize Pop',
  'radiotedu-rock': 'Rock & Alternatif',
};

const STATION_COLORS: Record<string, string> = {
  'radiotedu-main': '#E31E24',
  'radiotedu-classic': '#EAB308',
  'radiotedu-jazz': '#A855F7',
  'radiotedu-lofi': '#06B6D4',
  'radiotedu-energize': '#EAB308',
  'radiotedu-rock': '#F97316',
};

function getWeekStartTimestamp(now: Date = new Date()): number {
  const date = new Date(now);
  const day = date.getDay();
  // Monday is start of week (in JS Sunday is 0, Monday is 1)
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getTodayIso(now: Date = new Date()): string {
  return now.toISOString().split('T')[0];
}

function createDefaultStats(now: Date = new Date()): RawListeningStats {
  return {
    version: 1,
    weekStartTimestamp: getWeekStartTimestamp(now),
    secondsThisWeek: 0,
    secondsAllTime: 0,
    secondsByStation: {},
    secondsByHour: {},
    activeDaysThisWeek: [],
    lastListenedDate: '',
  };
}

/**
 * Normalizes channel IDs by stripping quality and stream variants.
 */
export function normalizeStationId(channelId: string): string {
  const base = channelId.toLowerCase().trim().replace(/-(?:flac|low|normal|high)$/, '');
  if (base.includes('classic')) return 'radiotedu-classic';
  if (base.includes('jazz')) return 'radiotedu-jazz';
  if (base.includes('lofi')) return 'radiotedu-lofi';
  if (base.includes('energize') || base.includes('spark')) return 'radiotedu-energize';
  if (base.includes('rock')) return 'radiotedu-rock';
  return 'radiotedu-main';
}

/**
 * Records listening duration for a station.
 * Strictly anonymous: DOES NOT record song titles or artist information.
 */
export async function recordListeningTime(
  channelId: string,
  durationSeconds: number,
  customNow?: Date,
): Promise<void> {
  if (durationSeconds <= 0 || !channelId) {
    return;
  }
  const now = customNow || new Date();
  const currentWeekStart = getWeekStartTimestamp(now);
  const todayIso = getTodayIso(now);
  const currentHour = now.getHours();
  const normalizedStation = normalizeStationId(channelId);

  try {
    const raw = await AsyncStorage.getItem(LISTENING_STATS_KEY);
    let stats: RawListeningStats = raw ? JSON.parse(raw) : createDefaultStats(now);

    // Reset weekly counts if a new calendar week has started
    if (!stats.weekStartTimestamp || stats.weekStartTimestamp !== currentWeekStart) {
      stats.weekStartTimestamp = currentWeekStart;
      stats.secondsThisWeek = 0;
      stats.activeDaysThisWeek = [];
    }

    stats.secondsThisWeek += durationSeconds;
    stats.secondsAllTime += durationSeconds;

    stats.secondsByStation[normalizedStation] =
      (stats.secondsByStation[normalizedStation] || 0) + durationSeconds;

    stats.secondsByHour[currentHour] =
      (stats.secondsByHour[currentHour] || 0) + durationSeconds;

    if (!stats.activeDaysThisWeek.includes(todayIso)) {
      stats.activeDaysThisWeek.push(todayIso);
    }
    stats.lastListenedDate = todayIso;

    await AsyncStorage.setItem(LISTENING_STATS_KEY, JSON.stringify(stats));
  } catch {
    // Best-effort local tracking
  }
}

/**
 * Determines peak listening time category and label.
 */
export function calculatePeakTime(secondsByHour: Record<number, number>): {
  category: PeakTimeCategory;
  label: string;
} {
  let night = 0; // 22:00 - 04:59
  let morning = 0; // 05:00 - 10:59
  let afternoon = 0; // 11:00 - 16:59
  let evening = 0; // 17:00 - 21:59

  for (const [hourStr, seconds] of Object.entries(secondsByHour)) {
    const h = parseInt(hourStr, 10);
    if (h >= 22 || h < 5) {
      night += seconds;
    } else if (h >= 5 && h < 11) {
      morning += seconds;
    } else if (h >= 11 && h < 17) {
      afternoon += seconds;
    } else {
      evening += seconds;
    }
  }

  const max = Math.max(night, morning, afternoon, evening);
  if (max === 0 || max === night) {
    return {category: 'night', label: 'Gece Kuşu (22:00 - 05:00)'};
  }
  if (max === morning) {
    return {category: 'morning', label: 'Sabah Enerjisi (05:00 - 11:00)'};
  }
  if (max === afternoon) {
    return {category: 'afternoon', label: 'Gün Ortası Odak (11:00 - 17:00)'};
  }
  return {category: 'evening', label: 'Akşam Seansı (17:00 - 22:00)'};
}

/**
 * Returns aggregated stats summary for UI presentation in ProfileScreen.
 */
export async function getListeningStats(customNow?: Date): Promise<ListeningStatsSummary> {
  const now = customNow || new Date();
  const currentWeekStart = getWeekStartTimestamp(now);

  try {
    const raw = await AsyncStorage.getItem(LISTENING_STATS_KEY);
    let stats: RawListeningStats = raw ? JSON.parse(raw) : createDefaultStats(now);

    if (stats.weekStartTimestamp !== currentWeekStart) {
      stats.weekStartTimestamp = currentWeekStart;
      stats.secondsThisWeek = 0;
      stats.activeDaysThisWeek = [];
    }

    const totalMinutesThisWeek = Math.floor(stats.secondsThisWeek / 60);
    const totalMinutesAllTime = Math.floor(stats.secondsAllTime / 60);
    const hoursThisWeek = Math.floor(totalMinutesThisWeek / 60);
    const minutesRemainderThisWeek = totalMinutesThisWeek % 60;

    // Calculate genre breakdown
    const totalStationSeconds = Object.values(stats.secondsByStation).reduce((a, b) => a + b, 0);
    const genreBreakdown: GenreStatItem[] = Object.entries(stats.secondsByStation)
      .map(([stationId, seconds]) => {
        const percentage =
          totalStationSeconds > 0 ? Math.round((seconds / totalStationSeconds) * 100) : 0;
        const channelMeta = RADIO_CHANNELS.find(c => c.id === stationId);
        return {
          id: stationId,
          name: channelMeta?.name || STATION_GENRE_NAMES[stationId] || 'RadioTEDU',
          color: channelMeta?.color || STATION_COLORS[stationId] || '#E31E24',
          minutes: Math.floor(seconds / 60),
          percentage,
        };
      })
      .filter(item => item.minutes > 0 || item.percentage > 0)
      .sort((a, b) => b.percentage - a.percentage);

    const topGenre = genreBreakdown.length > 0 ? genreBreakdown[0] : null;
    const peak = calculatePeakTime(stats.secondsByHour);

    return {
      totalMinutesThisWeek,
      totalMinutesAllTime,
      hoursThisWeek,
      minutesRemainderThisWeek,
      topGenre,
      genreBreakdown,
      peakTimeCategory: peak.category,
      peakTimeLabel: peak.label,
      daysActiveThisWeek: stats.activeDaysThisWeek.length,
    };
  } catch {
    return {
      totalMinutesThisWeek: 0,
      totalMinutesAllTime: 0,
      hoursThisWeek: 0,
      minutesRemainderThisWeek: 0,
      topGenre: null,
      genreBreakdown: [],
      peakTimeCategory: 'night',
      peakTimeLabel: 'Gece Kuşu (22:00 - 05:00)',
      daysActiveThisWeek: 0,
    };
  }
}

/**
 * Resets stats storage (useful for testing).
 */
export async function resetListeningStats(): Promise<void> {
  await AsyncStorage.removeItem(LISTENING_STATS_KEY);
}
