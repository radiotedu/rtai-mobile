import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {appCopy} from '../i18n/appCopy';
import { SPACING } from '../theme/theme';

const GlobalHeader = () => {
  const navigation = useNavigation<any>();
  const {i18n} = useTranslation();
  const {width, height} = useWindowDimensions();
  const compact = width > height && height < 500;

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  return (
    <View style={[styles.header, compact && styles.compactHeader]}>
      <View style={styles.sideSpacer} />
      <Image
        source={require('../assets/images/logo-03byz.png')}
        style={[styles.logo, compact && styles.compactLogo]}
        resizeMode="contain"
      />
      <TouchableOpacity
        onPress={handleProfilePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={appCopy(i18n.language, 'profile.title')}
        style={styles.profileButton}>
        <Icon name="account-circle" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  logo: {
    height: 44,
    width: 160,
  },
  compactHeader: {paddingVertical: 0, minHeight: 44},
  compactLogo: {height: 28, width: 120},
  sideSpacer: {
    flex: 1,
  },
  profileButton: {
    flex: 1,
    minWidth: 48,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});

export default GlobalHeader;
