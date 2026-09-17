import React, {useMemo, useState, useEffect} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {COLORS, SPACING} from '../theme/theme';
import {
  AcademicTakeaway,
  SAMPLE_TEDU_ACADEMIC_TAKEAWAYS,
  SAMPLE_TEDU_TRANSCRIPT_CUES,
  TranscriptCue,
  formatTimestamp,
  isCueActive,
} from '../data/samplePodcastTranscripts';
import {
  PodcastTimecapsule,
  TimecapsuleCategory,
  CATEGORY_CONFIG as TIMECAPSULE_CATEGORY_CONFIG,
  podcastTimecapsuleService,
} from '../services/podcastTimecapsuleService';

export interface PodcastTranscriptViewerProps {
  cues?: TranscriptCue[];
  takeaways?: AcademicTakeaway[];
  currentTimeSeconds: number;
  onSeek: (seconds: number) => void;
  onClose?: () => void;
  podcastTitle?: string;
}

const CATEGORY_LABELS: Record<string, {label: string; color: string; bg: string}> = {
  core_concept: {
    label: 'Temel Kavram',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.15)',
  },
  research_insight: {
    label: 'Araştırma Notu',
    color: '#c084fc',
    bg: 'rgba(192, 132, 252, 0.15)',
  },
  exam_key: {
    label: 'Sınav / Proje',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.15)',
  },
  discussion: {
    label: 'Tartışma & Etik',
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.15)',
  },
};

