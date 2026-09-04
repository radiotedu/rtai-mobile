import React from 'react';
import renderer, {act, ReactTestRenderer} from 'react-test-renderer';
import {Alert, TouchableOpacity} from 'react-native';
import HomeDiscovery from '../src/components/HomeDiscovery';
import {fetchPodcasts} from '../src/services/podcastService';
import {playChannelById} from '../src/services/playbackQueue';
import {openPlayerModal} from '../src/navigation/navigationRef';
import {RADIO_CHANNELS} from '../src/data/radioChannels';

const mockNavigate = jest.fn();
jest.setTimeout(30000);
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('react-i18next', () => ({useTranslation: () => ({i18n: {language: 'en'}})}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../src/services/podcastService', () => ({fetchPodcasts: jest.fn()}));
jest.mock('../src/services/playbackQueue', () => ({playChannelById: jest.fn()}));
jest.mock('../src/navigation/navigationRef', () => ({openPlayerModal: jest.fn()}));
jest.mock('../src/utils/safeLog', () => ({logSafeError: jest.fn()}));

describe('home discovery', () => {
  let tree: ReactTestRenderer;
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchPodcasts as jest.Mock).mockResolvedValue({items: [{id: 'episode-1', title: 'An actual episode', date: '4 Sep', description: '', feedTitle: 'RadioTEDU'}]});
    (playChannelById as jest.Mock).mockResolvedValue(undefined);
  });
  afterEach(() => { if (tree) { act(() => tree.unmount()); } });

  it('keeps every station including Lo-Fi available before podcasts finish loading', async () => {
    (fetchPodcasts as jest.Mock).mockReturnValue(new Promise(() => {}));
    await act(async () => { tree = renderer.create(<HomeDiscovery refreshKey={0} />); });
    const buttons = tree.root.findAllByType(TouchableOpacity);
    for (const channel of RADIO_CHANNELS) {
      expect(buttons.some(button => button.props.accessibilityLabel === `${channel.name}: Listen live`)).toBe(true);
    }
    const lofi = buttons.find(button => button.props.accessibilityLabel === 'Lo-Fi: Listen live')!;
    await act(async () => { await lofi.props.onPress(); });
    expect(playChannelById).toHaveBeenCalledWith('radiotedu-lofi');
    expect(openPlayerModal).toHaveBeenCalled();
  });

  it('opens the podcast selected from the preview and refreshes once per pull', async () => {
    await act(async () => { tree = renderer.create(<HomeDiscovery refreshKey={0} />); });
    const preview = tree.root.findAllByType(TouchableOpacity).find(button => button.findAll(node => node.props.children === 'An actual episode').length > 0)!;
    act(() => preview.props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('Podcasts', {podcastId: 'episode-1'});
    await act(async () => { tree.update(<HomeDiscovery refreshKey={1} />); });
    expect(fetchPodcasts).toHaveBeenCalledTimes(2);
  });

  it('offers retry after a catalog failure and recovers', async () => {
    (fetchPodcasts as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await act(async () => { tree = renderer.create(<HomeDiscovery refreshKey={0} />); });
    const retry = tree.root.findAllByType(TouchableOpacity).find(button => button.props.accessibilityLabel === 'Try again')!;
    await act(async () => { retry.props.onPress(); });
    expect(fetchPodcasts).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(tree.toJSON())).toContain('An actual episode');
  });

  it('reports a playback failure without opening a broken player', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (playChannelById as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await act(async () => { tree = renderer.create(<HomeDiscovery refreshKey={0} />); });
    await act(async () => { await tree.root.findAllByType(TouchableOpacity)[0].props.onPress(); });
    expect(alert).toHaveBeenCalledWith('RadioTEDU', expect.stringContaining('Playback could not start'));
    expect(openPlayerModal).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
