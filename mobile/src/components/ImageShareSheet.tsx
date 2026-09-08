import React, {forwardRef, useRef, useState} from 'react';
import {ActivityIndicator, Alert, findNodeHandle, Image, Modal, NativeModules, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';

const labels: Record<string, string[]> = {
  en: ['Share image', 'Story', 'Square', 'Close', 'Could not create image. Please try again.'],
  tr: ['Görsel paylaş', 'Hikâye', 'Kare', 'Kapat', 'Görsel oluşturulamadı. Tekrar deneyin.'],
  de: ['Bild teilen', 'Story', 'Quadrat', 'Schließen', 'Bild konnte nicht erstellt werden. Erneut versuchen.'],
  fr: ['Partager une image', 'Story', 'Carré', 'Fermer', 'Impossible de créer l’image. Réessayez.'],
  ru: ['Поделиться изображением', 'История', 'Квадрат', 'Закрыть', 'Не удалось создать изображение. Повторите попытку.'],
  ar: ['مشاركة صورة', 'قصة', 'مربع', 'إغلاق', 'تعذر إنشاء الصورة. حاول مجددًا.'],
};
export interface ShareCardData {
  title: string; artist?: string; body?: string; artwork?: string; station?: string;
}
export const ShareCard = forwardRef<View, ShareCardData & {square: boolean}>((data, ref) => (
  <View ref={ref} collapsable={false} style={[styles.card, {aspectRatio: data.square ? 1 : 9 / 16}]}>
    <Text style={styles.brand}>RadioTEDU</Text>
    <View style={styles.heading}>
      <View style={styles.artwork}>
        <Image source={require('../assets/images/logo-03byz.png')} style={styles.artworkFill} resizeMode="contain" />
        {data.artwork ? <Image source={{uri: data.artwork}} style={styles.artworkFill} /> : null}
      </View>
      <View style={styles.track}>
        <Text numberOfLines={2} style={styles.title}>{data.title}</Text>
        {!!data.artist && <Text numberOfLines={2} style={styles.artist}>{data.artist}</Text>}
      </View>
    </View>
    <View style={styles.body}>
      <Text adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={data.square ? 6 : 14}
        style={[styles.quote, {fontSize: data.square ? 23 : 30}]}>{data.body || data.station || 'RadioTEDU'}</Text>
    </View>
    <Text style={styles.footer}>{data.station || 'RadioTEDU'} · radiotedu.com</Text>
  </View>
));

export async function shareCardImage(view: View | null, title: string, save = false): Promise<void> {
  const tag = view && findNodeHandle(view);
  if (!tag || !NativeModules.RadioTeduImageShare?.share) {throw new Error('PNG sharing unavailable');}
  await NativeModules.RadioTeduImageShare.share(tag, title, save);
}

export function ImageShareContent({data, fixedActions = false}: {data: ShareCardData; fixedActions?: boolean}) {
  const {i18n} = useTranslation();
  const copy = labels[i18n.language.split('-')[0]] || labels.en;
  const ref = useRef<View>(null);
  const [square, setSquare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const share = async (save = false) => {
    if (busy || !ready) {return;}
    setBusy(true);
    try {await shareCardImage(ref.current, data.title, save);}
    catch {Alert.alert(copy[0], copy[4]);}
    finally {setBusy(false);}
  };
  const preview = <>
    <View style={styles.formats}>{[false, true].map((value, index) =>
      <TouchableOpacity key={String(value)} accessibilityRole="button" accessibilityState={{selected: square === value}}
        disabled={busy} onPress={() => {
          if (square !== value) {setReady(false); setSquare(value);}
        }} style={[styles.format, square === value && styles.selected]}>
        <Text style={styles.text}>{copy[index + 1]}</Text>
      </TouchableOpacity>)}</View>
    <View onLayout={() => setReady(true)}><ShareCard ref={ref} {...data} square={square} /></View>
  </>;
  return <View style={fixedActions ? styles.viewport : undefined}>
    {fixedActions ? <ScrollView style={styles.viewport} contentContainerStyle={styles.scroll}>{preview}</ScrollView> : preview}
    <View style={fixedActions ? styles.actions : undefined}>
    <TouchableOpacity accessibilityRole="button" disabled={busy || !ready} onPress={() => share()} style={styles.share}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.text}>{copy[0]} · PNG</Text>}
    </TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" disabled={busy || !ready} onPress={() => share(true)} style={styles.format}>
      <Text style={styles.text}>{({tr: 'PNG kaydet', de: 'PNG speichern', fr: 'Enregistrer PNG', ru: 'Сохранить PNG', ar: 'حفظ PNG'} as Record<string, string>)[i18n.language.split('-')[0]] || 'Save PNG'}</Text>
    </TouchableOpacity>
    </View>
  </View>;
}

export default function ImageShareSheet({data, onClose}: {data: ShareCardData | null; onClose: () => void}) {
  const {i18n} = useTranslation();
  const copy = labels[i18n.language.split('-')[0]] || labels.en;
  return <Modal visible={!!data} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}><View style={styles.sheet}>
      <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.close}><Text style={styles.text}>{copy[3]}</Text></TouchableOpacity>
      {data && <ImageShareContent data={data} fixedActions />}
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end'},
  sheet: {height: '92%', backgroundColor: '#111318', borderTopLeftRadius: 24, borderTopRightRadius: 24},
  viewport: {flex: 1},
  actions: {paddingHorizontal: 20, paddingBottom: 28, backgroundColor: '#111318'},
  scroll: {padding: 20, paddingBottom: 44}, close: {padding: 18, alignItems: 'flex-end'},
  card: {width: '100%', backgroundColor: '#36131F', padding: 22, overflow: 'hidden'},
  brand: {color: '#FFF5E8', fontWeight: '900', fontSize: 18, marginBottom: 24},
  heading: {flexDirection: 'row', gap: 12, alignItems: 'center'},
  artwork: {width: 56, height: 56, borderRadius: 6, backgroundColor: '#532333'}, track: {flex: 1},
  artworkFill: {position: 'absolute', width: '100%', height: '100%', borderRadius: 6},
  title: {color: '#FFF5E8', fontWeight: '800', fontSize: 17}, artist: {color: '#DCB6C0', fontSize: 13, marginTop: 4},
  body: {flex: 1, justifyContent: 'center', paddingVertical: 15}, quote: {color: '#FFF5E8', fontWeight: '800'},
  footer: {color: '#DCB6C0', fontSize: 11}, text: {color: '#fff', fontWeight: '700'},
  formats: {flexDirection: 'row', gap: 10, marginBottom: 16}, format: {padding: 12, borderRadius: 10, backgroundColor: '#262A32'},
  selected: {backgroundColor: '#893149'}, share: {backgroundColor: '#C72640', padding: 17, borderRadius: 14, marginTop: 16, alignItems: 'center'},
});
