import {describe, expect, it} from '@jest/globals';

import {
  buildRegistrationPolicy,
  isTeduInstitutionEmail,
  PRIVACY_URL,
  REGISTRATION_PRIVACY_VERSION,
  REGISTRATION_TERMS_VERSION,
  TERMS_URL,
} from '../src/services/registrationPolicy';

describe('mobile registration policy', () => {
  it('recognizes TEDÜ institutional email domains', () => {
    expect(isTeduInstitutionEmail('student@tedu.edu.tr')).toBe(true);
    expect(isTeduInstitutionEmail('person@alumni.tedu.edu.tr')).toBe(true);
    expect(isTeduInstitutionEmail('person@gmail.com')).toBe(false);
  });

  it('sends versioned legal acceptance and age for non-TEDÜ registration', () => {
    expect(buildRegistrationPolicy('person@gmail.com', true, 21)).toEqual({
      age: 21,
      terms_accepted: true,
      privacy_acknowledged: true,
      terms_version: REGISTRATION_TERMS_VERSION,
      privacy_version: REGISTRATION_PRIVACY_VERSION,
    });
  });

  it('does not send an age assertion for TEDÜ registration', () => {
    expect(buildRegistrationPolicy('student@tedu.edu.tr', true, 17).age).toBeUndefined();
  });

  it('links the public mobile-specific legal notices', () => {
    expect(PRIVACY_URL).toBe(
      'https://github.com/radiotedu/rtai-mobile/blob/main/docs/MOBILE_PRIVACY_NOTICE.md',
    );
    expect(TERMS_URL).toBe(
      'https://github.com/radiotedu/rtai-mobile/blob/main/docs/MOBILE_TERMS_OF_USE.md',
    );
  });
});
