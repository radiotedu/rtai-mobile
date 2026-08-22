import fs from 'fs';
import path from 'path';

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
});
