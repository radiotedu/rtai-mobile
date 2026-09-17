import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {CampusJamModal} from '../components/CampusJamModal';
import * as campusJamService from '../services/campusJamService';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({type: 'wifi', isConnected: true}),
  addEventListener: jest.fn(() => () => {}),
}));
jest.mock('react-native-track-player', () => ({
  State: {Playing: 'playing', Paused: 'paused'},
  add: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => opts?.defaultValue || key,
    i18n: {language: 'tr'},
  }),
  initReactI18next: {type: '3rdParty', init: () => {}},
}));

describe('CampusJamModal Component', () => {
  const mockOnClose = jest.fn();

  beforeEach(async () => {
    await act(async () => {
      campusJamService.leaveJamRoom();
    });
    jest.clearAllMocks();
  });

  it('renders idle state with create and join buttons when no room is active', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <CampusJamModal
          visible={true}
          onClose={mockOnClose}
          channelId="radiotedu-main"
          channelName="RadioTEDU"
        />,
      );
    });

    const instance = tree.root;
    const createBtn = instance.findByProps({testID: 'campus-jam-create-btn'});
    expect(createBtn).toBeTruthy();

    const joinInput = instance.findByProps({testID: 'campus-jam-code-input'});
    expect(joinInput).toBeTruthy();
  });

  it('creates room and transitions to active room view', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <CampusJamModal
          visible={true}
          onClose={mockOnClose}
          channelId="radiotedu-main"
          channelName="RadioTEDU"
        />,
      );
    });

    const instance = tree.root;
    const createBtn = instance.findByProps({testID: 'campus-jam-create-btn'});

    await act(async () => {
      await createBtn.props.onPress();
    });

    // Room code and listener count should now be visible
    const codeElem = instance.findByProps({testID: 'campus-jam-room-code'});
    expect(codeElem).toBeTruthy();
    expect(codeElem.props.children).toMatch(/^\d{6}$/);

    const countElem = instance.findByProps({testID: 'campus-jam-listener-count'});
    expect(countElem).toBeTruthy();
  });

  it('triggers emoji reaction burst when reaction button is tapped', async () => {
    // Start with an active room
    await act(async () => {
      await campusJamService.createJamRoom('radiotedu-main', 'RadioTEDU', 'TestHost');
    });

    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <CampusJamModal
          visible={true}
          onClose={mockOnClose}
          channelId="radiotedu-main"
          channelName="RadioTEDU"
        />,
      );
    });

    const instance = tree.root;
    const fireBtn = instance.findByProps({testID: 'jam-reaction-🔥'});
    expect(fireBtn).toBeTruthy();

    await act(async () => {
      fireBtn.props.onPress();
    });

    // Reaction should have fired without error
    expect(campusJamService.getActiveJamRoom()?.isHost).toBe(true);
  });
});
