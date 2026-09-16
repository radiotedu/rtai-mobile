import React from 'react';
import renderer, {act} from 'react-test-renderer';
import PodcastTranscriptViewer from '../components/PodcastTranscriptViewer';
import {
  SAMPLE_TEDU_TRANSCRIPT_CUES,
  SAMPLE_TEDU_ACADEMIC_TAKEAWAYS,
  formatTimestamp,
} from '../data/samplePodcastTranscripts';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {language: 'tr'},
  }),
}));

describe('Podcast AI Transcript Viewer & Click-to-Seek', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatTimestamp helper', () => {
    it('formats seconds into MM:SS correctly', () => {
      expect(formatTimestamp(0)).toBe('00:00');
      expect(formatTimestamp(65)).toBe('01:05');
      expect(formatTimestamp(3599)).toBe('59:59');
    });

    it('formats seconds exceeding an hour into HH:MM:SS', () => {
      expect(formatTimestamp(3665)).toBe('01:01:05');
    });
  });

  describe('SAMPLE_TEDU_TRANSCRIPT_CUES definitions', () => {
    it('provides academic transcript cues and flashcards', () => {
      expect(SAMPLE_TEDU_TRANSCRIPT_CUES.length).toBeGreaterThan(0);
      expect(SAMPLE_TEDU_ACADEMIC_TAKEAWAYS.length).toBeGreaterThan(0);

      // Verify timestamps are non-negative and ascending
      for (let i = 0; i < SAMPLE_TEDU_TRANSCRIPT_CUES.length; i++) {
        expect(SAMPLE_TEDU_TRANSCRIPT_CUES[i].startSeconds).toBeGreaterThanOrEqual(0);
        expect(SAMPLE_TEDU_TRANSCRIPT_CUES[i].endSeconds).toBeGreaterThan(
          SAMPLE_TEDU_TRANSCRIPT_CUES[i].startSeconds,
        );
        if (i > 0) {
          expect(SAMPLE_TEDU_TRANSCRIPT_CUES[i].startSeconds).toBeGreaterThanOrEqual(
            SAMPLE_TEDU_TRANSCRIPT_CUES[i - 1].startSeconds,
          );
        }
      }
    });
  });

  describe('PodcastTranscriptViewer component', () => {
    it('renders cues list and invokes onSeek when a cue is pressed', () => {
      const onSeekMock = jest.fn();
      let root: any;
      act(() => {
        root = renderer.create(
          <PodcastTranscriptViewer
            currentTimeSeconds={15}
            onSeek={onSeekMock}
          />,
        );
      });

      expect(root.toJSON()).toBeTruthy();

      // Find seekable cue button by testID
      const cueButton = root.root.findByProps({testID: 'cue-item-cue-1'});
      expect(cueButton).toBeTruthy();

      act(() => {
        cueButton.props.onPress();
      });

      expect(onSeekMock).toHaveBeenCalledWith(0);
    });

    it('supports tab switching between transcript and academic takeaways', () => {
      let root: any;
      act(() => {
        root = renderer.create(
          <PodcastTranscriptViewer
            currentTimeSeconds={0}
            onSeek={jest.fn()}
          />,
        );
      });

      const takeawaysTab = root.root.findByProps({testID: 'tab-takeaways'});
      expect(takeawaysTab).toBeTruthy();

      act(() => {
        takeawaysTab.props.onPress();
      });

      expect(root.toJSON()).toBeTruthy();
    });
  });
});
