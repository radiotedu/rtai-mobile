import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { SPACING } from '../theme/theme';

const GlobalHeader = () => {
  const navigation = useNavigation<any>();

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  return (
    <View style={styles.header}>
      <View style={styles.sideSpacer} />
      <Image
        source={require('../assets/images/logo-03byz.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <TouchableOpacity
        onPress={handleProfilePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Profil"
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
  sideSpacer: {
    flex: 1,
  },
  profileButton: {
    flex: 1,
    minWidth: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});

export default GlobalHeader;
