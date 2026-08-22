import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

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
      user: {
        id: 'user-1',
        display_name: 'Ada',
        avatar_url: 'https://radiotedu.com/avatar.png',
        email: 'private@example.test',
        role: 'admin',
      },
    });
    expect(script).toContain('window.__RADIOTEDU_NATIVE_AUTH__');
    expect(script).toContain('access-token');
    expect(script).toContain('display_name');
    expect(script).not.toContain('private@example.test');
    expect(script).not.toContain('"role":"admin"');
    expect(script).toContain('window.__RADIOTEDU_EPHEMERAL_TOKEN__');
    expect(script).toContain("originalRemoveItem.call(window.localStorage, 'token')");
    expect(script).not.toContain("window.localStorage.setItem('token'");
    expect(script).toContain("window.location.pathname.replace(/\\/+$/, '') === '/juke-local/controller'");
    expect(script.indexOf("window.location.protocol === 'https:'")).toBeLessThan(
      script.lastIndexOf('window.__RADIOTEDU_NATIVE_AUTH__ = state'),
    );
  });

  it('opens the public phone controller and forwards a scanned device code', () => {
    expect(buildJukeLocalControllerUrl()).toBe(
      'https://radiotedu.com/juke-local/controller/?lang=en',
    );
    expect(buildJukeLocalControllerUrl(' TEDU 01 ', 'ar-EG')).toBe(
      'https://radiotedu.com/juke-local/controller/?code=TEDU+01&lang=ar',
    );
    expect(buildJukeLocalControllerUrl(undefined, 'xx&code=evil')).toBe(
      'https://radiotedu.com/juke-local/controller/?lang=en',
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
    expect(script).toContain("window.location.hostname === 'radiotedu.com'");
    expect(script).toContain("window.location.protocol === 'https:'");
    expect(script).not.toContain('document.cookie');
    expect(script).not.toContain('?access_token=');
  });

  it('clears the ephemeral controller compatibility token on app logout', () => {
    const script = buildJukeLocalAuthInjection({accessToken: null, user: null});

    expect(script).toContain("typeof state.accessToken === 'string' ? state.accessToken : ''");
    expect(script).toContain("originalRemoveItem.call(window.localStorage, 'token')");
    expect(script).toContain('authenticated: Boolean(state.accessToken)');
  });

  it('documents removal of exact-route compatibility exposure as a release blocker', () => {
    const blocker = fs.readFileSync(
      path.join(__dirname, '../docs/JUKE_LOCAL_NATIVE_AUTH_BLOCKER.md'),
      'utf8',
    );

    expect(blocker).toContain('release blocker');
    expect(blocker).toContain('/juke-local/controller/');
    expect(blocker).toContain('__RADIOTEDU_EPHEMERAL_TOKEN__');
    expect(blocker).toContain('short-lived');
  });
});
