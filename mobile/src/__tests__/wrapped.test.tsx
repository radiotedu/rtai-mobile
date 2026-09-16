import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Share} from 'react-native';
import WrappedModal, {
  getFavoriteTimeBadge,
  WrappedStats,
} from '../components/WrappedModal';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {language: 'tr'},
  }),
}));

describe('RadioTEDU Wrapped Component & Badges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFavoriteTimeBadge calculation', () => {
    it('returns "Gece Baykuşu" (Night Owl) for night/evening hours in Turkish and English', () => {
      const nightTr = getFavoriteTimeBadge('night', 'tr');
      expect(nightTr.badge).toBe('Gece Baykuşu');
      expect(nightTr.icon).toBe('owl');
      expect(nightTr.timeRange).toBe('22:00 – 05:00');

      const nightEn = getFavoriteTimeBadge('night', 'en');
      expect(nightEn.badge).toBe('Night Owl');
      expect(nightEn.timeRange).toBe('22:00 – 05:00');
    });

    it('returns "Sabah Savaşçısı" (Morning Warrior) for morning/afternoon hours in Turkish and English', () => {
      const morningTr = getFavoriteTimeBadge('morning', 'tr');
      expect(morningTr.badge).toBe('Sabah Savaşçısı');
      expect(morningTr.icon).toBe('weather-sunset-up');
      expect(morningTr.timeRange).toBe('05:00 – 11:00');

      const morningEn = getFavoriteTimeBadge('morning', 'en');
      expect(morningEn.badge).toBe('Morning Warrior');
    });
  });

  describe('WrappedModal Rendering', () => {
    const mockStats: WrappedStats = {
      totalMinutes: 450,
      monthlyMinutes: 450,
      annualMinutes: 3200,
      topStation: {
        id: 'radiotedu-rock',
        name: 'Rock',
        color: '#FF6B2C',
        percentage: 60,
        minutes: 270,
      },
      goldEarned: 180,
      monthlyGold: 180,
      annualGold: 1240,
      peakTimeCategory: 'night',
      favoriteTimeBadge: 'Gece Baykuşu',
      period: 'monthly',
    };

    it('renders correctly when visible={true}', () => {
      let root: any;
      act(() => {
        root = renderer.create(
          <WrappedModal
            visible={true}
            onClose={jest.fn()}
            stats={mockStats}
            user={{display_name: 'Test Öğrenci', is_guest: false}}
          />,
        );
      });
      expect(root.toJSON()).toBeTruthy();
    });

    it('calls onClose when close button is pressed', () => {
      const onCloseMock = jest.fn();
      let root: any;
      act(() => {
        root = renderer.create(
          <WrappedModal
            visible={true}
            onClose={onCloseMock}
            stats={mockStats}
          />,
        );
      });

      const closeBtn = root.root.findByProps({testID: 'wrapped-close-button'});
      expect(closeBtn).toBeTruthy();
      act(() => {
        closeBtn.props.onPress();
      });
      expect(onCloseMock).toHaveBeenCalled();
    });

    it('triggers native Share when share button is tapped', async () => {
      const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({action: 'sharedAction'} as any);
      let root: any;
      act(() => {
        root = renderer.create(
          <WrappedModal
            visible={true}
            onClose={jest.fn()}
            stats={mockStats}
          />,
        );
      });

      const shareBtn = root.root.findByProps({testID: 'wrapped-share-button'});
      expect(shareBtn).toBeTruthy();

      await act(async () => {
        shareBtn.props.onPress();
      });

      expect(shareSpy).toHaveBeenCalled();
    });
  });
});
