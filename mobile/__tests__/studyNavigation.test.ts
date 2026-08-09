import {describe, expect, it, jest} from '@jest/globals';
import fs from 'fs';
import path from 'path';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-safe-area-context', () => ({SafeAreaView: 'SafeAreaView'}));
jest.mock('@react-navigation/native', () => ({useNavigation: () => ({navigate: jest.fn()})}));

import {STUDY_LOCATION_CARDS} from '../src/screens/study/StudyHomeScreen';

const read = (relative: string) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

describe('Study navigation', () => {
  it('defines Library and Chim Alan as the only app Study room entries', () => {
    expect(STUDY_LOCATION_CARDS.map(card => card.id)).toEqual(['library', 'chim-alan']);
  });

  it('routes both room entries to the same remote game client', () => {
    const navigatorSource = read('src/navigation/RootNavigator.tsx');
    const homeSource = read('src/screens/study/StudyHomeScreen.tsx');
    expect(navigatorSource).toContain('component={LibraryStudyWebView}');
    expect(navigatorSource).not.toContain('StudyRoomScreen');
    expect(homeSource).toContain("navigation.navigate('StudyRoom', {locationId: location.id})");
    expect(homeSource).not.toContain("location.id === 'library'");
  });

  it('loads the separate app-only Study website without bundled content', () => {
    const source = read('src/screens/study/LibraryStudyWebView.tsx');
    expect(source).toContain('buildStudyEntryUrl');
    expect(source).toContain("originWhitelist={['https://radiotedu.com']}");
    expect(source).toContain('isAllowedStudyNavigation');
    expect(source).toContain('onShouldStartLoadWithRequest');
    expect(source).toContain('onHttpError');
    expect(source).toContain('cacheEnabled={false}');
    expect(source).toContain('allowFileAccess={false}');
    expect(source).toContain('allowFileAccessFromFileURLs={false}');
    expect(source).toContain('allowUniversalAccessFromFileURLs={false}');
    expect(source).toContain('mixedContentMode="never"');
    expect(source).toContain('thirdPartyCookiesEnabled={false}');
    expect(source).toContain('domStorageEnabled={false}');
    expect(source).toContain("AsyncStorage.getItem('access_token')");
    expect(source).not.toContain('refresh_token');
    expect(source).not.toContain('FOCUS_WEB_URL');
  });

  it('injects the approved authenticated bridge and preserves the guest lock', () => {
    const source = read('src/screens/study/LibraryStudyWebView.tsx');
    expect(source).toContain('createStudyWebViewBridge');
    expect(source).toContain('apiBase: BASE_API');
    expect(source).toContain('accessToken');
    expect(source).toContain('const isLocked = !user || user.is_guest');
    expect(source).toContain("navigation.navigate('Auth', {screen: 'Login'})");
  });

  it('does not package Study into the native app', () => {
    const packageJson = JSON.parse(read('package.json')) as {scripts: Record<string, string>};
    expect(packageJson.scripts['package:study']).toBeUndefined();
    expect(fs.existsSync(path.join(__dirname, '../android/app/src/main/assets/study-game'))).toBe(false);
    expect(fs.existsSync(path.join(__dirname, '../src/screens/study/StudyRoomScreen.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(__dirname, '../src/screens/study/studyMap.ts'))).toBe(false);
    expect(fs.existsSync(path.join(__dirname, '../src/assets/study/library-habbo.png'))).toBe(false);
  });
});
