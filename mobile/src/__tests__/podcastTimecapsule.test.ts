import {
  podcastTimecapsuleService,
  INITIAL_TEDU_TIMECAPSULES,
} from '../services/podcastTimecapsuleService';
import {rtaiPodcastCopilotService} from '../services/rtaiPodcastCopilotService';

describe('Podcast Timecapsules & RTAI Copilot Service', () => {
  beforeEach(() => {
    podcastTimecapsuleService.resetTimecapsules();
  });

  describe('podcastTimecapsuleService', () => {
    it('initializes with seed TEDU timecapsules sorted by timestamp', () => {
      const capsules = podcastTimecapsuleService.getTimecapsules();
      expect(capsules.length).toBe(INITIAL_TEDU_TIMECAPSULES.length);
      for (let i = 1; i < capsules.length; i++) {
        expect(capsules[i].timestampSeconds).toBeGreaterThanOrEqual(
          capsules[i - 1].timestampSeconds,
        );
      }
    });

    it('adds a new acoustic timecapsule successfully', () => {
      const added = podcastTimecapsuleService.addTimecapsule({
        podcastId: 'tedu-academic-1',
        timestampSeconds: 150,
        authorName: 'Test Öğrenci',
        text: 'Bu formülü unutmayın!',
        category: 'exam_tip',
      });

      expect(added.id).toContain('tc-user-');
      expect(added.likes).toBe(1);

      const all = podcastTimecapsuleService.getTimecapsules('tedu-academic-1');
      expect(all.some(c => c.id === added.id)).toBe(true);
    });

    it('filters timecapsules within time tolerance window', () => {
      // tc-1 is at 65 seconds
      const nearby = podcastTimecapsuleService.getTimecapsulesAtTime(70, undefined, 10);
      expect(nearby.length).toBeGreaterThanOrEqual(1);
      expect(nearby[0].id).toBe('tc-1');

      const distant = podcastTimecapsuleService.getTimecapsulesAtTime(500, undefined, 10);
      expect(distant.length).toBe(0);
    });

    it('increments likes count on a timecapsule', () => {
      const initialLikes = INITIAL_TEDU_TIMECAPSULES[0].likes;
      const newLikes = podcastTimecapsuleService.likeTimecapsule('tc-1');
      expect(newLikes).toBe(initialLikes + 1);
    });
  });

  describe('rtaiPodcastCopilotService', () => {
    it('generates specialized academic explanation for RAG and LLM terms', () => {
      const explanation = rtaiPodcastCopilotService.explainPodcastMoment(
        85,
        'RAG mimarisi ve vektör veritabanları halüsinasyon riskini azaltır.',
        'Dr. Kaya Demir',
      );

      expect(explanation.summary).toContain('RAG (Retrieval-Augmented Generation)');
      expect(explanation.keyTerms).toContain('RAG Mimarisi');
      expect(explanation.suggestedQuestion).toBeTruthy();
      expect(explanation.academicConfidence).toBeGreaterThan(0.9);
    });

    it('generates specialized academic ethics explanation', () => {
      const explanation = rtaiPodcastCopilotService.explainPodcastMoment(
        175,
        'Akademik dürüstlük ve senato etik ilkeleri rehberi.',
        'Prof. Dr. Ziya Selçuk',
      );

      expect(explanation.summary).toContain('TEDÜ Senatosu Yapay Zeka Etik Rehberi');
      expect(explanation.keyTerms).toContain('Akademik Dürüstlük');
    });

    it('produces crisp synthesis for general spoken content', () => {
      const explanation = rtaiPodcastCopilotService.explainPodcastMoment(
        30,
        'Üniversitemizin yeni laboratuvar olanakları öğrencilere açık.',
      );

      expect(explanation.summary).toContain('Bu bölümde');
      expect(explanation.keyTerms.length).toBeGreaterThan(0);
    });
  });
});
