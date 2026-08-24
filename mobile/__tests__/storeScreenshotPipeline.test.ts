import fs from 'fs';
import path from 'path';
import {describe, expect, it} from '@jest/globals';

const repositoryRoot = path.resolve(__dirname, '../..');
const read = (relative: string) =>
  fs.readFileSync(path.join(repositoryRoot, relative), 'utf8');

describe('Google Play screenshot evidence pipeline', () => {
  it('keeps real ADB evidence immutable and records dynamic OS insets', () => {
    const source = read('scripts/capture-android-store-screenshot.mjs');

    expect(source).toContain("['exec-out', 'screencap', '-p']");
    expect(source).toContain("{flag: 'wx'}");
    expect(source).toContain('parseInsets');
    expect(source).toContain('raw-manifest.sha256');
    expect(source).toContain("--untracked-files=all");
    expect(source).not.toContain("--untracked-files=no");
    expect(source).toContain("text.match(/Override size:");
    expect(source).toContain("Raw evidence is sealed; no further captures are allowed.");
    expect(source).toContain("fs.readFileSync(sessionPath)");
  });

  it('binds every capture to source, APK, signer, component, version, and a supported locale', () => {
    const source = read('scripts/capture-android-store-screenshot.mjs');
    const docs = read('docs/STORE_SCREENSHOT_EVIDENCE.md');
    const captureStart = source.indexOf('function capture()');
    const verifyInstall = source.indexOf('verifyInstalledApp(serial, session)', captureStart);
    const verifyLocale = source.indexOf('verifyLocales(serial, session)', captureStart);
    const screencap = source.indexOf("['exec-out', 'screencap', '-p']", captureStart);

    expect(source).toContain('installedBaseApkPath');
    expect(source).toContain('installedFileSha256');
    expect(source).toContain('Installed base.apk hash differs from the exact input APK.');
    expect(source).toContain('resolveComponent(serial, component)');
    expect(source).toContain("'--print-certs'");
    expect(source).toContain('certificateSha256');
    expect(source).toContain("'set-app-locales'");
    expect(source).toContain("'get-app-locales'");
    expect(source).toContain('requestedStoreLocale');
    expect(source).toContain('BUILD_GIT_SHA');
    expect(source).toContain('installed.buildGitSha !== gitSha');
    expect(source).toContain('installed.buildGitDirty');
    expect(source).toContain("required('expected-signer-sha256')");
    expect(source).toContain('RADIOTEDU_RELEASE_SIGNER_SHA256');
    expect(source).toContain('pinned RadioTEDU production release signer');
    expect(source).toContain('b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439');
    expect(source).toContain('does not match the expected production release signer');
    expect(source).toContain('schemaVersion: 3');
    expect(verifyInstall).toBeGreaterThan(captureStart);
    expect(verifyLocale).toBeGreaterThan(captureStart);
    expect(verifyInstall).toBeLessThan(screencap);
    expect(verifyLocale).toBeLessThan(screencap);
    expect(source).not.toContain('aabBytes');
    expect(docs).not.toContain(' --aab ');
    expect(docs).toContain('installed `base.apk` SHA-256 equals the input APK');
    expect(docs).toContain('embedded build Git SHA equals the clean checked-out SHA');
  });

  it('composes only sealed real pixels into a restrained editorial portrait', () => {
    const source = read('scripts/compose-radiotedu-store-portrait.py');

    expect(source).toContain('WIDTH = 1080');
    expect(source).toContain('HEIGHT = 1920');
    expect(source).toContain('verify_seal');
    expect(source).toContain('sessionSha256');
    expect(source).toContain('color type 2 (24-bit RGB, no alpha)');
    expect(source).toContain('LAYOUT_VERSION = "editorial-v1"');
    expect(source).toContain('scale = target_width / screen.width');
    expect(source).not.toContain('proofLabel');
  });

  it('has eight English feature images with bounded alt text and no defensive labels', () => {
    const copy = JSON.parse(
      read('mobile/android/store-assets/copy/en.json'),
    ) as Record<string, {altText: string; proofLabel?: string}>;

    expect(Object.keys(copy)).toHaveLength(8);
    for (const item of Object.values(copy)) {
      expect(item.altText.length).toBeLessThanOrEqual(140);
      expect(item.proofLabel).toBeUndefined();
    }
  });

  it('ships key-complete store copy for all six app locales', () => {
    const english = JSON.parse(
      read('mobile/android/store-assets/copy/en.json'),
    ) as Record<string, {altText: string; locale: string; proofLabel?: string}>;
    const expectedKeys = Object.keys(english).sort();

    for (const locale of ['en', 'tr', 'ar', 'ru', 'de', 'fr']) {
      const copy = JSON.parse(
        read(`mobile/android/store-assets/copy/${locale}.json`),
      ) as Record<string, {altText: string; locale: string; proofLabel?: string}>;
      expect(Object.keys(copy).sort()).toEqual(expectedKeys);
      for (const item of Object.values(copy)) {
        expect(item.locale).toBe(locale);
        expect(item.altText.length).toBeLessThanOrEqual(140);
        expect(item.proofLabel).toBeUndefined();
      }
    }
  });
});
