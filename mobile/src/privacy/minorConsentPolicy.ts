export type ConsentAgeRange =
  | 'under18'
  | '18-24'
  | '25-34'
  | '35-44'
  | '45-54'
  | '55plus';

export const CONSENT_AGE_RANGES: ConsentAgeRange[] = [
  'under18',
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55plus',
];

type AgeProtectedConsent = {
  analytics: boolean;
  demographics: boolean;
  ageRange: ConsentAgeRange | null;
  gender: unknown | null;
};

export function isAdultConsentAge(
  ageRange: ConsentAgeRange | null,
): boolean {
  return ageRange !== null && ageRange !== 'under18';
}

/**
 * Optional analytics requires an affirmative adult age range. The age range is
 * retained locally as the eligibility marker; demographics control whether it
 * may be passed to the analytics SDK.
 */
export function normalizeConsentForAge<T extends AgeProtectedConsent>(
  input: T,
): T {
  const normalized = {...input};
  if (!isAdultConsentAge(normalized.ageRange)) {
    normalized.analytics = false;
    normalized.demographics = false;
  }
  if (!normalized.analytics) {
    normalized.demographics = false;
  }
  if (!normalized.demographics) {
    normalized.gender = null;
  }
  return normalized;
}
