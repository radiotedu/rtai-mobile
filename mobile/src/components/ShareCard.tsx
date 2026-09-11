import React, {forwardRef, useState} from 'react';
import {Image, Platform, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';

export interface ShareCardData {
  title: string; artist?: string; body?: string; artwork?: string; station?: string;
  recap?: {minutes: number; favorite: string | null; peak: string | null};
}

const words: Record<string, string[]> = {
  en: ['MY WEEK', 'On repeat.', 'minutes of radio', 'FAVORITE STATION', 'LISTENING HOURS', 'ALL-TIME FAVORITES', 'LISTEN WITH ME', 'NOW PLAYING', 'WORDS ON REPEAT'],
  tr: ['BU HAFTAM', 'Hep yeniden.', 'dakika radyo', 'FAVORİ İSTASYON', 'DİNLEME SAATLERİ', 'TÜM ZAMANLAR', 'BENİMLE DİNLE', 'ŞİMDİ ÇALIYOR', 'AKLIMDAKİ SÖZLER'],
  de: ['MEINE WOCHE', 'In Dauerschleife.', 'Minuten Radio', 'LIEBLINGSSENDER', 'HÖRZEITEN', 'ALLZEIT-FAVORITEN', 'HÖR MIT MIR', 'LÄUFT GERADE', 'WORTE AUF REPEAT'],
  fr: ['MA SEMAINE', 'En boucle.', 'minutes de radio', 'STATION FAVORITE', 'HEURES D’ÉCOUTE', 'DEPUIS LE DÉBUT', 'ÉCOUTE AVEC MOI', 'EN CE MOMENT', 'DES MOTS EN BOUCLE'],
  ru: ['МОЯ НЕДЕЛЯ', 'На повторе.', 'минут радио', 'ЛЮБИМАЯ СТАНЦИЯ', 'ЧАСЫ ПРОСЛУШИВАНИЯ', 'ЗА ВСЁ ВРЕМЯ', 'СЛУШАЙ СО МНОЙ', 'СЕЙЧАС ИГРАЕТ', 'СЛОВА НА ПОВТОРЕ'],
  ar: ['أسبوعي', 'على التكرار.', 'دقيقة راديو', 'المحطة المفضلة', 'ساعات الاستماع', 'طوال الوقت', 'استمع معي', 'يعمل الآن', 'كلمات تتكرر'],
};

/** Decorative record grooves, never presented as listening activity data. */
function RecordArt({compact = false}: {compact?: boolean}) {
  return <View style={[s.record, compact && {width: '36%', right: 0}]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {[0, 1, 2, 3, 4, 5].map(n => <View key={n} style={[s.groove, {width: `${94 - n * 10}%`, height: `${94 - n * 10}%`}]} />)}
    <View style={s.recordLabel}><View style={s.spindle} /></View>
  </View>;
}

export const ShareCard = forwardRef<View, ShareCardData & {square: boolean}>((data, ref) => {
  const {i18n} = useTranslation();
  const copy = words[i18n.language.split('-')[0]] || words.en;
  const [width, setWidth] = useState(320);
  const scale = width / 360;
  const font = (size: number) => ({fontSize: size * scale});
  const recap = data.recap;
  return <View ref={ref} collapsable={false} onLayout={e => setWidth(e.nativeEvent.layout.width)}
    style={[s.card, {aspectRatio: data.square ? 1 : 9 / 16, padding: 24 * scale}]}>
    <View style={s.masthead}>
      <Image source={require('../assets/images/logo-03byz.png')} resizeMode="contain" style={{width: 112 * scale, height: 26 * scale}} />
      <Text allowFontScaling={false} style={[s.edition, font(9)]}>{recap ? copy[0] : data.body ? copy[8] : copy[7]}</Text>
    </View>
    {recap ? <>
      <Text allowFontScaling={false} numberOfLines={2} adjustsFontSizeToFit style={[s.headline, font(data.square ? 24 : 40), {marginTop: (data.square ? 12 : 24) * scale}]}>{copy[1]}</Text>
      <View style={s.recapHero}>
        <RecordArt compact={data.square} />
        <View style={[s.numberBlock, data.square && {paddingVertical: 0}]}>
          <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}
            style={[s.number, font(data.square ? 72 : 130)]}>{Math.max(0, Math.floor(recap.minutes)).toLocaleString(i18n.language)}</Text>
          <Text allowFontScaling={false} style={[s.minuteLabel, font(14)]}>{copy[2]}</Text>
        </View>
      </View>
      <View style={[s.stats, {padding: (data.square ? 12 : 16) * scale, gap: (data.square ? 8 : 12) * scale}]}>
        <Text allowFontScaling={false} style={[s.statsCaption, font(8)]}>{copy[5]}</Text>
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text allowFontScaling={false} style={[s.statLabel, font(8)]}>{copy[3]}</Text>
            <Text allowFontScaling={false} numberOfLines={2} adjustsFontSizeToFit style={[s.statValue, font(18)]}>{recap.favorite || '—'}</Text>
          </View>
          <View style={[s.stat, s.secondStat]}>
            <Text allowFontScaling={false} style={[s.statLabel, font(8)]}>{copy[4]}</Text>
            <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={[s.statValue, font(18)]}>{recap.peak || '—'}</Text>
          </View>
        </View>
      </View>
    </> : <View style={[s.music, data.square && !data.body && s.squareMusic, {gap: 18 * scale}]}>
      <View style={[s.cover, data.square && s.squareCover, !!data.body && s.lyricCover]}>
        <RecordArt />
        {data.artwork ? <Image source={{uri: data.artwork}} resizeMode="cover" style={StyleSheet.absoluteFillObject} /> : null}
      </View>
      {!!data.body && <Text allowFontScaling={false} numberOfLines={data.square ? 5 : 8} adjustsFontSizeToFit minimumFontScale={0.5}
        style={[s.lyrics, font(data.square ? 22 : 30)]}>“{data.body}”</Text>}
      <View style={[s.trackInfo, data.square && !data.body && {flex: 1}]}>
        <Text allowFontScaling={false} numberOfLines={2} adjustsFontSizeToFit style={[s.trackTitle, font(data.square ? 22 : 30)]}>{data.title}</Text>
        {!!data.artist && <Text allowFontScaling={false} numberOfLines={2} adjustsFontSizeToFit style={[s.artist, font(14)]}>{data.artist}</Text>}
        {!!data.station && <Text allowFontScaling={false} numberOfLines={1} style={[s.station, font(10)]}>{data.station}</Text>}
      </View>
    </View>}
    <View style={[s.footer, {paddingTop: (data.square ? 12 : 18) * scale}]}>
      <Text allowFontScaling={false} style={[s.footerCall, font(9)]}>{copy[6]} ↗</Text>
      <Text allowFontScaling={false} style={[s.footerUrl, font(10)]}>radiotedu.com</Text>
    </View>
  </View>;
});

const s = StyleSheet.create({
  card: {width: '100%', backgroundColor: '#111111', overflow: 'hidden'},
  masthead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12},
  edition: {color: '#D3CBBF', letterSpacing: 1.3, flexShrink: 1, textAlign: 'right'},
  headline: {color: '#F9F1E2', fontWeight: '800', letterSpacing: -1.4, maxWidth: '95%'},
  recapHero: {flex: 1, justifyContent: 'center', minHeight: 100, overflow: 'hidden'},
  record: {position: 'absolute', width: '100%', aspectRatio: 1, borderRadius: 999, backgroundColor: '#E72B35', alignItems: 'center', justifyContent: 'center', right: '-37%', transform: [{rotate: '-22deg'}]},
  groove: {position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: '#A41320'},
  recordLabel: {width: '29%', height: '29%', backgroundColor: '#F9B7AB', borderRadius: 999, alignItems: 'center', justifyContent: 'center'},
  spindle: {width: '12%', height: '12%', borderRadius: 99, backgroundColor: '#111111'},
  numberBlock: {width: '77%', paddingVertical: 10},
  number: {color: '#F9F1E2', fontFamily: Platform.OS === 'android' ? 'sans-serif-condensed' : 'Helvetica Neue', fontWeight: '900', letterSpacing: -4, includeFontPadding: false},
  minuteLabel: {color: '#F9F1E2', fontWeight: '600'},
  stats: {backgroundColor: '#F9F1E2', borderRadius: 4},
  statsCaption: {color: '#74675E', letterSpacing: 1.2},
  statsRow: {flexDirection: 'row'}, stat: {flex: 1, gap: 6},
  secondStat: {paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: '#D5CDC0'},
  statLabel: {color: '#74675E', letterSpacing: 0.6}, statValue: {color: '#181818', fontWeight: '800', letterSpacing: -0.6},
  music: {flex: 1, justifyContent: 'center', paddingTop: 20},
  cover: {width: '100%', aspectRatio: 1, backgroundColor: '#291719', overflow: 'hidden', borderRadius: 4, flexShrink: 1},
  squareMusic: {flexDirection: 'row', alignItems: 'center'},
  squareCover: {width: '48%', alignSelf: 'center', flexShrink: 0}, lyricCover: {width: '23%', alignSelf: 'flex-start'},
  lyrics: {color: '#F9F1E2', fontWeight: '700', letterSpacing: -0.8, flexShrink: 1},
  trackInfo: {gap: 6}, trackTitle: {color: '#F9F1E2', fontWeight: '800', letterSpacing: -0.8},
  artist: {color: '#D3CBBF'}, station: {color: '#F18A8C'},
  footer: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8},
  footerCall: {color: '#F9F1E2', letterSpacing: 1, fontWeight: '700', flexShrink: 1},
  footerUrl: {color: '#B8AFA5'},
});
