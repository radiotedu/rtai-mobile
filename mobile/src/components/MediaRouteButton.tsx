import React, {useEffect, useState} from 'react';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {COLORS} from '../theme/theme';
import {
  isCastActive,
  showCastRoutePicker,
  subscribeToCastState,
} from '../services/outputRouting';

interface MediaRouteButtonProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export const MediaRouteButton: React.FC<MediaRouteButtonProps> = ({
  size = 22,
  color = COLORS.text,
  style,
}) => {
  const [connected, setConnected] = useState(isCastActive());

  useEffect(() => {
    const unsubscribe = subscribeToCastState(isConnected => {
      setConnected(isConnected);
    });
    return () => unsubscribe();
  }, []);

  const handlePress = () => {
    showCastRoutePicker();
  };

  const iconName = Platform.OS === 'ios'
    ? 'apple-airplay'
    : connected
    ? 'cast-connected'
    : 'cast';

  const activeColor = connected ? COLORS.primary : color;

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={connected ? 'Yayınlanıyor (Bağlı)' : 'Cihaza Yayınla (Cast / AirPlay)'}
      testID="media-route-button">
      <Icon name={iconName} size={size} color={activeColor} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
