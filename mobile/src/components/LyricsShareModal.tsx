import React, {useState, useEffect, useMemo} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {ImageShareContent} from './ImageShareSheet';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useTranslation} from 'react-i18next';
import {appCopy} from '../i18n/appCopy';
import {COLORS, SPACING} from '../theme/theme';

interface LyricsShareModalProps {
  visible: boolean;
  onClose: () => void;
  lyricsLines: string[];
  initialLineIndex?: number;
  trackTitle: string;
  trackArtist: string;
  artworkUrl?: string;
  stationColor?: string;
  stationName?: string;
}

const FALLBACK_ARTWORK = 'https://radiotedu.com/wp-content/uploads/2026/08/radiotedu-station-logos-v2/radiotedu.png';
const MAX_SELECTABLE_LINES = 4;

export const LyricsShareModal: React.FC<LyricsShareModalProps> = ({
  visible,
  onClose,
  lyricsLines,
  initialLineIndex = 0,
  trackTitle,
  trackArtist,
  artworkUrl,
  stationColor = COLORS.primary,
  stationName = 'RadioTEDU',
}) => {
  const {i18n} = useTranslation();
  const copy = (key: string, values: Record<string, string | number> = {}) =>
    appCopy(i18n.language, key, values);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  useEffect(() => {
    if (visible && lyricsLines.length > 0) {
      const validIdx = Math.max(0, Math.min(initialLineIndex, lyricsLines.length - 1));
      // Pre-select 1 or 2 lines starting from initialLineIndex
      const initial: number[] = [validIdx];
      if (validIdx + 1 < lyricsLines.length && lyricsLines[validIdx + 1].trim().length > 0) {
        initial.push(validIdx + 1);
      }
      setSelectedIndices(initial);
    }
  }, [visible, initialLineIndex, lyricsLines]);

  const toggleLine = (index: number) => {
    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        if (prev.length === 1) return prev; // Keep at least 1 line
        return prev.filter(i => i !== index).sort((a, b) => a - b);
      }
      if (prev.length >= MAX_SELECTABLE_LINES) {
        // Replace oldest or keep max 4
        return [...prev.slice(1), index].sort((a, b) => a - b);
      }
      return [...prev, index].sort((a, b) => a - b);
    });
  };

  const selectedText = useMemo(() => {
    return selectedIndices
      .map(i => lyricsLines[i]?.trim())
      .filter(Boolean)
      .join('\n');
  }, [selectedIndices, lyricsLines]);


  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Icon name="format-quote-close" size={22} color={stationColor} />
              <Text style={styles.headerTitle}>{copy('lyrics.shareTitle')}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel={copy('common.close')}>
              <Icon name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <ImageShareContent data={{title: trackTitle, artist: trackArtist,
              body: selectedText, artwork: artworkUrl || FALLBACK_ARTWORK, station: stationName}} />

            {/* Line Selection Tool */}
            <View style={styles.selectionSection}>
              <View style={styles.selectionHeader}>
                <Text style={styles.selectionTitle}>{copy('lyrics.selectLines')}</Text>
                <Text style={styles.selectionCounter}>
                  {selectedIndices.length}/{MAX_SELECTABLE_LINES}
                </Text>
              </View>

              <View style={styles.linesList}>
                {lyricsLines.slice(0, 30).map((line, idx) => {
                  if (!line.trim()) return null;
                  const isSelected = selectedIndices.includes(idx);
                  return (
                    <TouchableOpacity
                      key={`${idx}-${line}`}
                      style={[
                        styles.lineItem,
                        isSelected && [
                          styles.lineItemSelected,
                          {borderColor: stationColor, backgroundColor: `${stationColor}18`},
                        ],
                      ]}
                      onPress={() => toggleLine(idx)}
                      activeOpacity={0.7}>
                      <Icon
                        name={isSelected ? 'check-circle' : 'circle-outline'}
                        size={18}
                        color={isSelected ? stationColor : COLORS.textMuted}
                        style={styles.lineIcon}
                      />
                      <Text
                        style={[
                          styles.lineItemText,
                          isSelected && styles.lineItemTextSelected,
                        ]}
                        numberOfLines={2}>
                        {line}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>

          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#12161A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: 8,
  },
  closeButton: {
    padding: 6,
  },
  scrollArea: {
    maxHeight: 520,
  },
  scrollContent: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  /* Spotify-style Card */
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#181C20',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardArtwork: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#232830',
  },
  cardTrackInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardTrackTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cardTrackArtist: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 2,
  },
  cardStationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  stationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  stationText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardBody: {
    paddingVertical: 12,
  },
  quoteMark: {
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 32,
    marginBottom: -4,
    opacity: 0.8,
  },
  cardLyricsText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLogo: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  footerTextWrap: {},
  footerBrand: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footerUrl: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '500',
  },
  footerRight: {
    opacity: 0.7,
  },
  /* Selection Section */
  selectionSection: {
    width: '100%',
    marginTop: 4,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  selectionTitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  selectionCounter: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  linesList: {
    width: '100%',
  },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  lineItemSelected: {
    borderWidth: 1,
  },
  lineIcon: {
    marginRight: 10,
  },
  lineItemText: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  lineItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  /* Bottom actions */
  bottomActions: {
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  shareIcon: {
    marginRight: 8,
  },
  shareButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

export default LyricsShareModal;
