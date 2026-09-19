import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useTranslation} from 'react-i18next';
import {COLORS} from '../theme/theme';
import type {Podcast} from '../services/podcastService';
import {
  deleteDownloadedPodcast,
  downloadPodcast,
  getDownloadProgress,
  getDownloadStatus,
  subscribeToDownloads,
} from '../services/podcastDownloadService';

interface PodcastDownloadButtonProps {
  podcast: Podcast;
  size?: number;
  color?: string;
}

export const PodcastDownloadButton: React.FC<PodcastDownloadButtonProps> = ({
  podcast,
  size = 24,
  color = COLORS.textMuted,
}) => {
  const {i18n: i18nInstance} = useTranslation();
  const t = (key: string, options?: {defaultValue?: string}) => {
    if (typeof i18nInstance?.t === 'function') {
      return i18nInstance.t(key, options);
    }
    return options?.defaultValue || key;
  };
  const [status, setStatus] = useState(getDownloadStatus(podcast.id));
  const [_progress, setProgress] = useState(getDownloadProgress(podcast.id));

  useEffect(() => {
    setStatus(getDownloadStatus(podcast.id));
    setProgress(getDownloadProgress(podcast.id));

    const unsubscribe = subscribeToDownloads(() => {
      setStatus(getDownloadStatus(podcast.id));
      setProgress(getDownloadProgress(podcast.id));
    });
    return () => unsubscribe();
  }, [podcast.id]);

  const handlePress = async () => {
    if (status === 'downloading') {
      return;
    }

    if (status === 'downloaded') {
      Alert.alert(
        t('podcasts.deleteDownloadTitle', {defaultValue: 'İndirmeyi Sil'}),
        t('podcasts.deleteDownloadMsg', {
          defaultValue: 'Bu podcast bölümünü cihazınızdan silmek istiyor musunuz?',
        }),
        [
          {text: t('common.cancel', {defaultValue: 'Vazgeç'}), style: 'cancel'},
          {
            text: t('common.delete', {defaultValue: 'Sil'}),
            style: 'destructive',
            onPress: () => deleteDownloadedPodcast(podcast.id),
          },
        ],
      );
      return;
    }

    try {
      await downloadPodcast(podcast, p => setProgress(p));
    } catch {
      Alert.alert(
        t('common.error', {defaultValue: 'Hata'}),
        t('podcasts.downloadError', {
          defaultValue: 'Bölüm indirilirken bir sorun oluştu.',
        }),
      );
    }
  };

  if (status === 'downloading') {
    return (
      <View style={styles.btnWrap} testID={`podcast-downloading-${podcast.id}`}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (status === 'downloaded') {
    return (
      <TouchableOpacity
        style={styles.btnWrap}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('podcasts.downloadedAccessibility', {
          defaultValue: 'İndirildi, silmek için dokunun',
        })}
        testID={`podcast-downloaded-${podcast.id}`}>
        <Icon name="check-circle" size={size} color={COLORS.primary} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.btnWrap}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t('podcasts.downloadAccessibility', {
        defaultValue: 'Çevrimdışı dinlemek için indir',
      })}
      testID={`podcast-download-btn-${podcast.id}`}>
      <Icon name="arrow-down-circle-outline" size={size} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btnWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PodcastDownloadButton;
