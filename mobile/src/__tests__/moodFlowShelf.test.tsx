import React from 'react';
import renderer, {act} from 'react-test-renderer';
import MoodFlowShelf from '../components/MoodFlowShelf';
import {
  activateMood,
  clearActiveMood,
  getActiveMood,
} from '../services/moodEngineService';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
    addEventListener: jest.fn(() => jest.fn()),
  },
}));
jest.mock('../services/playbackQueue', () => ({
  playTrackById: jest.fn().mockResolvedValue(true),
  setDeduplicatedChannel: jest.fn().mockResolvedValue(undefined),
  pausePlaybackByUser: jest.fn().mockResolvedValue(undefined),
  resumePlaybackByUser: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-track-player', () => ({
  State: {Playing: 'playing', Paused: 'paused'},
  usePlaybackState: () => ({state: 'playing'}),
  useProgress: () => ({position: 0, duration: 0}),
  addEventListener: () => ({remove: () => {}}),
}));
jest.mock('react-i18next', () => ({
  initReactI18next: {type: '3rdParty', init: () => {}},
  useTranslation: () => ({
    t: (key: string, options?: any) => options?.defaultValue ?? key,
  }),
}));

describe('MoodFlowShelf Component', () => {
  beforeEach(() => {
    clearActiveMood();
    jest.clearAllMocks();
  });

  it('renders all mood profile cards', () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<MoodFlowShelf />);
    });

    const root = tree.root;
    expect(root.findByProps({testID: 'mood-card-exam_focus'})).toBeDefined();
    expect(root.findByProps({testID: 'mood-card-campus_walk'})).toBeDefined();
    expect(root.findByProps({testID: 'mood-card-night_chill'})).toBeDefined();
    expect(root.findByProps({testID: 'mood-card-campus_gym'})).toBeDefined();
  });

  it('toggles mood selection when a mood card is pressed', async () => {
    const onSelectedMock = jest.fn();
    let tree: any;
    act(() => {
      tree = renderer.create(<MoodFlowShelf onMoodSelected={onSelectedMock} />);
    });

    const examCard = tree.root.findByProps({testID: 'mood-card-exam_focus'});
    await act(async () => {
      await examCard.props.onPress();
    });

    expect(getActiveMood()?.id).toBe('exam_focus');
    expect(onSelectedMock).toHaveBeenCalledWith(
      expect.objectContaining({id: 'exam_focus'}),
    );

    // Clicking again clears the mood
    await act(async () => {
      await examCard.props.onPress();
    });
    expect(getActiveMood()).toBeNull();
  });
});
