import {describe, expect, it} from '@jest/globals';

import {
  buildJukeLocalAuthInjection,
  buildJukeLocalControllerUrl,
  isAllowedJukeLocalNavigation,
  normalizeJukeLocalAppPath,
} from '../src/services/jukeLocalWebViewService';

describe('juke-local app WebView contract', () => {
  it('seeds the authenticated RadioTEDU account bridge before the controller bundle starts', () => {
    const script = buildJukeLocalAuthInjection({
      accessToken: 'access-token',
      user: {id: 'user-1', display_name: 'Ada', is_guest: false},
    });
    expect(script).toContain('window.__RADIOTEDU_NATIVE_AUTH__');
    expect(script).toContain('access-token');
    expect(script).toContain('display_name');
    expect(script).not.toContain('localStorage');
  });

  it('opens the public phone controller and forwards a scanned device code', () => {
    expect(buildJukeLocalControllerUrl()).toBe(
      'https://radiotedu.com/juke-local/controller/',
    );
    expect(buildJukeLocalControllerUrl(' TEDU 01 ')).toBe(
      'https://radiotedu.com/juke-local/controller/?code=TEDU+01',
    );
  });

  it('keeps WebView navigation inside the juke-local phone controller', () => {
    expect(
      isAllowedJukeLocalNavigation(
        'https://radiotedu.com/juke-local/controller/?code=TEDU01',
      ),
    ).toBe(true);
    expect(
      isAllowedJukeLocalNavigation(
        'https://radiotedu.com/juke-local/kiosk/?code=TEDU01',
      ),
    ).toBe(false);
    expect(
      isAllowedJukeLocalNavigation(
        'https://radiotedu.com.evil.example/juke-local/controller/',
      ),
    ).toBe(false);
    expect(
      isAllowedJukeLocalNavigation(
        'https://radiotedu.com/juke-local/controller-evil/',
      ),
    ).toBe(false);
    expect(
      isAllowedJukeLocalNavigation(
        'https://radiotedu.com/juke-local/controller/admin',
      ),
    ).toBe(false);
  });

  it('maps the public QR URL into the existing Jukebox app route', () => {
    expect(
      normalizeJukeLocalAppPath('juke-local/controller/?code=TEDU%2001'),
    ).toBe('jukebox/TEDU%2001');
    expect(normalizeJukeLocalAppPath('juke-local/controller/')).toBe('jukebox');
    expect(normalizeJukeLocalAppPath('events/qr/TEDU-1')).toBe(
      'events/qr/TEDU-1',
    );
  });

  it('uses exact Android App Link paths instead of a broad prefix', () => {
    const manifest = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../android/app/src/main/AndroidManifest.xml',
      ),
      'utf8',
    );
    expect(manifest).toContain('android:path="/juke-local/controller/"');
    expect(manifest).not.toContain(
      'android:pathPrefix="/juke-local/controller"',
    );
  });

  it('injects the signed-in account only into trusted RadioTEDU API requests', () => {
    const script = buildJukeLocalAuthInjection({
      accessToken: 'short-lived-token</script>',
      user: {id: 'user-1'},
    });

    expect(script).toContain('window.__RADIOTEDU_NATIVE_AUTH__');
    expect(script).toContain('/juke-local/api/');
    expect(script).toContain('/jukebox/api/');
    expect(script).toContain("parsed.hostname === 'radiotedu.com'");
    expect(script).toContain('short-lived-token\\u003c/script>');
    expect(script).not.toContain('localStorage');
    expect(script).not.toContain('document.cookie');
    expect(script).not.toContain('?access_token=');
  });
});
