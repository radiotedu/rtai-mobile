import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

import {
  isAdultConsentAge,
  normalizeConsentForAge,
} from '../src/privacy/minorConsentPolicy';

describe('minor optional-consent guard', () => {
  it('allows optional consent only after an adult age range is declared', () => {
    expect(isAdultConsentAge(null)).toBe(false);
    expect(isAdultConsentAge('under18')).toBe(false);
    expect(isAdultConsentAge('18-24')).toBe(true);
    expect(isAdultConsentAge('55plus')).toBe(true);
  });

  it('revokes analytics and demographics when persisted age changes to under 18', () => {
    expect(
      normalizeConsentForAge({
        analytics: true,
        demographics: true,
        ageRange: 'under18' as const,
        gender: 'na',
      }),
    ).toEqual({
      analytics: false,
      demographics: false,
      ageRange: 'under18',
      gender: null,
    });
  });

  it('retains the local adult eligibility marker without sharing demographics', () => {
    expect(
      normalizeConsentForAge({
        analytics: true,
        demographics: false,
        ageRange: '25-34' as const,
        gender: 'female',
      }),
    ).toEqual({
      analytics: true,
      demographics: false,
      ageRange: '25-34',
      gender: null,
    });
  });

  it('clears self-reported listening context when analytics is disabled', () => {
    expect(
      normalizeConsentForAge({
        analytics: false,
        demographics: false,
        ageRange: '25-34' as const,
        gender: null,
        listeningContext: 'school',
      }),
    ).toMatchObject({listeningContext: null});
  });

  it('normalizes both restored and newly saved consent and never passes local age without demographic consent', () => {
    const context = fs.readFileSync(
      path.join(__dirname, '../src/privacy/ConsentContext.tsx'),
      'utf8',
    );
    const app = fs.readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');

    expect(context).toContain('const restored = normalizeConsentForAge');
    expect(context).toContain('normalizeConsentForAge<ConsentState>');
    expect(app).toContain(
      'ageRange: consent.demographics ? consent.ageRange : null',
    );
    expect(app).toContain(
      'gender: consent.demographics ? consent.gender : null',
    );
  });
});
