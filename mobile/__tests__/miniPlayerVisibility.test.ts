import {describe, expect, it, jest} from '@jest/globals';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {},
  State: {},
  usePlaybackState: jest.fn(),
  useActiveTrack: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useNavigationState: jest.fn(),
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../src/services/playbackQueue', () => ({playChannelById: jest.fn()}));
jest.mock('../src/context/MetadataContext', () => ({useMetadata: jest.fn()}));
jest.mock('../src/context/ChannelContext', () => ({useChannels: jest.fn()}));
jest.mock('../src/data/radioChannels', () => ({
  RADIO_CHANNELS: [],
  shouldUseStationOnlyPresentation: jest.fn(() => false),
}));

import {
  getDeepestActiveRouteName,
  shouldHideMiniPlayerForRoute,
} from '../src/components/MiniPlayer';

describe('MiniPlayer route visibility', () => {
  it('finds the active nested Jukebox tab', () => {
    const routeName = getDeepestActiveRouteName({
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          state: {
            index: 3,
            routes: [
              {name: 'Home'},
              {name: 'Radio'},
              {name: 'Podcasts'},
              {name: 'Jukebox'},
            ],
          },
        },
      ],
    });

    expect(routeName).toBe('Jukebox');
    expect(shouldHideMiniPlayerForRoute(routeName)).toBe(true);
    expect(shouldHideMiniPlayerForRoute('Player')).toBe(true);
    expect(shouldHideMiniPlayerForRoute('SnakeGame')).toBe(true);
    expect(shouldHideMiniPlayerForRoute('MemoryGame')).toBe(true);
    expect(shouldHideMiniPlayerForRoute('TetrisGame')).toBe(true);
    expect(shouldHideMiniPlayerForRoute('RhythmTapGame')).toBe(true);
    expect(shouldHideMiniPlayerForRoute('WordGuessGame')).toBe(true);
    expect(shouldHideMiniPlayerForRoute('Home')).toBe(false);
  });

  it('uses the first route while navigation state is still initializing', () => {
    expect(getDeepestActiveRouteName({routes: [{name: 'MainTabs'}]})).toBe('MainTabs');
    expect(getDeepestActiveRouteName(undefined)).toBeUndefined();
  });
});
