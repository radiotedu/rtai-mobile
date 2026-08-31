import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { SPACING } from '../theme/theme';
import {useAuth} from '../context/AuthContext';
import {getHeaderAccountLabel} from './headerAccountLabel';

const GlobalHeader = () => {
  const navigation = useNavigation<any>();
  const {user} = useAuth();
  const accountLabel = getHeaderAccountLabel(user);

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
        accessibilityLabel={accountLabel ? `${accountLabel} profili` : 'Profil'}
        style={styles.profileButton}>
        {accountLabel ? (
          <Text style={styles.accountLabel} numberOfLines={1}>
            {accountLabel}
          </Text>
        ) : null}
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
    gap: SPACING.xs,
  },
  accountLabel: {
    flexShrink: 1,
    maxWidth: 112,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default GlobalHeader;
