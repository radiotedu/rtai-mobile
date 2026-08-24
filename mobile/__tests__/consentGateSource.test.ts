import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('consent gate startup fallback', () => {
  it('does not leave users on a blank screen while consent storage is loading', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
    const consentSource = fs.readFileSync(path.join(__dirname, '../src/privacy/ConsentContext.tsx'), 'utf8');

    expect(appSource).toContain('const [showSplash, setShowSplash] = React.useState(true);');
    for (const requiredImport of [
      'ActivityIndicator',
      'AppState',
      'InteractionManager',
      'StatusBar',
      'View',
    ]) {
      expect(appSource).toContain(requiredImport);
    }
    expect(appSource).toContain('<ActivityIndicator color="#E31E24" size="large" />');
    expect(consentSource).toContain('const CONSENT_READY_TIMEOUT_MS = 2000;');
    expect(consentSource).toContain('setTimeout(() => setReady(true), CONSENT_READY_TIMEOUT_MS)');
  });

  it('uses explicit terms acceptance and privacy-safe optional analytics defaults', () => {
    const consentSource = fs.readFileSync(
      path.join(__dirname, '../src/privacy/ConsentContext.tsx'),
      'utf8',
    );
    const screenSource = fs.readFileSync(
      path.join(__dirname, '../src/screens/ConsentScreen.tsx'),
      'utf8',
    );
    const versionSource = fs.readFileSync(
      path.join(__dirname, '../src/privacy/consentVersion.ts'),
      'utf8',
    );

    expect(versionSource).toContain('CONSENT_VERSION = 4');
    expect(consentSource).toContain('termsAccepted: false');
    expect(consentSource).toContain('decidedAt: null');
    expect(screenSource).toContain('useState(false)');
    expect(screenSource).toContain('disabled={!termsAccepted}');
    expect(screenSource).toContain('REGISTRATION_TERMS_VERSION');
    expect(screenSource).toContain('Linking.openURL(PRIVACY_URL)');
    expect(screenSource).toContain('Linking.openURL(TERMS_URL)');
    expect(screenSource).toContain('requestAndroidNotificationPermission');
    expect(screenSource.match(/await requestAndroidNotificationPermission/g)).toHaveLength(2);
  });
});
