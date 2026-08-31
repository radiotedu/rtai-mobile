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
    expect(manifest).toContain('com.android.automotive');
    expect(manifest).toContain('android:appCategory="audio"');
    expect(manifest).toContain('androidx.car.app.launchable');
    expect(manifest).toContain('android.media.browse.MediaBrowserService');
    expect(manifest).toContain('.car.RadioTeduCarService');
  });

  it('keeps car toolbar category icons transparent for host tinting', () => {
    const radioIcon = read('app/src/main/res/drawable/car_tile_radio.xml');
    const podcastIcon = read('app/src/main/res/drawable/car_tile_podcasts.xml');
    expect(radioIcon).not.toContain('M0,0h108v108h-108z');
    expect(podcastIcon).not.toContain('M0,0h108v108h-108z');
    expect(radioIcon).toContain('a22,22');
    expect(podcastIcon).toContain('a10,10');
  });

  it('binds Android Auto artwork and controls to packaged icon resources', () => {
    const service = read(
      'app/src/main/java/com/radiotedumobile/car/RadioTeduCarService.kt',
    );
    const drawableRoot = path.join(root, 'app/src/main/res/drawable-nodpi');
    const stationIcons = [
      'radiotedu',
      'classic',
      'cazz',
      'lofi',
      'energize',
      'rock',
      'en',
      'fr',
    ];

    expect(service).toContain('.setCustomIconResId(R.drawable.car_format_hifi)');
    expect(service).toContain('.applyArtwork(artwork)');
    expect(service).toContain('"car_tile_radio" -> R.drawable.car_tile_radio');
    expect(service).toContain(
      '"car_tile_podcasts" -> R.drawable.car_tile_podcasts',
    );

    for (const station of stationIcons) {
      expect(service).toContain(
        `"car_station_${station}" -> R.drawable.car_station_${station}_thumb`,
      );
      expect(
        fs.existsSync(path.join(drawableRoot, `car_station_${station}_thumb.png`)),
      ).toBe(true);
    }
  });

  it('publishes TV under the same package with TV-only targeting', () => {
    const gradle = read('tv/build.gradle');
    const manifest = read('tv/src/main/AndroidManifest.xml');
    expect(gradle).toContain('applicationId "com.radiotedumobile"');
    expect(gradle).toContain('versionCode 12081');
    expect(manifest).toContain('android.software.leanback');
    expect(manifest).toContain('android.intent.category.LEANBACK_LAUNCHER');
    expect(manifest).toContain('android.hardware.touchscreen');
    expect(manifest).toContain('android:required="false"');
  });

  it('publishes a standalone Wear app under the same package', () => {
    const gradle = read('wear/build.gradle');
    const manifest = read('wear/src/main/AndroidManifest.xml');
    expect(gradle).toContain('applicationId "com.radiotedumobile"');
    expect(gradle).toContain('versionCode 12082');
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
    expect(channels).toContain('https://stream.radiotedu.com/radio');
    expect(channels).toContain('https://stream.radiotedu.com/rock');
    expect(service).toContain('MediaSessionService');
    expect(service).toContain('setAudioAttributes');
  });
});
