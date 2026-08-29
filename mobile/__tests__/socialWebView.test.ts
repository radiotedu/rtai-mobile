import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Social WebView surface', () => {
  it('registers Social as an in-app stack screen and Home quick action without touching Focus routing', () => {
    const navigatorSource = fs.readFileSync(path.join(__dirname, '../src/navigation/RootNavigator.tsx'), 'utf8');
    const homeSource = fs.readFileSync(path.join(__dirname, '../src/screens/HomeScreen.tsx'), 'utf8');
    const configSource = fs.readFileSync(path.join(__dirname, '../src/services/config.ts'), 'utf8');

    expect(navigatorSource).toContain('SocialWebViewScreen');
    expect(navigatorSource).toContain('<Stack.Screen name="Social"');
    expect(homeSource).toContain("navigation.navigate('Social')");
    expect(configSource).toContain('SOCIAL_WEB_URL = `https://${SERVER_DOMAIN}/social/`');
    expect(configSource).toContain('PROD_FOCUS_WEB_URL = `https://${SERVER_DOMAIN}/focus/`');
  });

  it('injects the native account bridge without persistent browser credentials', () => {
    const screenSource = fs.readFileSync(path.join(__dirname, '../src/screens/social/SocialWebViewScreen.tsx'), 'utf8');

    expect(screenSource).toContain('injectedJavaScriptBeforeContentLoaded');
    expect(screenSource).toContain('buildSocialAuthInjection');
    expect(screenSource).toContain('getAccessToken');
    expect(screenSource).toContain('refreshSession');
    expect(screenSource).toContain('onShouldStartLoadWithRequest');
    expect(screenSource).toContain('isAllowedSocialNavigation');
    expect(screenSource).toContain('parseSocialMessage');
    expect(screenSource).toContain('cacheEnabled={false}');
    expect(screenSource).toContain('cacheMode="LOAD_NO_CACHE"');
    expect(screenSource).not.toContain('AsyncStorage');
    expect(screenSource).not.toContain('refresh_token');
    expect(screenSource).not.toContain('localStorage.setItem');
    expect(screenSource).not.toContain('accessToken=');
    expect(screenSource).not.toContain('online at radiotedu.com/social');
    expect(screenSource).not.toContain('console.log');
  });

  it('blocks anonymous and guest users from opening Social', () => {
    const screenSource = fs.readFileSync(path.join(__dirname, '../src/screens/social/SocialWebViewScreen.tsx'), 'utf8');

    expect(screenSource).toContain('AuthGuard');
    expect(screenSource).toContain('const isRegisteredUser = Boolean(user && !user.is_guest)');
    expect(screenSource).toContain('if (!isRegisteredUser)');
    expect(screenSource).toContain("copy('social.registerTitle')");
    expect(screenSource).toContain("copy('social.registerText')");
  });

  it('refreshes the shared account after profile avatar changes', () => {
    const authSource = fs.readFileSync(path.join(__dirname, '../src/context/AuthContext.tsx'), 'utf8');
    const profileSource = fs.readFileSync(path.join(__dirname, '../src/screens/ProfileScreen.tsx'), 'utf8');

    expect(authSource).toContain('refreshSession: () => Promise<User | null>');
    expect(authSource).toContain('const clearSessionState = useCallback');
    expect(authSource).toContain('await clearAuthTokens();');
    expect(authSource).toContain('<AuthContext.Provider value={{');
    expect(authSource).toContain('refreshSession,');
    expect(authSource).toContain('loginWithTedu,');
    expect(profileSource).toContain('const { user, logout, deleteAccount, refreshSession } = useAuth();');
    expect(profileSource).toContain('await refreshSession();');
  });
});
