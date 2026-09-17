import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {ExitConfirmationModal} from '../components/ExitConfirmationModal';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => defaultVal || key,
  }),
}));

describe('ExitConfirmationModal Component', () => {
  const mockDismiss = jest.fn();
  const mockConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders exit confirmation modal with title, message, and buttons', () => {
    let tree: any;
    act(() => {
      tree = renderer.create(
        <ExitConfirmationModal
          visible={true}
          onDismiss={mockDismiss}
          onConfirm={mockConfirm}
          isAudioActive={true}
        />,
      );
    });

    const instance = tree.root;
    const cancelBtn = instance.findByProps({testID: 'exit-modal-cancel-btn'});
    const confirmBtn = instance.findByProps({testID: 'exit-modal-confirm-btn'});

    expect(cancelBtn).toBeTruthy();
    expect(confirmBtn).toBeTruthy();

    act(() => {
      cancelBtn.props.onPress();
    });
    expect(mockDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      confirmBtn.props.onPress();
    });
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });
});
