import fs from 'fs';
import path from 'path';
import {describe, expect, test} from '@jest/globals';

const read = (relative: string) =>
  fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

describe('Firebase Analytics privacy configuration', () => {
  test('collection starts disabled and advertising identifiers are removed', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('firebase_analytics_collection_enabled');
    expect(manifest).toMatch(/firebase_analytics_collection_enabled[\s\S]*?android:value="false"/);
    expect(manifest).toContain('google_analytics_adid_collection_enabled');
    expect(manifest).toContain('com.google.android.gms.permission.AD_ID');
    expect(manifest).toContain('android.permission.ACCESS_ADSERVICES_AD_ID');
    expect(manifest).toContain('android.permission.ACCESS_ADSERVICES_ATTRIBUTION');
    expect(manifest.match(/tools:node="remove"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  test('uses native consent controls without a client API secret', () => {
    const service = read('src/services/analyticsService.ts');
    const bridge = read(
      'android/app/src/main/java/com/radiotedumobile/analytics/AnalyticsBridgeModule.kt',
    );
    const config = read('src/services/config.ts');
    expect(service).toContain('RadioTeduAnalyticsBridge');
    expect(bridge).toContain('setAnalyticsCollectionEnabled(enabled)');
    expect(bridge).toContain('ConsentType.AD_PERSONALIZATION');
    expect(bridge).toContain('resetAnalyticsData()');
    expect(config).not.toContain('GA4_API_SECRET');
  });

  test('embeds complete legal notices and secures account tokens', () => {
    const consent = read('src/screens/ConsentScreen.tsx');
    const tokenStorage = read('src/services/authTokenStorage.ts');
    const locales = ['en', 'tr', 'de', 'fr', 'ru', 'ar'];
    expect(consent).toContain("t('privacy.fullNotice')");
    expect(consent).toContain("t('privacy.fullTerms')");
    for (const locale of locales) {
      const messages = JSON.parse(read(`src/i18n/locales/${locale}.json`));
      expect(messages.privacy.controllerNotice).toContain('radio@tedu.edu.tr');
      expect(messages.privacy.fullNotice.length).toBeGreaterThan(500);
      expect(messages.privacy.fullTerms.length).toBeGreaterThan(300);
    }
    expect(tokenStorage).toContain("from 'react-native-keychain'");
    expect(tokenStorage).toContain('WHEN_UNLOCKED_THIS_DEVICE_ONLY');
    expect(tokenStorage).toContain('One-time migration');
  });
});
