import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {
  updateOutputMedia,
  showCastRoutePicker,
  isCastActive,
  subscribeToCastState,
  setMockCastActive,
} from '../services/outputRouting';
import {MediaRouteButton} from '../components/MediaRouteButton';
import {NativeModules, Platform} from 'react-native';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

jest.mock('../services/playbackQueue', () => ({
  pausePlaybackByUser: jest.fn().mockResolvedValue(true),
}));

describe('Media Routing & Google Cast / AirPlay 2', () => {
  beforeEach(() => {
    Platform.OS = 'android';
    setMockCastActive(false);
    jest.clearAllMocks();
  });

  it('updates output media on native cast bridge', () => {
    const mockUpdate = jest.fn();
    NativeModules.RadioTeduCastBridge = {
      updateMedia: mockUpdate,
      showRoutePicker: jest.fn(),
    };

    updateOutputMedia({
      id: 'radiotedu-main',
      url: 'https://stream.radiotedu.com/live',
      title: 'RadioTEDU Flagship',
      artist: 'Live Broadcast',
      artwork: 'https://radiotedu.com/logo.png',
      live: true,
      positionSeconds: 0,
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      'https://stream.radiotedu.com/live',
      'RadioTEDU Flagship',
      'Live Broadcast',
      'https://radiotedu.com/logo.png',
      true,
    );
  });

  it('triggers showCastRoutePicker via native bridge', () => {
    const mockShowPicker = jest.fn();
    NativeModules.RadioTeduCastBridge = {
      updateMedia: jest.fn(),
      showRoutePicker: mockShowPicker,
    };

    showCastRoutePicker();
    expect(mockShowPicker).toHaveBeenCalled();
  });

  it('notifies subscribers when cast connection status changes', () => {
    const statuses: boolean[] = [];
    const unsubscribe = subscribeToCastState(connected => {
      statuses.push(connected);
    });

    setMockCastActive(true);
    expect(isCastActive()).toBe(true);
    expect(statuses).toEqual([false, true]);

    setMockCastActive(false);
    expect(isCastActive()).toBe(false);
    expect(statuses).toEqual([false, true, false]);

    unsubscribe();
  });

  it('renders MediaRouteButton and opens route picker on tap', async () => {
    const mockShow = jest.fn();
    NativeModules.RadioTeduCastBridge = {
      updateMedia: jest.fn(),
      showRoutePicker: mockShow,
    };

    let tree: any;
    await act(async () => {
      tree = renderer.create(<MediaRouteButton size={24} />);
    });

    const instance = tree.root;
    const btn = instance.findByProps({testID: 'media-route-button'});
    expect(btn).toBeTruthy();

    await act(async () => {
      btn.props.onPress();
    });

    expect(mockShow).toHaveBeenCalled();
  });
});
