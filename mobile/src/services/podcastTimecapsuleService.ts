/**
 * RadioTEDU Podcast Timecapsule Service
 * 
 * Manages timestamped community micro-notes and academic bookmarks
 * (Acoustic Timecapsules) pinned to podcast playback moments.
 */

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

class PodcastTimecapsuleService {
  private timecapsules: PodcastTimecapsule[] = [...INITIAL_TEDU_TIMECAPSULES];
  private listeners: Array<() => void> = [];

  public getTimecapsules(podcastId?: string): PodcastTimecapsule[] {
    if (!podcastId) {
      return [...this.timecapsules].sort(
        (a, b) => a.timestampSeconds - b.timestampSeconds,
      );
    }
    return this.timecapsules
      .filter(tc => tc.podcastId === podcastId || tc.podcastId === 'tedu-academic-1')
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
  ): PodcastTimecapsule {
    const newCapsule: PodcastTimecapsule = {
      ...entry,
      id: `tc-user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      likes: 1,
      createdAt: Date.now(),
    };
    this.timecapsules.push(newCapsule);
    this.notify();
    return newCapsule;
  }

  public likeTimecapsule(id: string): number {
    const item = this.timecapsules.find(tc => tc.id === id);
    if (item) {
      item.likes += 1;
      this.notify();
      return item.likes;
    }
    return 0;
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public resetTimecapsules(): void {
    this.timecapsules = [...INITIAL_TEDU_TIMECAPSULES];
    this.notify();
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

export const podcastTimecapsuleService = new PodcastTimecapsuleService();
