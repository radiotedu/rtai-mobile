import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {RADIO_CHANNELS} from '../data/radioChannels';
import {getChannelCopy} from '../i18n/channelCopy';
import {discoveryCopy} from '../i18n/discoveryCopy';
import {screenCopy} from '../i18n/screenCopy';
import {openPlayerModal} from '../navigation/navigationRef';
import {playChannelById} from '../services/playbackQueue';
import {fetchPodcasts, Podcast} from '../services/podcastService';
import {COLORS, SPACING} from '../theme/theme';
import {logSafeError} from '../utils/safeLog';

export default function HomeDiscovery({refreshKey}: {refreshKey: number}) {
  const navigation = useNavigation<any>();
  const {i18n} = useTranslation();
  const copy = discoveryCopy(i18n.language);
  const [episodes, setEpisodes] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    fetchPodcasts(1).then(result => {
      if (active) { setEpisodes(result.items.slice(0, 3)); }
    }).catch(error => {
      logSafeError('home.podcasts', error);
      if (active) { setFailed(true); }
    }).finally(() => { if (active) { setLoading(false); } });
    return () => { active = false; };
    // A pull-to-refresh refreshes the public catalog as well as account data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, refreshKey]));

  const play = async (id: string) => {
    try {
      await playChannelById(id);
      openPlayerModal();
    } catch (error) {
      logSafeError('home.station', error);
      Alert.alert('RadioTEDU', copy.playError);
    }
  };
  const all = screenCopy(i18n.language, 'home.all');

  return (
    <View>
      <View style={styles.hero}>
        <Text style={styles.brand}>RadioTEDU</Text>
        <Text style={styles.headline}>{copy.headline}</Text>
        <Text style={styles.intro}>{copy.intro}</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.listen} onPress={() => play('radiotedu-main')}>
          <Icon name="play" size={22} color="#fff" />
          <Text style={styles.listenText}>{copy.listen}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.heading}>
        <Text style={styles.sectionTitle}>{copy.stations}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${copy.stations}: ${all}`} style={styles.sectionLink} onPress={() => navigation.navigate('Radio')}>
          <Text style={styles.link}>{all}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
        {RADIO_CHANNELS.map(channel => {
          const localized = getChannelCopy(channel.copyKey, i18n.language, channel);
          return (
            <TouchableOpacity key={channel.id} accessibilityRole="button" accessibilityLabel={`${localized.name}: ${copy.listen}`} style={styles.station} onPress={() => play(channel.id)}>
              <View style={[styles.stationMark, {backgroundColor: channel.color || COLORS.primary}]} />
              <Icon name="radio" size={25} color={COLORS.text} />
              <Text style={styles.stationTitle}>{localized.name}</Text>
              <Text style={styles.meta}>{localized.description}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.heading}>
        <Text style={styles.sectionTitle}>{copy.podcasts}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${copy.podcasts}: ${all}`} style={styles.sectionLink} onPress={() => navigation.navigate('Podcasts', {podcastId: undefined})}>
          <Text style={styles.link}>{all}</Text>
        </TouchableOpacity>
      </View>
      {loading && episodes.length === 0 ? <ActivityIndicator accessibilityLabel={copy.podcasts} color={COLORS.primary} style={styles.loader} /> : null}
      {failed ? (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={copy.retry} style={styles.episode} onPress={() => setAttempt(value => value + 1)}>
          <Text style={styles.meta}>{copy.podcastError} {copy.retry}</Text>
        </TouchableOpacity>
      ) : !loading && episodes.length === 0 ? (
        <TouchableOpacity accessibilityRole="button" style={styles.episode} onPress={() => navigation.navigate('Podcasts', {podcastId: undefined})}>
          <Text style={styles.meta}>{copy.podcastEmpty}</Text>
        </TouchableOpacity>
      ) : null}
      {episodes.map(episode => (
        <TouchableOpacity key={episode.id} accessibilityRole="button" style={styles.episode} onPress={() => navigation.navigate('Podcasts', {podcastId: episode.id})}>
          {episode.imageUrl ? <Image source={{uri: episode.imageUrl}} style={styles.artwork} accessibilityIgnoresInvertColors /> : <Icon name="podcast" size={40} color={COLORS.textMuted} />}
          <View style={styles.episodeBody}>
            <Text style={styles.meta} numberOfLines={1}>{episode.feedTitle}</Text>
            <Text style={styles.episodeTitle} numberOfLines={2}>{episode.title}</Text>
            <Text style={styles.meta}>{episode.date}</Text>
          </View>
          <Icon name="chevron-right" size={22} color={COLORS.textMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {padding: SPACING.lg, borderRadius: 22, backgroundColor: '#23090B', borderLeftWidth: 4, borderLeftColor: '#E31E26'},
  brand: {color: '#fff', fontSize: 14, fontWeight: '800'},
  headline: {color: '#fff', fontSize: 28, lineHeight: 35, fontWeight: '900', marginTop: SPACING.md},
  intro: {color: '#D7CBCD', fontSize: 14, lineHeight: 21, marginTop: SPACING.sm},
  listen: {alignSelf: 'flex-start', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.lg, backgroundColor: '#E31E26', borderRadius: 12, marginTop: SPACING.lg},
  listenText: {color: '#fff', fontSize: 15, fontWeight: '800'},
  heading: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.lg},
  sectionTitle: {flex: 1, color: COLORS.text, fontSize: 18, fontWeight: '800'},
  sectionLink: {minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACING.sm},
  link: {color: COLORS.text, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline'},
  shelf: {gap: SPACING.sm},
  station: {width: 148, minHeight: 134, padding: SPACING.md, backgroundColor: COLORS.card, borderRadius: 14, overflow: 'hidden'},
  stationMark: {position: 'absolute', top: 0, left: 0, right: 0, height: 3},
  stationTitle: {color: COLORS.text, fontWeight: '800', fontSize: 16, marginTop: SPACING.sm, marginBottom: 4},
  meta: {color: COLORS.textMuted, fontSize: 12, lineHeight: 18},
  episode: {minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border},
  artwork: {width: 56, height: 56, borderRadius: 8},
  episodeBody: {flex: 1, gap: 3},
  episodeTitle: {color: COLORS.text, fontSize: 15, lineHeight: 21, fontWeight: '700'},
  loader: {padding: SPACING.lg},
});
