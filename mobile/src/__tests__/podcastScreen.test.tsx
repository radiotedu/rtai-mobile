import React from 'react';
import renderer, {act} from 'react-test-renderer';
import PodcastScreen from '../screens/PodcastScreen';
import * as podcastDownloadService from '../services/podcastDownloadService';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

jest.mock('react-native/Libraries/Interaction/InteractionManager', () => ({
  runAfterInteractions: (cb?: any) => {
    if (typeof cb === 'function') cb();
    return {cancel: jest.fn()};
  },
  createInteractionHandle: jest.fn(),
  clearInteractionHandle: jest.fn(),
}));

jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const React = require('react');
  return ({data, renderItem, ListHeaderComponent, ListFooterComponent}: any) => {
    const footer = typeof ListFooterComponent === 'function' ? ListFooterComponent() : ListFooterComponent;
    const header = typeof ListHeaderComponent === 'function' ? ListHeaderComponent() : ListHeaderComponent;
    return React.createElement(
      'FlatList',
      null,
      header,
      data?.map((item: any, idx: number) =>
        React.createElement('View', {key: item.id || idx}, renderItem({item, index: idx})),
      ),
      footer,
    );
  };
});

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
    }),
    useRoute: () => ({params: {}}),
    useFocusEffect: (cb: any) => {
      React.useEffect(() => {
        cb();
      }, [cb]);
    },
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => opts?.defaultValue || k,
    i18n: {language: 'tr'},
  }),
}));

jest.mock('../components/GlobalHeader', () => 'GlobalHeader');

jest.mock('../services/podcastService', () => ({
  fetchPodcasts: jest.fn().mockResolvedValue({
    items: [
      {
        id: 'ep-1',
        title: 'TEDÜ Mimarlık ve Gelecek',
        description: 'Kampüs mimarisi ve sürdürülebilirlik.',
        audioUrl: 'https://example.com/ep1.mp3',
        date: '10 Eylül 2026',
      },
      {
        id: 'ep-2',
        title: 'Yapay Zeka ve Mühendislik',
        description: 'Büyük dil modellerinin mühendislikteki yeri.',
        audioUrl: 'https://example.com/ep2.mp3',
        date: '12 Eylül 2026',
      },
    ],
    totalPages: 1,
  }),
  fetchAllPodcasts: jest.fn().mockResolvedValue([]),
  resolvePodcastLaunchUrl: jest.fn(),
}));

jest.mock('../services/playbackQueue', () => ({
  PODCAST_ID_PREFIX: 'podcast:',
  buildPodcastTrack: jest.fn().mockReturnValue({id: 'podcast:ep-1', url: 'https://example.com/ep1.mp3'}),
  ensureBrowsableQueue: jest.fn().mockResolvedValue(true),
  pausePlaybackByUser: jest.fn(),
  playTrackById: jest.fn().mockResolvedValue(true),
  resumePlaybackByUser: jest.fn(),
  setCachedPodcasts: jest.fn(),
}));

jest.mock('../services/streamPreferences', () => ({
  resolveCurrentStreamPreferences: jest.fn().mockResolvedValue({quality: 'high'}),
}));

jest.mock('react-native-track-player', () => ({
  usePlaybackState: () => ({state: 'paused'}),
  useActiveTrack: () => null,
  add: jest.fn(),
  State: {Playing: 'playing', Paused: 'paused'},
}));

describe('PodcastScreen & Offline Integration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => {
      podcastDownloadService.clearAllDownloads();
    });
  });

  it('renders podcast episodes list and filter bar', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<PodcastScreen />);
      await Promise.resolve();
    });

    const instance = tree.root;
    expect(instance.findByType('GlobalHeader')).toBeTruthy();

    const extractText = (node: any): string => {
      if (!node) return '';
      if (typeof node === 'string' || typeof node === 'number') return String(node);
      if (Array.isArray(node)) return node.map(extractText).join('');
      if (node.props?.children) return extractText(node.props.children);
      return '';
    };
    const allTexts = instance.findAllByType('Text').map((t: any) => extractText(t.props.children));
    expect(allTexts.some((t: string) => t.includes('Tüm Bölümler'))).toBe(true);
    expect(allTexts.some((t: string) => t.includes('İndirilenler'))).toBe(true);
    expect(allTexts.some((t: string) => t.includes('TEDÜ Mimarlık ve Gelecek'))).toBe(true);
  });

  it('switches to downloaded filter and updates when episodes are downloaded', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<PodcastScreen />);
    });

    const instance = tree.root;

    // Simulate downloading ep-1
    await act(async () => {
      await podcastDownloadService.downloadPodcast({
        id: 'ep-1',
        title: 'TEDÜ Mimarlık ve Gelecek',
        audioUrl: 'https://example.com/ep1.mp3',
        date: '10 Eylül 2026',
        description: 'Kampüs mimarisi ve sürdürülebilirlik.',
      });
    });

    expect(podcastDownloadService.isPodcastDownloaded('ep-1')).toBe(true);

    // Find and tap the "İndirilenler" filter tab
    const tabs = instance.findAllByProps({accessibilityRole: 'tab'});
    const downloadedTab = tabs.find((tab: any) => tab.props.accessibilityLabel === 'İndirilenler');
    expect(downloadedTab).toBeTruthy();

    await act(async () => {
      downloadedTab.props.onPress();
    });

    // ep-1 should be shown in downloaded view
    const texts = instance.findAllByType('Text').map((t: any) => t.props.children);
    expect(texts.some((t: any) => typeof t === 'string' && t.includes('TEDÜ Mimarlık ve Gelecek'))).toBe(true);
  });
});
