jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {},
  State: {},
  usePlaybackState: jest.fn(),
  useActiveTrack: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn().mockResolvedValue({isConnected: true, isInternetReachable: true}),
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {CampusJamModal} from '../components/CampusJamModal';
import * as campusJamService from '../services/campusJamService';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => defaultVal || key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('Tuna'),
  setItem: jest.fn().mockResolvedValue(null),
}));

jest.mock('../services/analyticsService', () => ({
  Analytics: {
    jamModalOpened: jest.fn(),
    jamRoomCreated: jest.fn(),
    jamRoomJoined: jest.fn(),
    jamReactionSent: jest.fn(),
    jamRoomLeft: jest.fn(),
  },
}));

describe('CampusJamModal Component', () => {
  const mockClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    campusJamService.leaveJamRoom();
  });

  it('renders idle modal with visibility selector and public rooms shelf', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <CampusJamModal
          visible={true}
          onClose={mockClose}
          channelId="radiotedu-main"
          channelName="RadioTEDU"
        />,
      );
    });

    const instance = tree.root;
    const createBtn = instance.findByProps({testID: 'campus-jam-create-btn'});
    const publicVisBtn = instance.findByProps({testID: 'jam-visibility-public-btn'});
    const privateVisBtn = instance.findByProps({testID: 'jam-visibility-private-btn'});
    const refreshPublicBtn = instance.findByProps({testID: 'campus-jam-refresh-public-btn'});
    const codeInput = instance.findByProps({testID: 'campus-jam-code-input'});
    const joinBtn = instance.findByProps({testID: 'campus-jam-join-btn'});

    expect(createBtn).toBeTruthy();
    expect(publicVisBtn).toBeTruthy();
    expect(privateVisBtn).toBeTruthy();
    expect(refreshPublicBtn).toBeTruthy();
    expect(codeInput).toBeTruthy();
    expect(joinBtn).toBeTruthy();

    // Toggle to private
    act(() => {
      privateVisBtn.props.onPress();
    });

    // Toggle back to public
    act(() => {
      publicVisBtn.props.onPress();
    });
  });

  it('renders active room stage with ephemeral chat and reaction controls', async () => {
    // Setup active room
    await act(async () => {
      await campusJamService.createJamRoom('radiotedu-main', 'RadioTEDU', 'Host User', true);
    });

    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <CampusJamModal
          visible={true}
          onClose={mockClose}
          channelId="radiotedu-main"
          channelName="RadioTEDU"
        />,
      );
    });

    const instance = tree.root;
    const roomCode = instance.findByProps({testID: 'campus-jam-room-code'});
    const listenerCount = instance.findByProps({testID: 'campus-jam-listener-count'});
    const chatInput = instance.findByProps({testID: 'campus-jam-chat-input'});
    const sendBtn = instance.findByProps({testID: 'campus-jam-chat-send-btn'});
    const quickChip = instance.findByProps({testID: 'jam-quick-chip-0'});
    const leaveBtn = instance.findByProps({testID: 'campus-jam-leave-btn'});

    expect(roomCode).toBeTruthy();
    expect(listenerCount).toBeTruthy();
    expect(chatInput).toBeTruthy();
    expect(sendBtn).toBeTruthy();
    expect(quickChip).toBeTruthy();
    expect(leaveBtn).toBeTruthy();

    // Send a message via quick chip
    act(() => {
      quickChip.props.onPress();
    });

    // Send reaction
    const fireReaction = instance.findByProps({testID: 'jam-reaction-🔥'});
    expect(fireReaction).toBeTruthy();
    act(() => {
      fireReaction.props.onPress();
    });

    // Leave room
    act(() => {
      leaveBtn.props.onPress();
    });
    expect(campusJamService.getActiveJamRoom()).toBeNull();
  });
});
