import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '../android');
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), 'utf8');

describe('Android form-factor delivery', () => {
  it('keeps Android Auto inside the phone package', () => {
    const manifest = read('app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('com.google.android.gms.car.application');
    expect(manifest).toContain('android.media.browse.MediaBrowserService');
    expect(manifest).toContain('.car.RadioTeduCarService');
  });

  it('publishes TV under the same package with TV-only targeting', () => {
    const gradle = read('tv/build.gradle');
    const manifest = read('tv/src/main/AndroidManifest.xml');
    expect(gradle).toContain('applicationId "com.radiotedumobile"');
    expect(gradle).toContain('versionCode 11001');
    expect(manifest).toContain('android.software.leanback');
    expect(manifest).toContain('android.intent.category.LEANBACK_LAUNCHER');
    expect(manifest).toContain('android.hardware.touchscreen');
    expect(manifest).toContain('android:required="false"');
  });

  it('publishes a standalone Wear app under the same package', () => {
    const gradle = read('wear/build.gradle');
    const manifest = read('wear/src/main/AndroidManifest.xml');
    expect(gradle).toContain('applicationId "com.radiotedumobile"');
    expect(gradle).toContain('versionCode 11002');
    expect(gradle).toContain('targetSdkVersion 35');
    expect(manifest).toContain('android.hardware.type.watch');
    expect(manifest).toContain('com.google.android.wearable.standalone');
    expect(manifest).toContain('android:value="true"');
  });

  it('uses remote HTTPS mounts and shared media playback', () => {
    const channels = read(
      'formfactor/src/main/java/com/radiotedumobile/formfactor/RadioChannels.kt',
    );
    const service = read(
      'formfactor/src/main/java/com/radiotedumobile/formfactor/RadioPlaybackService.kt',
    );
    expect(channels).toContain('qualityChannel("radiotedu-main", "RadioTEDU", "radio")');
    expect(channels).toContain('qualityChannel("radiotedu-rock", "Rock", "rock")');
    expect(channels).toContain('$origin/$mount-normal');
    expect(channels).toContain('$origin/$mount-low');
    expect(channels).toContain('$losslessOrigin/$mount-flac');
    expect(service).toContain('onPlayerError');
    expect(service).toContain('currentUrlIndex += 1');
    expect(service).toContain('MediaSessionService');
    expect(service).toContain('setAudioAttributes');
  });
});
