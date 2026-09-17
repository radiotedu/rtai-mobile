import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {PodcastPlayerScreen} from '../screens/PodcastPlayerScreen';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => opts?.defaultValue || key,
    i18n: {language: 'tr'},
  }),
}));

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: jest.fn(),
  }),
  useRoute: () => ({
    params: {
      podcast: {
        id: 'pod-test-1',
        title: 'Yapay Zeka ve Üniversite Eğitimi',
        author: 'Prof. Dr. TEDÜ',
        audioUrl: 'https://example.com/audio.mp3',
        description: 'Eğitimde yapay zeka entegrasyonu ve etik yaklaşımlar.',
        duration: 1800,
        publishedAt: '2026-09-15T10:00:00Z',
      },
    },
  }),
}));

const mockSeekTo = jest.fn();
const mockSeekBy = jest.fn();
const mockSetRate = jest.fn();
const mockGetPlaybackState = jest.fn().mockResolvedValue({state: 'playing'});

jest.mock('react-native-track-player', () => ({
  usePlaybackState: () => ({state: 'playing'}),
  useProgress: () => ({position: 120, duration: 1800}),
  useActiveTrack: () => ({
    id: 'podcast-pod-test-1',
    title: 'Yapay Zeka ve Üniversite Eğitimi',
    artist: 'Prof. Dr. TEDÜ',
  }),
  getPlaybackState: () => mockGetPlaybackState(),
  seekTo: (...args: any[]) => mockSeekTo(...args),
  seekBy: (...args: any[]) => mockSeekBy(...args),
  setRate: (...args: any[]) => mockSetRate(...args),
  State: {
    Playing: 'playing',
    Paused: 'paused',
    Stopped: 'stopped',
    Buffering: 'buffering',
    Connecting: 'connecting',
    Ready: 'ready',
    None: 'none',
  },
}));

const mockPause = jest.fn().mockResolvedValue(undefined);
const mockResume = jest.fn().mockResolvedValue(undefined);
const mockPlayTrackById = jest.fn().mockResolvedValue(undefined);
jest.mock('../services/playbackQueue', () => ({
  PODCAST_ID_PREFIX: 'podcast-',
  buildPodcastTrack: (p: any) => ({
    id: `podcast-${p.id}`,
    url: p.audioUrl,
    title: p.title,
    artist: p.author,
  }),
  isPodcastId: (id: string) => typeof id === 'string' && id.startsWith('podcast-'),
  pausePlaybackByUser: () => mockPause(),
  resumePlaybackByUser: () => mockResume(),
  playTrackById: (...args: any[]) => mockPlayTrackById(...args),
}));

jest.mock('../components/PodcastTranscriptViewer', () => 'PodcastTranscriptViewer');

describe('PodcastPlayerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders podcast title, author, and transport controls', () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<PodcastPlayerScreen />);
    });

    const str = JSON.stringify(tree.toJSON());
    expect(str).toContain('Yapay Zeka ve Üniversite Eğitimi');
    expect(str).toContain('Prof. Dr. TEDÜ');
  });

  it('handles back button press', () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<PodcastPlayerScreen />);
    });

    const backBtn = tree.root.findByProps({testID: 'podcast-player-back-button'});
    act(() => {
      backBtn.props.onPress();
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('handles play/pause toggle', async () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<PodcastPlayerScreen />);
    });

    const playToggle = tree.root.findByProps({testID: 'podcast-play-toggle'});
    await act(async () => {
      await playToggle.props.onPress();
    });
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it('handles jump buttons (-15s and +30s)', async () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<PodcastPlayerScreen />);
    });

    const rewindBtn = tree.root.findByProps({testID: 'podcast-rewind-15'});
    await act(async () => {
      await rewindBtn.props.onPress();
    });
    expect(mockSeekBy).toHaveBeenCalledWith(-15);

    const forwardBtn = tree.root.findByProps({testID: 'podcast-forward-30'});
    await act(async () => {
      await forwardBtn.props.onPress();
    });
    expect(mockSeekBy).toHaveBeenCalledWith(30);
  });

  it('toggles interactive transcript modal when transcript pill is tapped', () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<PodcastPlayerScreen />);
    });

    const pillBtn = tree.root.findByProps({testID: 'podcast-open-transcript-pill'});
    const modal = tree.root.findByProps({testID: 'podcast-transcript-modal'});
    expect(modal.props.visible).toBe(false);

    act(() => {
      pillBtn.props.onPress();
    });

    expect(modal.props.visible).toBe(true);
  });
});
