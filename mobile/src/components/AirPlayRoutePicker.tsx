import React from 'react';
import {Platform, requireNativeComponent, StyleProp, ViewStyle} from 'react-native';

const NativeAirPlayRoutePicker = Platform.OS === 'ios'
  ? requireNativeComponent<{style?: StyleProp<ViewStyle>}>('RadioTeduAirPlayRoutePicker')
  : null;

export default function AirPlayRoutePicker({style}: {style?: StyleProp<ViewStyle>}) {
  if (!NativeAirPlayRoutePicker) {
    return null;
  }
  return <NativeAirPlayRoutePicker style={style} />;
}
