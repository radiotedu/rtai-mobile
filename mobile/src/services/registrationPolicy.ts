export const REGISTRATION_TERMS_VERSION = '2026-08-22';
export const REGISTRATION_PRIVACY_VERSION = '2026-08-22';
export const TERMS_URL = 'https://radiotedu.com/kullanim-kosullari/';
export const PRIVACY_URL = 'https://radiotedu.com/gizlilik-politikasi/';

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
