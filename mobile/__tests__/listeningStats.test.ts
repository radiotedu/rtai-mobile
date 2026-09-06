import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  calculatePeakTime,
  getListeningStats,
  normalizeStationId,
  recordListeningTime,
  resetListeningStats,
} from '../src/services/listeningStatsService';

describe('listeningStatsService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await resetListeningStats();
  });

  test('normalizes station ids correctly', () => {
    expect(normalizeStationId('radiotedu-jazz-flac')).toBe('radiotedu-jazz');
    expect(normalizeStationId('radiotedu-classic-low')).toBe('radiotedu-classic');
    expect(normalizeStationId('radiotedu-lofi')).toBe('radiotedu-lofi');
    expect(normalizeStationId('radiotedu-spark')).toBe('radiotedu-energize');
    expect(normalizeStationId('radiotedu-rock-normal')).toBe('radiotedu-rock');
    expect(normalizeStationId('radiotedu-main')).toBe('radiotedu-main');
  });

  test('records listening duration without song titles', async () => {
    const customDate = new Date('2026-09-07T14:30:00Z'); // Monday 14:30
    await recordListeningTime('radiotedu-jazz', 1800, customDate); // 30 minutes Jazz
    await recordListeningTime('radiotedu-lofi', 1200, customDate); // 20 minutes Lo-Fi

    const stats = await getListeningStats(customDate);
    expect(stats.totalMinutesThisWeek).toBe(50);
    expect(stats.totalMinutesAllTime).toBe(50);
    expect(stats.topGenre?.id).toBe('radiotedu-jazz');
    expect(stats.topGenre?.percentage).toBe(60); // 30/50 = 60%
    expect(stats.genreBreakdown).toHaveLength(2);
    expect(stats.genreBreakdown[1].id).toBe('radiotedu-lofi');
    expect(stats.genreBreakdown[1].percentage).toBe(40); // 20/50 = 40%
    expect(stats.daysActiveThisWeek).toBe(1);
  });

  test('calculates peak listening time accurately', () => {
    // Night owl: majority at 23:00 and 01:00
    expect(calculatePeakTime({23: 3600, 1: 1800, 14: 600}).category).toBe('night');
    // Morning: majority at 08:00
    expect(calculatePeakTime({8: 3600, 9: 1200, 23: 600}).category).toBe('morning');
    // Afternoon: majority at 14:00
    expect(calculatePeakTime({14: 4000, 15: 2000}).category).toBe('afternoon');
    // Evening: majority at 19:00
    expect(calculatePeakTime({19: 3600, 20: 3600}).category).toBe('evening');
  });

  test('resets weekly stats when calendar week rolls over', async () => {
    const week1 = new Date('2026-09-07T12:00:00Z'); // Monday week 1
    const week2 = new Date('2026-09-14T12:00:00Z'); // Monday week 2 (+7 days)

    await recordListeningTime('radiotedu-classic', 3600, week1); // 60 min
    const statsWeek1 = await getListeningStats(week1);
    expect(statsWeek1.totalMinutesThisWeek).toBe(60);
    expect(statsWeek1.totalMinutesAllTime).toBe(60);

    // Week 2 arrives
    const statsWeek2 = await getListeningStats(week2);
    expect(statsWeek2.totalMinutesThisWeek).toBe(0);
    expect(statsWeek2.totalMinutesAllTime).toBe(60); // All-time preserved
  });
});
