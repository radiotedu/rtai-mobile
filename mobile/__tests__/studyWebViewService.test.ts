import {describe, expect, it} from '@jest/globals';

import {
  STUDY_REMOTE_ROOT,
  buildStudyEntryUrl,
  createStudyWebViewBridge,
  isAllowedStudyNavigation,
} from '../src/services/studyWebViewService';

describe('Study WebView service', () => {
  it('builds the separate app-only Study website URL', () => {
    expect(STUDY_REMOTE_ROOT).toBe('https://radiotedu.com/study/');
    expect(buildStudyEntryUrl('chim-alan')).toBe(
      'https://radiotedu.com/study/?embedded=mobile&room=chim-alan',
    );
  });

  it('allows only the remote Study website', () => {
    expect(
      isAllowedStudyNavigation(
        'https://radiotedu.com/study/?embedded=mobile&room=library',
      ),
    ).toBe(true);
    expect(
      isAllowedStudyNavigation(
        'file:///android_asset/study-game/index.html?room=library',
      ),
    ).toBe(false);
    expect(
      isAllowedStudyNavigation('https://radiotedu.com/juke-local/kiosk/'),
    ).toBe(false);
    expect(
      isAllowedStudyNavigation('https://radiotedu.com.evil.example/study/'),
    ).toBe(false);
  });

  it('injects an in-memory authenticated bridge without persisting credentials', () => {
    const script = createStudyWebViewBridge({
      account: {
        id: 'user-1',
        displayName: 'Ada',
        authenticated: true,
      },
      globalPoints: 42,
      apiBase: 'https://radiotedu.com/jukebox/api/v1',
      accessToken: 'short-lived-access-token',
    });

    expect(script).toContain('window.RadioTEDUStudyBridge');
    expect(script).toContain('short-lived-access-token');
    expect(script).not.toContain('localStorage.setItem');
    expect(script).not.toContain('refresh_token');
  });

  it('binds fetch before the remote Study bundle captures it in Android WebView', () => {
    const script = createStudyWebViewBridge({
      account: {
        id: 'user-1',
        displayName: 'Ada',
        authenticated: true,
      },
      globalPoints: 42,
      apiBase: 'https://radiotedu.com/jukebox/api/v1',
      accessToken: 'short-lived-access-token',
    });

    expect(script).toContain('window.fetch = window.fetch.bind(window)');
  });

  it('isolates Study storage and translates production legacy avatar ids', () => {
    const script = createStudyWebViewBridge({
      account: {
        id: 'user-1',
        displayName: 'Ada',
        authenticated: true,
      },
      globalPoints: 42,
      apiBase: 'https://radiotedu.com/jukebox/api/v1',
      accessToken: 'short-lived-access-token',
    });

    expect(script).toContain("Object.defineProperty(window, 'localStorage'");
    expect(script).toContain("'default-hair': 'short-hair'");
    expect(script).toContain("'radio-hoodie': 'default-top'");
    expect(script).toContain('/study/avatar/me');
    expect(script).toContain('/study/avatar/equip');
  });
});
