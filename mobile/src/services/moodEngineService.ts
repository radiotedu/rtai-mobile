import {RADIO_CHANNELS} from '../data/radioChannels';
import {playTrackById} from './playbackQueue';
import {audioDspService} from './audioDspService';

export interface MoodDspPreset {
  targetLufs: number;
  speechClarity: boolean;
  bassBoost: boolean;
}

export interface MoodProfile {
  id: 'exam_focus' | 'campus_walk' | 'night_chill' | 'campus_gym';
  titleKey: string;
  defaultTitle: string;
  descriptionKey: string;
  defaultDescription: string;
  icon: string;
  recommendedStationId: string;
  dspPreset: MoodDspPreset;
  suggestedDurationMinutes: number;
  gradientColors: [string, string];
  accentColor: string;
}

export const MOOD_PROFILES: MoodProfile[] = [
  {
    id: 'exam_focus',
    titleKey: 'moods.examFocus',
    defaultTitle: 'Sınav Odaklanması',
    descriptionKey: 'moods.examFocusDesc',
    defaultDescription: 'Lo-Fi & Klasik enstrümantal ses akışı ve -16 LUFS çalışma dengesi.',
    icon: 'brain',
    recommendedStationId: 'radiotedu-lofi',
    dspPreset: {
      targetLufs: -16.0,
      speechClarity: false,
      bassBoost: false,
    },
    suggestedDurationMinutes: 45,
    gradientColors: ['#007acc', '#003366'],
    accentColor: '#00d2ff',
  },
  {
    id: 'campus_walk',
    titleKey: 'moods.campusWalk',
    defaultTitle: 'Kampüs Yürüyüşü',
    descriptionKey: 'moods.campusWalkDesc',
    defaultDescription: 'RadioTEDU Ana İstasyon ile enerjik, tempolu ve canlı kampüs ritmi.',
    icon: 'walk',
    recommendedStationId: 'radiotedu-main',
    dspPreset: {
      targetLufs: -15.5,
      speechClarity: true,
      bassBoost: false,
    },
    suggestedDurationMinutes: 30,
    gradientColors: ['#e50914', '#8b0000'],
    accentColor: '#ff2d55',
  },
  {
    id: 'night_chill',
    titleKey: 'moods.nightChill',
    defaultTitle: 'Gece Ankara Ayazı',
    descriptionKey: 'moods.nightChillDesc',
    defaultDescription: 'Sakin Jazz ve Lo-Fi tonları, gece lambası sıcaklığı ve dinlendirici akış.',
    icon: 'weather-night',
    recommendedStationId: 'radiotedu-jazz',
    dspPreset: {
      targetLufs: -18.0,
      speechClarity: false,
      bassBoost: true,
    },
    suggestedDurationMinutes: 60,
    gradientColors: ['#4a0e4e', '#1a0033'],
    accentColor: '#b388ff',
  },
  {
    id: 'campus_gym',
    titleKey: 'moods.campusGym',
    defaultTitle: 'Spor Salonu & Fitness',
    descriptionKey: 'moods.campusGymDesc',
    defaultDescription: 'Yüksek BPM Energize & Rock ritimleri, dinamik güç ve motivasyon.',
    icon: 'dumbbell',
    recommendedStationId: 'radiotedu-energize',
    dspPreset: {
      targetLufs: -14.0,
      speechClarity: false,
      bassBoost: true,
    },
    suggestedDurationMinutes: 50,
    gradientColors: ['#ff8c00', '#b84000'],
    accentColor: '#ff9500',
  },
];

let activeMoodId: string | null = null;
const listeners = new Set<(mood: MoodProfile | null) => void>();

export function getAvailableMoodProfiles(): MoodProfile[] {
  return [...MOOD_PROFILES];
}

export function getActiveMood(): MoodProfile | null {
  if (!activeMoodId) {
    return null;
  }
  return MOOD_PROFILES.find(m => m.id === activeMoodId) ?? null;
}

export async function activateMood(moodId: string): Promise<MoodProfile | null> {
  const profile = MOOD_PROFILES.find(m => m.id === moodId);
  if (!profile) {
    return null;
  }

  activeMoodId = profile.id;

  // 1. Enable audio DSP with target loudness
  audioDspService.setLevelingEnabled(true).catch(() => {});
  audioDspService.setTargetLufs(profile.dspPreset.targetLufs);

  // 2. Switch to recommended station if present in canonical stations
  const channel = RADIO_CHANNELS.find(c => c.id === profile.recommendedStationId);
  if (channel) {
    await playTrackById(channel.id);
  }

  notifyListeners();
  return profile;
}

export function clearActiveMood(): void {
  if (activeMoodId !== null) {
    activeMoodId = null;
    notifyListeners();
  }
}

export function subscribeToMoodChanges(listener: (mood: MoodProfile | null) => void): () => void {
  listeners.add(listener);
  listener(getActiveMood());
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  const current = getActiveMood();
  listeners.forEach(fn => {
    try {
      fn(current);
    } catch {
      // safe non-blocking listener invocation
    }
  });
}
