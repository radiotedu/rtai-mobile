import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SPACING } from '../theme/theme';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../services/api';
import { STORAGE_API } from '../services/config';
import {logSafeError} from '../utils/safeLog';
import {
  createPodcastFeed,
  deletePodcastFeed,
  hasDuplicatePodcastFeedUrl,
  hasDuplicatePodcastFeedUrlOnServer,
  listPodcastFeeds,
  syncPodcastFeeds,
  type PodcastFeedRow,
} from '../services/podcastFeedsAdmin';
import {
  fetchProfileCustomization,
  updateProfileFavorites,
  type ProfileCustomization,
  type UserBadge,
} from '../services/profileService';
import {
  requestAndroidNotificationPermission,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../services/notificationService';
import {appCopy} from '../i18n/appCopy';
import {screenCopy} from '../i18n/screenCopy';

const ACCOUNT_DELETE_CONFIRMATION = { confirmation: 'DELETE' } as const;

const ProfileScreen = () => {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const copy = useCallback(
    (key: string, values: Record<string, string | number> = {}) => {
      const screenValue = screenCopy(i18n.language, key, values);
      return screenValue === key ? appCopy(i18n.language, key, values) : screenValue;
    },
    [i18n.language],
  );
  const { user, logout, deleteAccount, refreshSession } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [showAdminTab, setShowAdminTab] = useState(false);
  const [feedTitle, setFeedTitle] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [savedFeeds, setSavedFeeds] = useState<PodcastFeedRow[]>([]);
  const [isLoadingFeeds, setIsLoadingFeeds] = useState(false);
  const [isSavingFeed, setIsSavingFeed] = useState(false);
  const [isSyncingFeeds, setIsSyncingFeeds] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [profileCustomization, setProfileCustomization] = useState<ProfileCustomization>({});
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [favoritesForm, setFavoritesForm] = useState<ProfileCustomization>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    podcast: true,
    radio: true,
    jukebox: true,
    events: true,
  });
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const STORAGE_API_LOCAL = STORAGE_API;
  const loadFeeds = useCallback(async () => {
    if (!isAdmin) {
      setSavedFeeds([]);
      return;
    }

    setIsLoadingFeeds(true);
    try {
      const feeds = await listPodcastFeeds();
      setSavedFeeds(feeds);
    } catch (error) {
      logSafeError('profile.podcastFeeds', error);
      Alert.alert(copy('common.error'), copy('profile.feedLoadError'));
    } finally {
      setIsLoadingFeeds(false);
    }
  }, [copy, isAdmin]);

  useEffect(() => {
    if (isAdmin && showAdminTab) {
      loadFeeds();
    }
  }, [isAdmin, showAdminTab, loadFeeds]);

  const loadProfileCustomization = useCallback(async () => {
    if (!user || user.is_guest) {
      setProfileCustomization({});
      setFavoritesForm({});
      setBadges([]);
      return;
    }

    try {
      const result = await fetchProfileCustomization();
      setProfileCustomization(result.profile || {});
      setFavoritesForm(result.profile || {});
      setBadges(result.badges || []);
    } catch (error) {
      logSafeError('profile.customization', error);
    }
  }, [user]);

  useEffect(() => {
    loadProfileCustomization();
  }, [loadProfileCustomization]);

  const updateFavoriteField = (key: keyof ProfileCustomization, value: string) => {
    setFavoritesForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSaveFavorites = async () => {
    if (!user || user.is_guest) {
      Alert.alert(copy('common.accountRequired'), copy('profile.customize'));
      return;
    }

    setIsSavingProfile(true);
    try {
      const result: any = await updateProfileFavorites(favoritesForm);
      const nextProfile = result?.profile || favoritesForm;
      setProfileCustomization(nextProfile);
      setFavoritesForm(nextProfile);
      Alert.alert(copy('common.success'), copy('common.save'));
    } catch (error) {
      logSafeError('profile.favorites', error);
      Alert.alert(copy('common.error'), copy('common.error'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      const status = await requestAndroidNotificationPermission();
      Alert.alert(
        status === 'granted'
          ? copy('profile.notificationsReady')
          : copy('profile.notificationsDisabled'),
        status === 'granted'
          ? copy('profile.notificationsReadyText')
          : copy('profile.notificationsDisabledText'),
      );
    } catch (error) {
      logSafeError('profile.notificationPermission', error);
      Alert.alert(copy('common.error'), copy('profile.notificationPermissionError'));
    }
  };

  const handleNotificationPreferenceToggle = async (key: keyof NotificationPreferences) => {
    if (!user || user.is_guest) {
      Alert.alert(copy('common.accountRequired'), copy('common.signIn'));
      return;
    }

    const nextPreferences = {
      ...notificationPreferences,
      [key]: !notificationPreferences[key],
    };
    setNotificationPreferences(nextPreferences);
    setIsSavingNotifications(true);

    try {
      await updateNotificationPreferences(nextPreferences);
    } catch (error) {
      setNotificationPreferences(notificationPreferences);
      logSafeError('profile.notificationPreferences', error);
      Alert.alert(copy('common.error'), copy('common.error'));
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleAddFeed = async () => {
    const title = feedTitle.trim();
    const url = feedUrl.trim();

    if (!title || !url) {
      Alert.alert(copy('common.error'), copy('profile.feedFieldsRequired'));
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      Alert.alert(copy('common.error'), copy('profile.feedInvalidUrl'));
      return;
    }

    if (isLoadingFeeds) {
      Alert.alert(copy('common.error'), copy('profile.feedWaitForLoad'));
      return;
    }

    if (hasDuplicatePodcastFeedUrl(savedFeeds, url)) {
      Alert.alert(copy('common.error'), copy('profile.feedDuplicate'));
      return;
    }

    setIsSavingFeed(true);
    try {
      if (await hasDuplicatePodcastFeedUrlOnServer(url)) {
        Alert.alert(copy('common.error'), copy('profile.feedDuplicate'));
        await loadFeeds();
        return;
      }

      const created = await createPodcastFeed({
        title,
        feedUrl: url,
      });
      setFeedTitle('');
      setFeedUrl('');
      await loadFeeds();
      if (created.sync && 'status' in created.sync && created.sync.status === 'failed') {
        Alert.alert(copy('common.success'), copy('profile.feedCreatedSyncFailed'));
      } else if (created.sync && 'upserted' in created.sync) {
        Alert.alert(
          copy('common.success'),
          copy('profile.feedCreatedSynced', {count: created.sync.upserted}),
        );
      } else {
        Alert.alert(copy('common.success'), copy('profile.feedCreated'));
      }
    } catch (error) {
      logSafeError('profile.podcastFeedCreate', error);
      Alert.alert(copy('common.error'), copy('profile.feedCreateError'));
    } finally {
      setIsSavingFeed(false);
    }
  };

  const handleDeleteFeed = async (feed: PodcastFeedRow) => {
    Alert.alert(copy('profile.feedDeleteTitle'), copy('profile.feedDeleteQuestion', {title: feed.title}), [
      { text: copy('common.cancel'), style: 'cancel' },
      {
        text: copy('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePodcastFeed(feed.id);
            await loadFeeds();
          } catch (error) {
            logSafeError('profile.podcastFeedDelete', error);
            Alert.alert(copy('common.error'), copy('profile.feedDeleteError'));
          }
        },
      },
    ]);
  };

  const handleSyncFeeds = async () => {
    setIsSyncingFeeds(true);
    try {
      const results = await syncPodcastFeeds();
      await loadFeeds();
      Alert.alert(copy('common.success'), copy('profile.feedsSynced', {count: results.length}));
    } catch (error) {
      logSafeError('profile.podcastFeedSync', error);
      Alert.alert(copy('common.error'), copy('profile.feedSyncError'));
    } finally {
      setIsSyncingFeeds(false);
    }
  };

  const handleAvatarChange = async () => {
    if (!user || user.is_guest) {
      Alert.alert(copy('common.accountRequired'), copy('profile.avatarSignIn'));
      return;
    }

    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.assets && result.assets[0]) {
      const asset = result.assets[0];

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('avatar', {
          uri: Platform.OS === 'android' ? asset.uri : asset.uri?.replace('file://', ''),
          type: asset.type,
          name: asset.fileName || 'avatar.jpg',
        } as any);

        const response = await api.post('/auth/upload-avatar', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.data?.avatar_url) {
          await refreshSession();
          Alert.alert(copy('common.success'), copy('profile.avatarUpdated'));
          setLocalAvatar(`${STORAGE_API_LOCAL}${response.data.data.avatar_url}`);
        }
      } catch (error) {
        logSafeError('profile.avatarUpload', error);
        Alert.alert(copy('common.error'), copy('profile.avatarUploadError'));
      } finally {
        setIsUploading(false);
      }
    }
  };

  const currentAvatar = resolveAvatarUrl(localAvatar || user?.avatar_url, STORAGE_API_LOCAL);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [currentAvatar]);

  const handleDeleteAccount = () => {
    if (deleteConfirmation.trim().toUpperCase() !== ACCOUNT_DELETE_CONFIRMATION.confirmation) {
      Alert.alert(copy('profile.confirmationRequired'), copy('profile.confirmDeleteText'));
      return;
    }
    if (!user?.is_guest && !deletePassword) {
      Alert.alert(copy('profile.passwordRequired'), copy('profile.passwordDeleteText'));
      return;
    }

    Alert.alert(
      copy('profile.deleteQuestion'),
      copy('profile.deleteDataText'),
      [
        {text: copy('common.cancel'), style: 'cancel'},
        {
          text: copy('profile.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              await deleteAccount(user?.is_guest ? undefined : deletePassword);
              setShowDeleteAccount(false);
              setDeleteConfirmation('');
              setDeletePassword('');
              Alert.alert(copy('profile.accountDeleted'), copy('profile.accountDeletedText'));
            } catch {
              Alert.alert(
                copy('profile.accountNotDeleted'),
                copy('profile.accountNotDeletedText'),
              );
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevron-left" size={32} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navbarTitle}>{copy('profile.title')}</Text>
        <View style={styles.navbarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleAvatarChange}
            disabled={isUploading}
          >
            {currentAvatar && !avatarLoadFailed ? (
              <Image
                source={{uri: currentAvatar}}
                style={styles.avatar}
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>
                  {getInitials(user?.display_name || copy('profile.guest'))}
                </Text>
              </View>
            )}
            {isUploading ? (
              <View style={[styles.badge, styles.badgeLoading]}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : (
              <View style={styles.badge}>
                <Icon name="camera" size={18} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={styles.name}>{user?.display_name || copy('profile.guest')}</Text>
            <Text style={styles.role}>
              {user?.role === 'admin'
                ? copy('profile.admin')
                : !user || user.is_guest
                  ? copy('profile.guest')
                  : copy('profile.roleMember')}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{user?.total_songs_added || 0}</Text>
            <Text style={styles.statLabel}>{copy('profile.contributions')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{user?.rank_score || 0}</Text>
            <Text style={styles.statLabel}>{copy('profile.score')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{user?.total_upvotes_received || 0}</Text>
            <Text style={styles.statLabel}>{copy('profile.likes')}</Text>
          </View>
        </View>

        {!user || user.is_guest ? (
          <View style={styles.section}>
            <View style={styles.guestHeroCard}>
              <View style={styles.guestIconWrap}>
                <Icon name="account-star" size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.guestHeroTitle}>{copy('profile.guestTitle')}</Text>
              <Text style={styles.guestHeroText}>
                {copy('profile.guestDescription')}
              </Text>

              <View style={styles.guestFeaturesList}>
                <View style={styles.guestFeatureRow}>
                  <Icon name="check-circle" size={18} color="#4cd964" />
                  <Text style={styles.guestFeatureText}>{copy('profile.guestListening')}</Text>
                </View>
                <View style={styles.guestFeatureRow}>
                  <Icon name="check-circle" size={18} color="#4cd964" />
                  <Text style={styles.guestFeatureText}>{copy('profile.guestFavorites')}</Text>
                </View>
                <View style={styles.guestFeatureRow}>
                  <Icon name="check-circle" size={18} color="#4cd964" />
                  <Text style={styles.guestFeatureText}>{copy('profile.guestEvents')}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.guestLoginButton}
                onPress={() => navigation.navigate('Auth', {screen: 'Login'})}>
                <Text style={styles.guestLoginButtonText}>{copy('profile.signIn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{copy('profile.showcase')}</Text>
            <View style={styles.showcaseCard}>
              <Text style={styles.showcaseTitle}>
                {profileCustomization.profile_headline || copy('profile.headlineEmpty')}
              </Text>
              <View style={styles.favoriteGrid}>
                <FavoriteDisplay
                  icon="music-note"
                  label={copy('profile.favoriteSong')}
                  value={[
                    profileCustomization.favorite_song_title,
                    profileCustomization.favorite_song_artist,
                  ].filter(Boolean).join(' · ') || copy('profile.notSelected')}
                />
                <FavoriteDisplay
                  icon="account-music"
                  label={copy('profile.favoriteArtist')}
                  value={profileCustomization.favorite_artist_name || copy('profile.notSelected')}
                />
                <FavoriteDisplay
                  icon="podcast"
                  label={copy('profile.favoritePodcast')}
                  value={profileCustomization.favorite_podcast_title || copy('profile.notSelected')}
                />
              </View>

              <Text style={styles.badgesTitle}>{copy('profile.badges')}</Text>
              {badges.length === 0 ? (
                <Text style={styles.emptyText}>{copy('profile.noBadges')}</Text>
              ) : (
                <View style={styles.badgeWrap}>
                  {badges.slice(0, 8).map((item) => (
                    <View key={item.id} style={styles.profileBadge}>
                      <Icon name={item.icon || 'shield-star-outline'} size={16} color={COLORS.primary} />
                      <Text style={styles.profileBadgeText} numberOfLines={1}>{item.title}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.editCard}>
              <Text style={styles.adminTitle}>{copy('profile.customize')}</Text>
              <TextInput
                style={styles.input}
                placeholder={copy('profile.headline')}
                placeholderTextColor={COLORS.textMuted}
                value={favoritesForm.profile_headline || ''}
                onChangeText={(value) => updateFavoriteField('profile_headline', value)}
              />
              <TextInput
                style={[styles.input, styles.inputSpacing]}
                placeholder={copy('profile.favoriteSong')}
                placeholderTextColor={COLORS.textMuted}
                value={favoritesForm.favorite_song_title || ''}
                onChangeText={(value) => updateFavoriteField('favorite_song_title', value)}
              />
              <TextInput
                style={[styles.input, styles.inputSpacing]}
                placeholder={copy('profile.favoriteArtist')}
                placeholderTextColor={COLORS.textMuted}
                value={favoritesForm.favorite_song_artist || ''}
                onChangeText={(value) => updateFavoriteField('favorite_song_artist', value)}
              />
              <TextInput
                style={[styles.input, styles.inputSpacing]}
                placeholder={copy('profile.favoriteArtist')}
                placeholderTextColor={COLORS.textMuted}
                value={favoritesForm.favorite_artist_name || ''}
                onChangeText={(value) => updateFavoriteField('favorite_artist_name', value)}
              />
              <TextInput
                style={[styles.input, styles.inputSpacing]}
                placeholder={copy('profile.favoritePodcast')}
                placeholderTextColor={COLORS.textMuted}
                value={favoritesForm.favorite_podcast_title || ''}
                onChangeText={(value) => updateFavoriteField('favorite_podcast_title', value)}
              />
              <TouchableOpacity
                style={[styles.saveProfileButton, isSavingProfile && styles.actionBtnDisabled]}
                onPress={handleSaveFavorites}
                disabled={isSavingProfile}
              >
                <Text style={styles.saveProfileButtonText}>
                  {isSavingProfile ? t('common.loading') : copy('common.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{copy('profile.androidSystem')}</Text>
          <View style={styles.readinessCard}>
            <TouchableOpacity style={styles.saveProfileButton} onPress={handleEnableNotifications}>
              <Text style={styles.saveProfileButtonText}>{copy('profile.enableNotifications')}</Text>
            </TouchableOpacity>

            <Text style={styles.badgesTitle}>{copy('profile.androidSystem')}</Text>
            <View style={styles.badgeWrap}>
              {(['podcast', 'radio', 'jukebox', 'events'] as Array<keyof NotificationPreferences>).map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.profileBadge,
                    notificationPreferences[key] ? styles.preferenceEnabled : styles.preferenceDisabled,
                    isSavingNotifications && styles.actionBtnDisabled,
                  ]}
                  onPress={() => handleNotificationPreferenceToggle(key)}
                  disabled={isSavingNotifications}
                >
                  <Icon
                    name={notificationPreferences[key] ? 'bell-check' : 'bell-off-outline'}
                    size={14}
                    color={notificationPreferences[key] ? COLORS.primary : COLORS.textMuted}
                  />
                  <Text style={styles.profileBadgeText}>{copy(`profile.notification.${key}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{copy('profile.admin')}</Text>
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowAdminTab(!showAdminTab)}>
              <View style={[styles.menuIconContainer, styles.adminMenuIconContainer]}>
                <Icon name="shield-account" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.menuText}>{copy('profile.admin')}</Text>
              <Icon
                name={showAdminTab ? 'chevron-up' : 'chevron-right'}
                size={24}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>

            {showAdminTab && (
              <View style={styles.adminPanel}>
                <Text style={styles.adminTitle}>{copy('profile.podcastFeeds')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={copy('profile.feedTitle')}
                  placeholderTextColor={COLORS.textMuted}
                  value={feedTitle}
                  onChangeText={setFeedTitle}
                />
                <TextInput
                  style={[styles.input, styles.inputSpacing]}
                  placeholder="https://example.com/feed.xml"
                  placeholderTextColor={COLORS.textMuted}
                  value={feedUrl}
                  onChangeText={setFeedUrl}
                  autoCapitalize="none"
                />
                <View style={styles.inputActions}>
                  <TouchableOpacity
                    style={[styles.addBtn, (isSavingFeed || isLoadingFeeds) && styles.actionBtnDisabled]}
                    onPress={handleAddFeed}
                    disabled={isSavingFeed || isLoadingFeeds}
                  >
                    <Icon name="plus" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.syncBtn, isSyncingFeeds && styles.actionBtnDisabled]}
                    onPress={handleSyncFeeds}
                    disabled={isSyncingFeeds}
                  >
                    <Icon name="sync" size={18} color="#fff" />
                    <Text style={styles.syncBtnText}>
                      {isSyncingFeeds ? copy('profile.syncing') : copy('profile.syncAll')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.adminTitle, { marginTop: SPACING.lg }]}>
                  {copy('profile.activeFeeds')}
                </Text>
                {isLoadingFeeds ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  </View>
                ) : savedFeeds.length === 0 ? (
                  <Text style={styles.emptyText}>{copy('profile.noFeeds')}</Text>
                ) : (
                  savedFeeds.map((feed) => (
                    <View key={feed.id} style={styles.feedRow}>
                      <Icon name="rss" size={20} color={COLORS.primary} />
                      <View style={styles.feedBody}>
                        <Text style={styles.feedTitle} numberOfLines={1}>
                          {feed.title}
                        </Text>
                        <Text style={styles.feedText} numberOfLines={1}>
                          {feed.feedUrl}
                        </Text>
                        {feed.lastSyncedAt ? (
                          <Text style={styles.feedMeta} numberOfLines={1}>
                            {copy('profile.lastSynced', {
                              date: formatFeedTimestamp(feed.lastSyncedAt, i18n.language),
                            })}
                          </Text>
                        ) : null}
                        {feed.lastSyncError ? (
                          <Text style={styles.feedError} numberOfLines={2}>
                            {copy('profile.lastSyncFailed')}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteFeed(feed)}>
                        <Icon name="trash-can-outline" size={20} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{copy('profile.appSection')}</Text>

          {!user || user.is_guest ? (
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: COLORS.primary }]}
              onPress={() => navigation.navigate('Auth', { screen: 'Login' })}
            >
              <View style={styles.menuIconContainer}>
                <Icon name="login" size={24} color="#fff" />
              </View>
              <Text style={[styles.menuText, styles.menuTextLight]}>{copy('profile.signIn')}</Text>
              <Icon name="chevron-right" size={24} color="#fff" />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Leaderboard')}>
            <View style={[styles.menuIconContainer, styles.trophyIconContainer]}>
              <Icon name="trophy-outline" size={24} color="#FFD700" />
            </View>
            <Text style={styles.menuText}>{copy('profile.leaderboard')}</Text>
            <Icon name="chevron-right" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Language')}>
            <View style={[styles.menuIconContainer, styles.settingsIconContainer]}>
              <Icon name="translate" size={24} color={COLORS.text} />
            </View>
            <Text style={styles.menuText}>{t('common.language')}</Text>
            <Icon name="chevron-right" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Privacy')}>
            <View style={[styles.menuIconContainer, styles.settingsIconContainer]}>
              <Icon name="shield-lock-outline" size={24} color={COLORS.text} />
            </View>
            <Text style={styles.menuText}>{t('privacy.title')}</Text>
            <Icon name="chevron-right" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { marginTop: SPACING.md }]} onPress={logout}>
            <View style={[styles.menuIconContainer, styles.logoutIconContainer]}>
              <Icon name="logout-variant" size={24} color={COLORS.error} />
            </View>
            <Text style={[styles.menuText, { color: COLORS.error }]}>{copy('profile.logout')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={() => setShowDeleteAccount((current) => !current)}
            disabled={isDeletingAccount}>
            <Icon name="account-remove-outline" size={22} color={COLORS.error} />
            <Text style={styles.deleteAccountButtonText}>{copy('profile.deleteAccount')}</Text>
          </TouchableOpacity>

          {showDeleteAccount ? (
            <View style={styles.deleteAccountPanel}>
              <Text style={styles.deleteAccountTitle}>{copy('profile.permanentDelete')}</Text>
              <Text style={styles.deleteAccountText}>
                {copy('profile.deleteDataText')}
              </Text>
              <TextInput
                style={styles.deleteAccountInput}
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
                autoCapitalize="characters"
                placeholder={copy('profile.typeDelete')}
                placeholderTextColor={COLORS.textMuted}
                editable={!isDeletingAccount}
              />
              {!user?.is_guest ? (
                <TextInput
                  style={styles.deleteAccountInput}
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  secureTextEntry
                  placeholder={copy('profile.currentPassword')}
                  placeholderTextColor={COLORS.textMuted}
                  editable={!isDeletingAccount}
                />
              ) : null}
              <TouchableOpacity
                style={styles.deleteAccountConfirmButton}
                onPress={handleDeleteAccount}
                disabled={isDeletingAccount}>
                {isDeletingAccount ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.deleteAccountConfirmText}>{copy('profile.deletePermanently')}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

function FavoriteDisplay({icon, label, value}: {icon: string; label: string; value: string}) {
  return (
    <View style={styles.favoriteTile}>
      <Icon name={icon} size={20} color={COLORS.primary} />
      <Text style={styles.favoriteLabel}>{label}</Text>
      <Text style={styles.favoriteValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  navbarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  navbarSpacer: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  headerCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    marginTop: SPACING.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(227,30,36,0.18)',
  },
  avatarInitials: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '900',
  },
  badge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: COLORS.primary,
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  badgeLoading: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  userInfo: {
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  role: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  statCard: {
    backgroundColor: COLORS.card,
    flex: 1,
    marginHorizontal: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  section: {
    marginTop: SPACING.xl,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.md,
    marginLeft: SPACING.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: SPACING.sm,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  adminMenuIconContainer: {
    backgroundColor: 'rgba(227, 30, 36, 0.1)',
  },
  trophyIconContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  settingsIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  logoutIconContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 16,
    marginBottom: SPACING.sm,
  },
  deleteAccountButtonText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: '700',
  },
  deleteAccountPanel: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.35)',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  deleteAccountTitle: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  deleteAccountText: {
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  deleteAccountInput: {
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  deleteAccountConfirmButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: COLORS.error,
  },
  deleteAccountConfirmText: {
    color: '#fff',
    fontWeight: '800',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  menuTextLight: {
    color: '#fff',
  },
  adminPanel: {
    backgroundColor: 'rgba(227, 30, 36, 0.05)',
    padding: SPACING.md,
    borderRadius: 16,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(227, 30, 36, 0.2)',
  },
  readinessCard: {
    padding: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  preferenceEnabled: {
    borderColor: 'rgba(227, 30, 36, 0.35)',
  },
  preferenceDisabled: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  adminTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.background,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputSpacing: {
    marginTop: SPACING.sm,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  syncBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: 48,
    borderRadius: 12,
  },
  syncBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  loadingRow: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: 10,
    marginTop: SPACING.xs,
  },
  feedBody: {
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  feedTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  feedText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  feedMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  feedError: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontStyle: 'italic',
    fontSize: 13,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  showcaseCard: {
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  showcaseTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
  },
  favoriteGrid: {
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  favoriteTile: {
    padding: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  favoriteLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: SPACING.sm,
  },
  favoriteValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  badgesTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '48%',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(227, 30, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(227, 30, 36, 0.25)',
  },
  profileBadgeText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  editCard: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveProfileButton: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginTop: SPACING.md,
  },
  saveProfileButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  guestHeroCard: {
    padding: SPACING.lg,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(227, 30, 36, 0.25)',
    alignItems: 'center',
  },
  guestIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(227, 30, 36, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  guestHeroTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  guestHeroText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  guestFeaturesList: {
    width: '100%',
    gap: 8,
    marginBottom: SPACING.lg,
  },
  guestFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guestFeatureText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  guestLoginButton: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestLoginButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});

function resolveAvatarUrl(value: string | null | undefined, storageRoot: string): string | null {
  const avatar = value?.trim();
  if (!avatar) {
    return null;
  }
  if (/^https?:\/\//i.test(avatar)) {
    return avatar;
  }
  return `${storageRoot.replace(/\/$/, '')}/${avatar.replace(/^\//, '')}`;
}

export function getInitials(value: string): string {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => Array.from(part)[0] ?? '')
    .join('');
  return (initials || 'R').toLocaleUpperCase();
}

function formatFeedTimestamp(value: string, language: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  const locale = {
    en: 'en-US',
    tr: 'tr-TR',
    ru: 'ru-RU',
    ar: 'ar',
    de: 'de-DE',
    fr: 'fr-FR',
  }[language.split(/[-_]/)[0]];

  return parsedDate.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default ProfileScreen;
