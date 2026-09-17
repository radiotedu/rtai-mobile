import {
  podcastTimecapsuleService,
  INITIAL_TEDU_TIMECAPSULES,
} from '../services/podcastTimecapsuleService';

describe('Podcast Acoustic Timecapsules Service', () => {
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
});
