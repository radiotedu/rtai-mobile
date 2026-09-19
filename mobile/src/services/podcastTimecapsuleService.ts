/**
 * RadioTEDU Podcast Timecapsule Service
 * 
 * Manages timestamped community micro-notes and academic bookmarks
 * (Acoustic Timecapsules) pinned to podcast playback moments.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type TimecapsuleCategory = 'exam_tip' | 'key_takeaway' | 'discussion';

export interface PodcastTimecapsule {
  id: string;
  podcastId: string;
  timestampSeconds: number;
  authorName: string;
  text: string;
  category: TimecapsuleCategory;
  likes: number;
  createdAt: number;
}

export const CATEGORY_CONFIG: Record<
  TimecapsuleCategory,
  {label: string; color: string; bg: string; icon: string}
> = {
  exam_tip: {
    label: 'Sınav / Proje Notu',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.15)',
    icon: 'star-shooting-outline',
  },
  key_takeaway: {
    label: 'Kilit Çıkarım',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.15)',
    icon: 'diamond-stone',
  },
  discussion: {
    label: 'Tartışma & Etik',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.15)',
    icon: 'comment-text-multiple-outline',
  },
};

export const INITIAL_TEDU_TIMECAPSULES: PodcastTimecapsule[] = [
  {
    id: 'tc-1',
    podcastId: 'tedu-academic-1',
    timestampSeconds: 65,
    authorName: 'Müh. Fak. Temsilcisi',
    text: '📌 NLP laboratuvarı vize sınavında bu çalışmanın model mimarisi soruluyor!',
    category: 'exam_tip',
    likes: 18,
    createdAt: 1726560000000,
  },
  {
    id: 'tc-2',
    podcastId: 'tedu-academic-1',
    timestampSeconds: 105,
    authorName: 'Veri Bilimi Kulübü',
    text: '💎 RAG mimarisinde vektör veritabanı seçimi: Chroma vs Weaviate kıyası için kilit açıklama.',
    category: 'key_takeaway',
    likes: 24,
    createdAt: 1726560100000,
  },
  {
    id: 'tc-3',
    podcastId: 'tedu-academic-1',
    timestampSeconds: 195,
    authorName: 'Etik Kurulu Asistanı',
    text: '⚖️ Senato rehberinde atıf formatı madde 4/B burada detaylandırılıyor.',
    category: 'discussion',
    likes: 12,
    createdAt: 1726560200000,
  },
  {
    id: 'tc-4',
    podcastId: 'tedu-academic-1',
    timestampSeconds: 245,
    authorName: 'TEDÜ Açık Kaynak',
    text: '🚀 GitHub repo linkleri bölüm açıklamasında paylaşıldı.',
    category: 'key_takeaway',
    likes: 31,
    createdAt: 1726560300000,
  },
];

export class PodcastTimecapsuleService {
  private timecapsules: PodcastTimecapsule[] = [];
  private listeners: Array<() => void> = [];
  private loaded = false;
  private loading?: Promise<void>;
  private writes: Promise<unknown> = Promise.resolve();

  public initialize(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (!this.loading) {
      this.loading = (async () => {
        const raw = await AsyncStorage.getItem('radiotedu.podcast.timecapsules.v1');
        const entries: unknown = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(entries) || !entries.every(isValidCapsule)) {
          throw new Error('Invalid saved timecapsules');
        }
        this.timecapsules = entries;
        this.loaded = true;
        this.notify();
      })().finally(() => { this.loading = undefined; });
    }
    return this.loading;
  }

  private update<T>(change: (entries: PodcastTimecapsule[]) => T): Promise<T> {
    const task = this.writes.then(async () => {
      await this.initialize();
      const next = this.timecapsules.map(entry => ({...entry}));
      const result = change(next);
      await AsyncStorage.setItem('radiotedu.podcast.timecapsules.v1', JSON.stringify(next));
      this.timecapsules = next;
      this.notify();
      return result;
    });
    this.writes = task.catch(() => undefined);
    return task;
  }

  public getTimecapsules(podcastId?: string): PodcastTimecapsule[] {
    if (!podcastId) {
      return [...this.timecapsules].sort(
        (a, b) => a.timestampSeconds - b.timestampSeconds,
      );
    }
    return this.timecapsules
      .filter(tc => tc.podcastId === podcastId)
      .sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  }

  public getTimecapsulesAtTime(
    timestampSeconds: number,
    podcastId?: string,
    toleranceSeconds = 15,
  ): PodcastTimecapsule[] {
    return this.getTimecapsules(podcastId).filter(
      tc => Math.abs(tc.timestampSeconds - timestampSeconds) <= toleranceSeconds,
    );
  }

  public addTimecapsule(
    entry: Omit<PodcastTimecapsule, 'id' | 'likes' | 'createdAt'>,
  ): Promise<PodcastTimecapsule> {
    const newCapsule: PodcastTimecapsule = {
      ...entry,
      id: `tc-user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      likes: 1,
      createdAt: Date.now(),
    };
    if (!isValidCapsule(newCapsule)) return Promise.reject(new Error('Invalid timecapsule'));
    return this.update(entries => { entries.push(newCapsule); return newCapsule; });
  }

  public likeTimecapsule(id: string): Promise<number> {
    return this.update(entries => {
      const item = entries.find(tc => tc.id === id);
      if (!item) return 0;
      item.likes += 1;
      return item.likes;
    });
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public resetTimecapsules(): Promise<void> {
    return this.update(entries => { entries.length = 0; });
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        // Safe listener error suppression
      }
    }
  }
}

function isValidCapsule(value: unknown): value is PodcastTimecapsule {
  if (!value || typeof value !== 'object') return false;
  const item = value as PodcastTimecapsule;
  return ['id', 'podcastId', 'authorName', 'text'].every(key =>
    typeof item[key as keyof PodcastTimecapsule] === 'string' &&
    String(item[key as keyof PodcastTimecapsule]).trim().length > 0,
  ) && Number.isFinite(item.timestampSeconds) && item.timestampSeconds >= 0 &&
    Number.isFinite(item.likes) && item.likes >= 0 && Number.isFinite(item.createdAt) &&
    ['exam_tip', 'key_takeaway', 'discussion'].includes(item.category);
}

export const podcastTimecapsuleService = new PodcastTimecapsuleService();
