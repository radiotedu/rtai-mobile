import React, {useState} from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {COLORS, SPACING} from '../theme/theme';
import {
  AppLanguage,
  LanguagePreference,
  SUPPORTED_LANGUAGES,
  getCurrentLanguage,
  getLanguagePreference,
  setLanguage,
} from '../i18n';
import {updateListeningReminderText} from '../services/notificationService';

const LanguageScreen = ({navigation}: any) => {
  const {t, i18n} = useTranslation();
  const [current, setCurrent] = useState<AppLanguage>(getCurrentLanguage());
  const [preference, setPreference] = useState<LanguagePreference>(getLanguagePreference());

  const onSelect = async (lang: LanguagePreference) => {
    if (lang !== 'system' && lang === current && preference !== 'system') {
      return;
    }
    const directionChanged = await setLanguage(lang);
    setPreference(lang);
    setCurrent(getCurrentLanguage());
    updateListeningReminderText(
      String(i18n.t('notifications.listeningReminderTitle')),
      String(i18n.t('notifications.listeningReminderBody')),
    );
    if (directionChanged) {
      Alert.alert(t('language.select'), t('language.restartNotice'));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
          <Icon name="arrow-left" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('common.language')}</Text>
        <View style={{width: 26}} />
      </View>
      <FlatList
        data={['system', ...SUPPORTED_LANGUAGES] as readonly LanguagePreference[]}
        keyExtractor={item => item}
        contentContainerStyle={styles.list}
        renderItem={({item}) => {
          const selected = item === preference;
          return (
            <TouchableOpacity
              style={[styles.row, selected && styles.rowSelected]}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}>
              <Text style={styles.label}>{t(`language.${item}`)}</Text>
              {selected && (
                <Icon name="check-circle" size={22} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  list: {
    padding: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowSelected: {
    borderColor: COLORS.primary,
  },
  label: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LanguageScreen;
