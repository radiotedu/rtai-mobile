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

  it('binds every capture to one installed APK, signer, component, version, and English locale', () => {
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
    expect(source).toContain('requestedEnglishLocale');
    expect(verifyInstall).toBeGreaterThan(captureStart);
    expect(verifyLocale).toBeGreaterThan(captureStart);
    expect(verifyInstall).toBeLessThan(screencap);
    expect(verifyLocale).toBeLessThan(screencap);
    expect(source).not.toContain('aabBytes');
    expect(docs).not.toContain(' --aab ');
    expect(docs).toContain('installed `base.apk` SHA-256 equals the input APK');
  });

  it('composes only sealed real pixels into a portrait RGB phone frame', () => {
    const source = read('scripts/compose-radiotedu-store-portrait.py');

    expect(source).toContain('WIDTH = 1080');
    expect(source).toContain('HEIGHT = 1920');
    expect(source).toContain('verify_seal');
    expect(source).toContain('sessionSha256');
    expect(source).toContain('color type 2 (24-bit RGB, no alpha)');
    expect(source).toContain('min(target_width / screen.width, target_height / screen.height, 1.0)');
  });

  it('has eight English feature images with bounded alt text and real-screen labels', () => {
    const copy = JSON.parse(
      read('mobile/android/store-assets/copy/en.json'),
    ) as Record<string, {altText: string; proofLabel: string}>;

    expect(Object.keys(copy)).toHaveLength(8);
    for (const item of Object.values(copy)) {
      expect(item.altText.length).toBeLessThanOrEqual(140);
      expect(item.proofLabel).toContain('REAL APP SCREEN');
    }
  });
});
