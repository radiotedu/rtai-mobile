import React, {useState} from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {COLORS, SPACING} from '../theme/theme';
import {AgeRange, Gender, useConsent} from '../privacy/ConsentContext';
import {setAnalyticsConsent} from '../services/analyticsService';
import {
  PRIVACY_URL,
  REGISTRATION_TERMS_VERSION,
  TERMS_URL,
} from '../services/registrationPolicy';

const AGE_RANGES: AgeRange[] = [
  'under18',
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55plus',
];
const GENDERS: Gender[] = ['female', 'male', 'other', 'na'];
const GOOGLE_PRIVACY_URL = 'https://policies.google.com/privacy';
const GENDER_LABEL_KEY: Record<Gender, string> = {
  female: 'privacy.genderFemale',
  male: 'privacy.genderMale',
  other: 'privacy.genderOther',
  na: 'privacy.genderNA',
};
function ageLabel(t: (k: string) => string, r: AgeRange): string {
  if (r === 'under18') {
    return t('privacy.ageUnder18');
  }
  if (r === '55plus') {
    return t('privacy.age55plus');
  }
  return r;
}

/** First-launch consent gate. Renders until the user makes a choice. */
const ConsentScreen = () => {
  const {t} = useTranslation();
  const {saveConsent} = useConsent();

  const [analytics, setAnalytics] = useState(false);
  const [demographics, setDemographics] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);

  const accept = async () => {
    if (!termsAccepted) {
      return;
    }
    await saveConsent({
      analytics,
      demographics,
      ageRange: demographics ? ageRange : null,
      gender: demographics ? gender : null,
      termsAccepted: true,
      termsVersion: REGISTRATION_TERMS_VERSION,
    });
    setAnalyticsConsent(analytics, {
      ageRange: demographics ? ageRange : null,
      gender: demographics ? gender : null,
    });
  };

  const declineAll = async () => {
    if (!termsAccepted) {
      return;
    }
    await saveConsent({
      analytics: false,
      demographics: false,
      ageRange: null,
      gender: null,
      termsAccepted: true,
      termsVersion: REGISTRATION_TERMS_VERSION,
    });
    setAnalyticsConsent(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('privacy.consentTitle')}</Text>
        <Text style={styles.intro}>{t('privacy.intro')}</Text>
        <View style={styles.legalCard}>
          <Text style={styles.legalHeading}>{t('privacy.controllerHeading')}</Text>
          <Text style={styles.legalText}>{t('privacy.controllerNotice')}</Text>
          <Text style={styles.legalHeading}>{t('privacy.noticeHeading')}</Text>
          <Text style={styles.legalText}>{t('privacy.fullNotice')}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{t('privacy.analyticsLabel')}</Text>
            <Text style={styles.rowDesc}>{t('privacy.analyticsDesc')}</Text>
          </View>
          <Switch
            value={analytics}
            onValueChange={value => {
              setAnalytics(value);
              if (!value) {
                setDemographics(false);
              }
            }}
            trackColor={{true: COLORS.primary, false: '#555'}}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{t('privacy.demographicsLabel')}</Text>
            <Text style={styles.rowDesc}>{t('privacy.demographicsDesc')}</Text>
          </View>
          <Switch
            value={analytics && demographics}
            onValueChange={setDemographics}
            disabled={!analytics}
            trackColor={{true: COLORS.primary, false: '#555'}}
          />
        </View>

        {demographics && (
          <View style={styles.demo}>
            <Text style={styles.groupLabel}>{t('privacy.ageRange')}</Text>
            <View style={styles.chips}>
              {AGE_RANGES.map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setAgeRange(r)}
                  style={[styles.chip, ageRange === r && styles.chipOn]}>
                  <Text
                    style={[
                      styles.chipText,
                      ageRange === r && styles.chipTextOn,
                    ]}>
                    {ageLabel(t, r)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.groupLabel}>{t('privacy.gender')}</Text>
            <View style={styles.chips}>
              {GENDERS.map(g => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setGender(g)}
                  style={[styles.chip, gender === g && styles.chipOn]}>
                  <Text
                    style={[styles.chipText, gender === g && styles.chipTextOn]}>
                    {t(GENDER_LABEL_KEY[g])}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.notice}>{t('privacy.essentialNotice')}</Text>
        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.policyLink}>{t('privacy.viewPolicy')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.policyLink}>{t('privacy.viewTerms')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(GOOGLE_PRIVACY_URL)}>
            <Text style={styles.policyLink}>{t('privacy.googlePrivacy')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.terms}>{t('privacy.termsNote')}</Text>
        <View style={styles.legalCard}>
          <Text style={styles.legalHeading}>{t('privacy.termsHeading')}</Text>
          <Text style={styles.legalText}>{t('privacy.fullTerms')}</Text>
        </View>
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setTermsAccepted(value => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{checked: termsAccepted}}>
          <View style={[styles.checkbox, termsAccepted && styles.checkboxOn]}>
            {termsAccepted ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.termsLabel}>{t('privacy.termsAcceptance')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={declineAll}
          disabled={!termsAccepted}
          accessibilityRole="button"
          accessibilityLabel={t('privacy.declineAll')}>
          <Text style={[styles.declineText, !termsAccepted && styles.disabledText]}>
            {t('privacy.declineAll')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.acceptBtn, !termsAccepted && styles.disabledButton]}
          onPress={accept}
          disabled={!termsAccepted}
          accessibilityRole="button"
          accessibilityLabel={t('privacy.acceptSelected')}>
          <Text style={styles.acceptText}>{t('privacy.acceptSelected')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.lg},
  title: {color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: SPACING.sm},
  intro: {color: COLORS.textMuted, fontSize: 14, lineHeight: 20, marginBottom: SPACING.lg},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  rowText: {flex: 1, paddingRight: SPACING.md},
  rowLabel: {color: COLORS.text, fontSize: 15, fontWeight: '700'},
  rowDesc: {color: COLORS.textMuted, fontSize: 12, marginTop: 2},
  demo: {marginTop: SPACING.sm, marginBottom: SPACING.md},
  groupLabel: {color: COLORS.text, fontSize: 14, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.sm},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm},
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  chipOn: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  chipText: {color: COLORS.text, fontSize: 13},
  chipTextOn: {color: '#fff', fontWeight: '700'},
  policyLink: {color: COLORS.primary, fontSize: 14, fontWeight: '600', marginTop: SPACING.md},
  notice: {color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: SPACING.md},
  legalCard: {backgroundColor: COLORS.card, borderRadius: 14, padding: SPACING.md, marginBottom: SPACING.md},
  legalHeading: {color: COLORS.text, fontSize: 14, fontWeight: '800', marginBottom: SPACING.xs},
  legalText: {color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginBottom: SPACING.sm},
  legalLinks: {flexDirection: 'row', gap: SPACING.lg},
  terms: {color: COLORS.textMuted, fontSize: 12, marginTop: SPACING.sm},
  termsRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md},
  checkbox: {width: 22, height: 22, borderRadius: 5, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center'},
  checkboxOn: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  checkmark: {color: '#fff', fontSize: 15, fontWeight: '900'},
  termsLabel: {flex: 1, color: COLORS.text, fontSize: 13, lineHeight: 18},
  actions: {flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg},
  declineBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  declineText: {color: COLORS.text, fontWeight: '700'},
  acceptBtn: {
    flex: 1.4,
    paddingVertical: SPACING.md,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  acceptText: {color: '#fff', fontWeight: '800'},
  disabledButton: {opacity: 0.45},
  disabledText: {opacity: 0.45},
});

export default ConsentScreen;