export const PodcastTranscriptViewer: React.FC<PodcastTranscriptViewerProps> = ({
  cues = SAMPLE_TEDU_TRANSCRIPT_CUES,
  takeaways = SAMPLE_TEDU_ACADEMIC_TAKEAWAYS,
  currentTimeSeconds,
  onSeek,
  onClose,
  podcastTitle = 'TEDÜ Akademik Sohbetler',
}) => {
  const [activeTab, setActiveTab] = useState<'transcript' | 'takeaways' | 'timecapsules'>('transcript');
  const [searchQuery, setSearchQuery] = useState('');
  const [timecapsules, setTimecapsules] = useState<PodcastTimecapsule[]>(() =>
    podcastTimecapsuleService.getTimecapsules(),
  );
  const [showAddCapsule, setShowAddCapsule] = useState(false);
  const [newAuthor, setNewAuthor] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newCategory, setNewCategory] = useState<TimecapsuleCategory>('exam_tip');

  useEffect(() => {
    return podcastTimecapsuleService.subscribe(() => {
      setTimecapsules(podcastTimecapsuleService.getTimecapsules());
    });
  }, []);

  // Search filtering for cues
  const filteredCues = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) {
      return cues;
    }
    return cues.filter(
      cue =>
        cue.text.toLowerCase().includes(trimmed) ||
        (cue.speaker && cue.speaker.toLowerCase().includes(trimmed)),
    );
  }, [cues, searchQuery]);

  // Search filtering for academic takeaways
  const filteredTakeaways = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) {
      return takeaways;
    }
    return takeaways.filter(
      item =>
        item.title.toLowerCase().includes(trimmed) ||
        item.description.toLowerCase().includes(trimmed) ||
        item.keyTerms?.some(term => term.toLowerCase().includes(trimmed)),
    );
  }, [takeaways, searchQuery]);

  // Search filtering for timecapsules
  const filteredTimecapsules = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) {
      return timecapsules;
    }
    return timecapsules.filter(
      tc =>
        tc.text.toLowerCase().includes(trimmed) ||
        tc.authorName.toLowerCase().includes(trimmed),
    );
  }, [timecapsules, searchQuery]);

  return (
    <View style={styles.container} testID="podcast-transcript-viewer">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="school" size={20} color={COLORS.primary} />
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerSuperTitle}>TEDÜ AKADEMİK AI TRANSKRİPT</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {podcastTitle}
            </Text>
          </View>
        </View>
        {onClose ? (
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            testID="transcript-close-button">
            <Icon name="close" size={20} color={COLORS.text} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'transcript' && styles.tabButtonActive]}
          onPress={() => setActiveTab('transcript')}
          accessibilityRole="button"
          testID="tab-transcript">
          <Icon
            name="script-text-outline"
            size={17}
            color={activeTab === 'transcript' ? COLORS.primary : COLORS.textMuted}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'transcript' && styles.tabButtonTextActive]}>
            Transkript ({cues.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'takeaways' && styles.tabButtonActive]}
          onPress={() => setActiveTab('takeaways')}
          accessibilityRole="button"
          testID="tab-takeaways">
          <Icon
            name="cards-outline"
            size={17}
            color={activeTab === 'takeaways' ? COLORS.primary : COLORS.textMuted}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'takeaways' && styles.tabButtonTextActive]}>
            Bilgi Kartları ({takeaways.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'timecapsules' && styles.tabButtonActive]}
          onPress={() => setActiveTab('timecapsules')}
          accessibilityRole="button"
          testID="tab-timecapsules">
          <Icon
            name="diamond-stone"
            size={17}
            color={activeTab === 'timecapsules' ? COLORS.primary : COLORS.textMuted}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'timecapsules' && styles.tabButtonTextActive]}>
            Kapsüller ({timecapsules.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Filter Bar */}
      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={
            activeTab === 'transcript'
              ? 'Transkriptte anahtar kelime veya konuşmacı ara…'
              : activeTab === 'takeaways'
              ? 'Akademik kavram veya terim ara…'
              : 'Zaman kapsüllerinde ara…'
          }
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="transcript-search-input"
          returnKeyType="search"
          clearButtonMode="never"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearSearchButton}
            accessibilityRole="button"
            accessibilityLabel="Aramayı temizle"
            testID="transcript-search-clear">
            <Icon name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Match count badge if searching */}
      {searchQuery.trim().length > 0 ? (
        <View style={styles.matchCountBar}>
          <Text style={styles.matchCountText}>
            {activeTab === 'transcript'
              ? `${filteredCues.length} transkript satırı eşleşti`
              : activeTab === 'takeaways'
              ? `${filteredTakeaways.length} bilgi kartı eşleşti`
              : `${filteredTimecapsules.length} zaman kapsülü eşleşti`}
          </Text>
        </View>
      ) : null}

      {/* Body Content */}
      {activeTab === 'transcript' ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          testID="transcript-cues-list">
          {filteredCues.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Icon name="file-document-alert-outline" size={44} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Eşleşen transkript bulunamadı</Text>
              <Text style={styles.emptySubtitle}>
                &quot;{searchQuery}&quot; ifadesi için kayıtlı bir konuşma bulunamadı.
              </Text>
              <TouchableOpacity
                style={styles.emptyResetButton}
                onPress={() => setSearchQuery('')}>
                <Text style={styles.emptyResetText}>Aramayı Temizle</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredCues.map(cue => {
              const active = isCueActive(cue, currentTimeSeconds);
              const cueTimecapsules = timecapsules.filter(
                tc => tc.timestampSeconds >= cue.startSeconds && tc.timestampSeconds < cue.endSeconds,
              );

              return (
                <View
                  key={cue.id}
                  style={[styles.cueCard, active && styles.cueCardActive]}
                  testID={`cue-card-${cue.id}`}>
                  <TouchableOpacity
                    onPress={() => onSeek(cue.startSeconds)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${cue.speaker ? cue.speaker + ': ' : ''}${cue.text}`}
                    testID={`cue-item-${cue.id}`}>
                    <View style={styles.cueHeader}>
                      <View style={[styles.timestampPill, active && styles.timestampPillActive]}>
                        <Icon
                          name={active ? 'volume-high' : 'play'}
                          size={12}
                          color={active ? '#fff' : COLORS.primary}
                          style={{marginRight: 3}}
                        />
                        <Text
                          style={[
                            styles.timestampText,
                            active && styles.timestampTextActive,
                          ]}>
                          {formatTimestamp(cue.startSeconds)}
                        </Text>
                      </View>

                      {cue.speaker ? (
                        <View style={styles.speakerWrap}>
                          <Icon name="account-voice" size={14} color={COLORS.textMuted} />
                          <Text
                            style={[
                              styles.speakerText,
                              active && styles.speakerTextActive,
                            ]}>
                            {cue.speaker}
                          </Text>
                        </View>
                      ) : null}

                      {active ? (
                        <View style={styles.nowPlayingBadge}>
                          <View style={styles.pulseDot} />
                          <Text style={styles.nowPlayingText}>ŞU AN</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text
                      style={[styles.cueText, active && styles.cueTextActive]}
                      selectable>
                      {cue.text}
                    </Text>
                  </TouchableOpacity>

                  {/* Acoustic Timecapsule Badges if present */}
                  {cueTimecapsules.length > 0 ? (
                    <View style={styles.cueTimecapsulesWrap}>
                      {cueTimecapsules.map(tc => (
                        <TouchableOpacity
                          key={tc.id}
                          style={styles.cueTimecapsuleBadge}
                          onPress={() => onSeek(tc.timestampSeconds)}
                          accessibilityRole="button"
                          testID={`cue-timecapsule-${tc.id}`}>
                          <Icon name="diamond-stone" size={12} color="#38bdf8" />
                          <Text style={styles.cueTimecapsuleText} numberOfLines={1}>
                            {formatTimestamp(tc.timestampSeconds)} · {tc.authorName}: {tc.text}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      ) : activeTab === 'takeaways' ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          testID="takeaways-list">
          {filteredTakeaways.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Icon name="cards-variant" size={44} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Eşleşen bilgi kartı bulunamadı</Text>
              <Text style={styles.emptySubtitle}>
                &quot;{searchQuery}&quot; ile ilgili bir akademik kart bulunamadı.
              </Text>
              <TouchableOpacity
                style={styles.emptyResetButton}
                onPress={() => setSearchQuery('')}>
                <Text style={styles.emptyResetText}>Aramayı Temizle</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredTakeaways.map(card => {
              const meta = CATEGORY_LABELS[card.category] || {
                label: 'Akademik Not',
                color: COLORS.primary,
                bg: 'rgba(227, 30, 36, 0.15)',
              };
              return (
                <View
                  key={card.id}
                  style={styles.takeawayCard}
                  testID={`takeaway-card-${card.id}`}>
                  <View style={styles.takeawayTopRow}>
                    <View style={[styles.categoryBadge, {backgroundColor: meta.bg}]}>
                      <Text style={[styles.categoryBadgeText, {color: meta.color}]}>
                        {meta.label}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.jumpPill}
                      onPress={() => onSeek(card.timestampSeconds)}
                      accessibilityRole="button"
                      accessibilityLabel={`${card.title} zamanına git`}
                      testID={`takeaway-jump-${card.id}`}>
                      <Icon name="clock-fast" size={13} color={COLORS.primary} />
                      <Text style={styles.jumpPillText}>
                        {formatTimestamp(card.timestampSeconds)}
                      </Text>
                      <Icon name="chevron-right" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.takeawayTitle}>{card.title}</Text>
                  <Text style={styles.takeawayDescription}>{card.description}</Text>

                  {card.keyTerms && card.keyTerms.length > 0 ? (
                    <View style={styles.keyTermsWrap}>
                      {card.keyTerms.map(term => (
                        <View key={term} style={styles.termTag}>
                          <Text style={styles.termTagText}>#{term}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.cardSeekButton}
                    onPress={() => onSeek(card.timestampSeconds)}
                    activeOpacity={0.8}
                    testID={`takeaway-seek-${card.id}`}>
                    <Icon name="play-circle-outline" size={17} color="#fff" />
                    <Text style={styles.cardSeekButtonText}>
                      Konuyu Dinle ({formatTimestamp(card.timestampSeconds)})
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          testID="timecapsules-list">
          {/* Add Timecapsule Toggle & Form */}
          <TouchableOpacity
            style={styles.addCapsuleToggle}
            onPress={() => setShowAddCapsule(!showAddCapsule)}
            accessibilityRole="button"
            testID="toggle-add-capsule">
            <Icon
              name={showAddCapsule ? 'chevron-up' : 'plus-circle-outline'}
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.addCapsuleToggleText}>
              {showAddCapsule
                ? 'Kapsül Formunu Gizle'
                : `+ Bu Saniyeye Kapsül Bırak (${formatTimestamp(currentTimeSeconds)})`}
            </Text>
          </TouchableOpacity>

          {showAddCapsule ? (
            <View style={styles.addCapsuleCard} testID="add-capsule-form">
              <Text style={styles.addCapsuleTitle}>
                💎 Zaman Kapsülü Bırak ({formatTimestamp(currentTimeSeconds)})
              </Text>
              <Text style={styles.addCapsuleSub}>
                Bu saniyeye ilişkin sınav notu, kilit çıkarım veya tartışma notu sabitleyin.
              </Text>

              <TextInput
                style={styles.formInput}
                placeholder="Adınız veya Topluluk İsmi (Örn: TEDÜ AI Lab)"
                placeholderTextColor={COLORS.textMuted}
                value={newAuthor}
                onChangeText={setNewAuthor}
                testID="input-capsule-author"
              />

              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                placeholder="Önemli notunuzu veya sınav uyarınızı yazın..."
                placeholderTextColor={COLORS.textMuted}
                value={newNote}
                onChangeText={setNewNote}
                multiline
                numberOfLines={3}
                testID="input-capsule-note"
              />

              {/* Category selector */}
              <View style={styles.categoryPillRow}>
                {(['exam_tip', 'key_takeaway', 'discussion'] as TimecapsuleCategory[]).map(cat => {
                  const meta = TIMECAPSULE_CATEGORY_CONFIG[cat];
                  const isSelected = newCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categorySelectPill,
                        isSelected && {borderColor: meta.color, backgroundColor: meta.bg},
                      ]}
                      onPress={() => setNewCategory(cat)}
                      testID={`category-select-${cat}`}>
                      <Text
                        style={[
                          styles.categorySelectPillText,
                          isSelected && {color: meta.color, fontWeight: '800'},
                        ]}>
                        {meta.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.submitCapsuleBtn, !newNote.trim() && styles.submitCapsuleBtnDisabled]}
                disabled={!newNote.trim()}
                onPress={() => {
                  if (!newNote.trim()) return;
                  podcastTimecapsuleService.addTimecapsule({
                    podcastId: 'tedu-academic-1',
                    timestampSeconds: Math.floor(currentTimeSeconds),
                    authorName: newAuthor.trim() || 'TEDÜ Dinleyicisi',
                    text: newNote.trim(),
                    category: newCategory,
                  });
                  setNewNote('');
                  setShowAddCapsule(false);
                }}
                testID="submit-capsule-btn">
                <Icon name="check-bold" size={16} color="#fff" />
                <Text style={styles.submitCapsuleBtnText}>Kapsülü Sabitle</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {filteredTimecapsules.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Icon name="diamond-stone" size={44} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Kayıtlı Zaman Kapsülü Yok</Text>
              <Text style={styles.emptySubtitle}>
                Bu podcast için henüz bir zaman kapsülü bırakılmamış veya aramanızla eşleşmedi.
              </Text>
            </View>
          ) : (
            filteredTimecapsules.map(tc => {
              const meta = TIMECAPSULE_CATEGORY_CONFIG[tc.category] || TIMECAPSULE_CATEGORY_CONFIG.key_takeaway;
              return (
                <View key={tc.id} style={styles.timecapsuleCard} testID={`timecapsule-item-${tc.id}`}>
                  <View style={styles.timecapsuleTopRow}>
                    <View style={[styles.timecapsuleCategoryBadge, {backgroundColor: meta.bg}]}>
                      <Icon name={meta.icon} size={12} color={meta.color} />
                      <Text style={[styles.timecapsuleCategoryText, {color: meta.color}]}>
                        {meta.label}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.jumpPill}
                      onPress={() => onSeek(tc.timestampSeconds)}
                      accessibilityRole="button"
                      testID={`timecapsule-jump-${tc.id}`}>
                      <Icon name="clock-fast" size={13} color={COLORS.primary} />
                      <Text style={styles.jumpPillText}>
                        {formatTimestamp(tc.timestampSeconds)}
                      </Text>
                      <Icon name="chevron-right" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.timecapsuleAuthor}>
                    <Icon name="account-circle-outline" size={13} color={COLORS.textMuted} /> {tc.authorName}
                  </Text>
                  <Text style={styles.timecapsuleText}>{tc.text}</Text>

                  <View style={styles.timecapsuleFooter}>
                    <TouchableOpacity
                      style={styles.timecapsuleLikeBtn}
                      onPress={() => podcastTimecapsuleService.likeTimecapsule(tc.id)}
                      testID={`timecapsule-like-${tc.id}`}>
                      <Icon name="heart-outline" size={14} color="#e50914" />
                      <Text style={styles.timecapsuleLikeCount}>{tc.likes}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.timecapsuleSeekBtn}
                      onPress={() => onSeek(tc.timestampSeconds)}
                      testID={`timecapsule-seek-${tc.id}`}>
                      <Icon name="play" size={12} color="#fff" />
                      <Text style={styles.timecapsuleSeekBtnText}>
                        {formatTimestamp(tc.timestampSeconds)} Dinle
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1115',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitleWrap: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  headerSuperTitle: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#15181e',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(227, 30, 36, 0.12)',
    borderColor: 'rgba(227, 30, 36, 0.35)',
  },
  tabButtonText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: COLORS.text,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: '#1b1f27',
    borderRadius: 10,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: 38,
    color: COLORS.text,
    fontSize: 13,
    paddingVertical: 0,
  },
  clearSearchButton: {
    padding: 4,
  },
  matchCountBar: {
    paddingHorizontal: SPACING.md,
    paddingTop: 6,
  },
  matchCountText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  cueCard: {
    backgroundColor: '#181b22',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cueCardActive: {
    backgroundColor: 'rgba(227, 30, 36, 0.14)',
    borderColor: COLORS.primary,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  cueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  timestampPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(227, 30, 36, 0.12)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  timestampPillActive: {
    backgroundColor: COLORS.primary,
  },
  timestampText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timestampTextActive: {
    color: '#fff',
  },
  speakerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  speakerText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  speakerTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  nowPlayingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(227, 30, 36, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  nowPlayingText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cueText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
  },
  cueTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyResetButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  emptyResetText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  takeawayCard: {
    backgroundColor: '#181b22',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  takeawayTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  jumpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(227, 30, 36, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  jumpPillText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  takeawayTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  takeawayDescription: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  keyTermsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  termTag: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  termTagText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  cardSeekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  cardSeekButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  cueTimecapsulesWrap: {
    marginTop: 8,
    gap: 4,
  },
  cueTimecapsuleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 5,
  },
  cueTimecapsuleText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },

  addCapsuleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(227, 30, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(227, 30, 36, 0.35)',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    marginBottom: 12,
  },
  addCapsuleToggleText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  addCapsuleCard: {
    backgroundColor: '#1c1f26',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addCapsuleTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  addCapsuleSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 10,
  },
  formInput: {
    backgroundColor: '#12141a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
    marginBottom: 8,
  },
  formTextArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  categoryPillRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  categorySelectPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  categorySelectPillText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  submitCapsuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  submitCapsuleBtnDisabled: {
    opacity: 0.5,
  },
  submitCapsuleBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  timecapsuleCard: {
    backgroundColor: '#181b22',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  timecapsuleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  timecapsuleCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  timecapsuleCategoryText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  timecapsuleAuthor: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  timecapsuleText: {
    color: '#f3f4f6',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  timecapsuleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
  },
  timecapsuleLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  timecapsuleLikeCount: {
    color: '#e50914',
    fontSize: 11,
    fontWeight: '800',
  },
  timecapsuleSeekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  timecapsuleSeekBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default PodcastTranscriptViewer;
