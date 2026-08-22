export const REGISTRATION_TERMS_VERSION = '2026-08-22';
export const REGISTRATION_PRIVACY_VERSION = '2026-08-22';
export const TERMS_URL =
  'https://github.com/radiotedu/rtai-mobile/blob/main/docs/MOBILE_TERMS_OF_USE.md';
export const PRIVACY_URL =
  'https://github.com/radiotedu/rtai-mobile/blob/main/docs/MOBILE_PRIVACY_NOTICE.md';

export function isTeduInstitutionEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@').pop() ?? '';
  return domain === 'tedu.edu.tr' || domain.endsWith('.tedu.edu.tr');
}

export function buildRegistrationPolicy(
  email: string,
  legalAccepted: boolean,
  age?: number,
) {
  return {
    age: isTeduInstitutionEmail(email) ? undefined : age,
    terms_accepted: legalAccepted,
    privacy_acknowledged: legalAccepted,
    terms_version: REGISTRATION_TERMS_VERSION,
    privacy_version: REGISTRATION_PRIVACY_VERSION,
  };
}
