import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), 'utf8');

describe('iOS release readiness', () => {
  it('uses the public app name independently of the internal product name', () => {
    const plist = read('ios/RadioTEDUMobile/Info.plist').replace(/\r\n/g, '\n');
    expect(plist).toContain(
      '<key>CFBundleDisplayName</key>\n\t<string>RadioTEDU</string>',
    );
    expect(plist).toContain(
      '<key>CFBundleName</key>\n\t<string>$(PRODUCT_NAME)</string>',
    );
  });

  it('uses the current cross-platform release version', () => {
    const project = read('ios/RadioTEDUMobile.xcodeproj/project.pbxproj');
    expect(project).toContain('MARKETING_VERSION = 1.2.9;');
    expect(project).toContain('CURRENT_PROJECT_VERSION = 12090;');
  });

  it('forwards ERP login deep links to React Native on iPhone and iPad', () => {
    const delegate = read('ios/RadioTEDUMobile/AppDelegate.mm');
    expect(delegate).toContain('#import <React/RCTLinkingManager.h>');
    expect(delegate).toContain('openURLContexts:');
    expect(delegate).toContain('connectionOptions.URLContexts');
    expect(delegate).toContain('connectionOptions.userActivities');
    expect(delegate).toContain('RCTJavaScriptDidLoadNotification');
    expect(delegate).toContain('continueUserActivity:');
    expect(delegate.match(/RCTLinkingManager application:/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('makes the Firebase Swift dependency graph modular for CocoaPods CI', () => {
    const podfile = read('ios/Podfile');
    expect(podfile).toContain(
      "pod 'GoogleUtilities', :modular_headers => true",
    );
    expect(podfile).toContain("pod 'FirebaseAnalytics/Core', '~> 11.15.0'");
  });

  it('uses secure transport, required permissions, audio, and deep links', () => {
    const plist = read('ios/RadioTEDUMobile/Info.plist').replace(/\r\n/g, '\n');
    expect(plist).toContain('<key>NSAllowsArbitraryLoads</key>\n\t\t<false/>');
    expect(plist).toContain('<key>NSPhotoLibraryUsageDescription</key>');
    expect(plist).toContain('<key>UIBackgroundModes</key>');
    expect(plist).toContain('<string>audio</string>');
    expect(plist).toContain('<string>radiotedu</string>');
    expect(plist).not.toContain('NSLocationWhenInUseUsageDescription');
    expect(plist).not.toContain('<string>armv7</string>');
  });

  it('has every required App Store icon file', () => {
    const iconRoot = path.join(
      root,
      'ios/RadioTEDUMobile/Images.xcassets/AppIcon.appiconset',
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(iconRoot, 'Contents.json'), 'utf8'),
    ) as {images: Array<{filename?: string; idiom?: string}>};

    expect(manifest.images).toHaveLength(18);
    expect(
      manifest.images.filter(image => image.idiom === 'iphone'),
    ).toHaveLength(8);
    expect(
      manifest.images.filter(image => image.idiom === 'ipad'),
    ).toHaveLength(9);
    expect(
      manifest.images.filter(image => image.idiom === 'ios-marketing'),
    ).toHaveLength(1);
    for (const image of manifest.images) {
      expect(image.filename).toBeTruthy();
      expect(fs.existsSync(path.join(iconRoot, image.filename!))).toBe(true);
    }
  });

  it('ships CarPlay in the same iOS target', () => {
    const plist = read('ios/RadioTEDUMobile/Info.plist');
    const entitlements = read(
      'ios/RadioTEDUMobile/RadioTEDUMobile.entitlements',
    );
    const project = read('ios/RadioTEDUMobile.xcodeproj/project.pbxproj');
    const delegate = read('ios/RadioTEDUMobile/CarPlaySceneDelegate.mm');

    expect(plist).toContain('CPTemplateApplicationScene');
    expect(plist).toContain('CarPlaySceneDelegate');
    expect(entitlements).toContain('com.apple.developer.carplay-audio');
    expect(project).toContain(
      'CODE_SIGN_ENTITLEMENTS = RadioTEDUMobile/RadioTEDUMobile.entitlements',
    );
    expect(delegate).toContain('CPListTemplate');
    expect(delegate).toContain('CPNowPlayingTemplate');
    expect(delegate).toContain('@"remote-play-id"');
  });

  it('loads all website-owned experiences remotely without native caching', () => {
    for (const screen of [
      'src/screens/study/LibraryStudyWebView.tsx',
      'src/screens/next-song-vote/NextSongVoteScreen.tsx',
      'src/screens/jukebox/JukeLocalWebViewScreen.tsx',
    ]) {
      const source = read(screen);
      expect(source).toContain('source={{uri:');
      expect(source).toContain('cacheEnabled={false}');
    }

    expect(read('src/services/studyWebViewService.ts')).not.toContain(
      'file:///android_asset',
    );
  });
});
