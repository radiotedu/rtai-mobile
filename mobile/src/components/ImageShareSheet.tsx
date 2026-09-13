import React, {useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  findNodeHandle,
  Modal,
  NativeModules,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ShareCard, ShareCardData} from './ShareCard';
export {ShareCard} from './ShareCard';
export type {ShareCardData} from './ShareCard';

interface ShareLabels {
  title: string;
  share: string;
  save: string;
  story: string;
  square: string;
  close: string;
  error: string;
}

const labels: Record<string, ShareLabels> = {
  tr: {
    title: 'Paylaş',
    share: 'Paylaş',
    save: 'Kaydet',
    story: 'Hikâye (9:16)',
    square: 'Kare (1:1)',
    close: 'Kapat',
    error: 'Görsel oluşturulamadı. Tekrar deneyin.',
  },
  en: {
    title: 'Share',
    share: 'Share',
    save: 'Save',
    story: 'Story (9:16)',
    square: 'Square (1:1)',
    close: 'Close',
    error: 'Could not create image. Please try again.',
  },
  de: {
    title: 'Teilen',
    share: 'Teilen',
    save: 'Speichern',
    story: 'Story (9:16)',
    square: 'Quadrat (1:1)',
    close: 'Schließen',
    error: 'Bild konnte nicht erstellt werden. Erneut versuchen.',
  },
  fr: {
    title: 'Partager',
    share: 'Partager',
    save: 'Enregistrer',
    story: 'Story (9:16)',
    square: 'Carré (1:1)',
    close: 'Fermer',
    error: 'Impossible de créer l’image. Réessayez.',
  },
  ru: {
    title: 'Поделиться',
    share: 'Поделиться',
    save: 'Сохранить',
    story: 'История (9:16)',
    square: 'Квадрат (1:1)',
    close: 'Закрыть',
    error: 'Не удалось создать изображение. Повторите попытку.',
  },
  ar: {
    title: 'مشاركة',
    share: 'مشاركة',
    save: 'حفظ',
    story: 'قصة (9:16)',
    square: 'مربع (1:1)',
    close: 'إغلاق',
    error: 'تعذر إنشاء الصورة. حاول مجددًا.',
  },
};

export async function shareCardImage(view: View | null, title: string, save = false): Promise<void> {
  const tag = view && findNodeHandle(view);
  if (!tag || !NativeModules.RadioTeduImageShare?.share) {
    throw new Error('PNG sharing unavailable');
  }
  await NativeModules.RadioTeduImageShare.share(tag, title, save);
}

export function ImageShareContent({
  data,
  fixedActions = false,
  bottomInset = 0,
}: {
  data: ShareCardData;
  fixedActions?: boolean;
  bottomInset?: number;
}) {
  const {i18n} = useTranslation();
  const lang = i18n.language.split('-')[0];
  const copy = labels[lang] || labels.en;
  const ref = useRef<View>(null);
  const [square, setSquare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const share = async (save = false) => {
    if (busy || !ready) {
      return;
    }
    setBusy(true);
    try {
      await shareCardImage(ref.current, data.title, save);
    } catch {
      Alert.alert(copy.share, copy.error);
    } finally {
      setBusy(false);
    }
  };

  const preview = (
    <View style={styles.previewSection}>
      <View style={styles.formatContainer}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{selected: !square}}
          disabled={busy}
          onPress={() => {
            if (square) {
              setReady(false);
              setSquare(false);
            }
          }}
          style={[styles.formatPill, !square && styles.formatPillSelected]}>
          <Icon name="cellphone" size={15} color={!square ? '#fff' : 'rgba(255,255,255,0.6)'} />
          <Text style={[styles.formatPillText, !square && styles.formatPillTextSelected]}>
            {copy.story}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{selected: square}}
          disabled={busy}
          onPress={() => {
            if (!square) {
              setReady(false);
              setSquare(true);
            }
          }}
          style={[styles.formatPill, square && styles.formatPillSelected]}>
          <Icon name="crop-square" size={15} color={square ? '#fff' : 'rgba(255,255,255,0.6)'} />
          <Text style={[styles.formatPillText, square && styles.formatPillTextSelected]}>
            {copy.square}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.previewWrapper}>
        <View
          style={square ? styles.cardContainerSquare : styles.cardContainerStory}
          onLayout={() => setReady(true)}>
          <ShareCard ref={ref} {...data} square={square} />
        </View>
      </View>
    </View>
  );

  const actionButtons = (
    <View
      style={
        fixedActions
          ? [styles.actionsBar, {paddingBottom: Math.max(bottomInset, 16) + 8}]
          : styles.inlineActions
      }>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={copy.save}
        disabled={busy || !ready}
        onPress={() => share(true)}
        style={styles.saveButton}>
        <Icon name="download" size={18} color="#fff" />
        <Text style={styles.saveButtonText}>{copy.save}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={copy.share}
        disabled={busy || !ready}
        onPress={() => share(false)}
        style={styles.shareButton}>
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Icon name="share-variant" size={18} color="#fff" />
            <Text style={styles.buttonText}>{copy.share}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  if (fixedActions) {
    return (
      <View style={styles.viewport}>
        <ScrollView
          style={styles.viewport}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {preview}
        </ScrollView>
        {actionButtons}
      </View>
    );
  }

  return (
    <View>
      {preview}
      {actionButtons}
    </View>
  );
}

export default function ImageShareSheet({
  data,
  onClose,
}: {
  data: ShareCardData | null;
  onClose: () => void;
}) {
  const {i18n} = useTranslation();
  const lang = i18n.language.split('-')[0];
  const copy = labels[lang] || labels.en;
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={!!data} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{copy.title}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={copy.close}
              onPress={onClose}
              style={styles.closeButton}>
              <Icon name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {data && <ImageShareContent data={data} fixedActions bottomInset={insets.bottom} />}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '90%',
    backgroundColor: '#13141B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewport: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  previewSection: {
    alignItems: 'center',
    width: '100%',
  },
  formatContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 3,
    marginBottom: 16,
    alignSelf: 'center',
    gap: 4,
  },
  formatPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  formatPillSelected: {
    backgroundColor: '#E31E24',
  },
  formatPillText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  formatPillTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  previewWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 4,
  },
  cardContainerStory: {
    width: 240,
    aspectRatio: 9 / 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  cardContainerSquare: {
    width: 290,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#13141B',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  saveButton: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E31E24',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#E31E24',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

