import {describe, expect, it} from '@jest/globals';

import {
  WEBVIEW_LOCALES,
  normalizeWebViewLocale,
} from '../src/services/webViewLocale';

describe('WebView locale contract', () => {
  it('allows only the six app locales', () => {
    expect(WEBVIEW_LOCALES).toEqual(['en', 'tr', 'ar', 'ru', 'de', 'fr']);
    expect(WEBVIEW_LOCALES.map(normalizeWebViewLocale)).toEqual(
      WEBVIEW_LOCALES,
    );
  });

  it('normalizes regional app locales and safely falls back to English', () => {
    expect(normalizeWebViewLocale('TR_tr')).toBe('tr');
    expect(normalizeWebViewLocale('ar-EG')).toBe('ar');
    expect(normalizeWebViewLocale('evil&room=admin')).toBe('en');
    expect(normalizeWebViewLocale(undefined)).toBe('en');
  });
});
