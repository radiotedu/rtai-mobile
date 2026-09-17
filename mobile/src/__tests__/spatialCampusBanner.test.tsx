import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {SpatialCampusBanner} from '../components/SpatialCampusBanner';
import * as campusSpatialService from '../services/campusSpatialService';
import * as playbackQueue from '../services/playbackQueue';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../services/playbackQueue', () => ({
  playTrackById: jest.fn().mockResolvedValue(true),
}));

describe('SpatialCampusBanner Component (Haritasız Akıllı Konum Bildirimi)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      campusSpatialService.resetCampusZoneState();
    });
  });

  it('renders nothing when user is outside campus zones', () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<SpatialCampusBanner />);
    });
    expect(tree.toJSON()).toBeNull();
  });

  it('renders zone prompt when entering library zone and handles activate', async () => {
    // Simulate entering library
    act(() => {
      campusSpatialService.simulateCampusZone('library');
    });

    const onActivateMock = jest.fn();
    let tree: any;
    act(() => {
      tree = renderer.create(<SpatialCampusBanner onActivateZone={onActivateMock} />);
    });

    const instance = tree.root;
    const banner = instance.findByProps({testID: 'spatial-campus-banner'});
    expect(banner).toBeTruthy();

    const activateBtn = instance.findByProps({testID: 'spatial-banner-activate-btn'});
    expect(activateBtn).toBeTruthy();

    await act(async () => {
      await activateBtn.props.onPress();
    });

    expect(onActivateMock).toHaveBeenCalledTimes(1);
    expect(playbackQueue.playTrackById).toHaveBeenCalledWith('lofi');
    expect(campusSpatialService.getActiveCampusZone()).toBeNull();
  });

  it('handles dismiss button cleanly', () => {
    act(() => {
      campusSpatialService.simulateCampusZone('grass');
    });

    let tree: any;
    act(() => {
      tree = renderer.create(<SpatialCampusBanner />);
    });

    const instance = tree.root;
    const dismissBtn = instance.findByProps({testID: 'spatial-banner-dismiss-btn'});
    expect(dismissBtn).toBeTruthy();

    act(() => {
      dismissBtn.props.onPress();
    });

    expect(campusSpatialService.getActiveCampusZone()).toBeNull();
  });
});
