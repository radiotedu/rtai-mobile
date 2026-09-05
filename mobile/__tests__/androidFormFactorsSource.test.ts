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
    expect(manifest.match(/android\.media\.action\.MEDIA_PLAY_FROM_SEARCH/g)).toHaveLength(1);
    const media3Block = manifest.slice(manifest.indexOf('.car.RadioTeduCarService'));
    expect(media3Block).toContain('android.media.action.MEDIA_PLAY_FROM_SEARCH');
  });

  it('keeps Assistant, Gemini, icons, and decoder fallback on current Media3', () => {
    const service = read(
      'app/src/main/java/com/radiotedumobile/car/RadioTeduCarService.kt',
    );
    const gradle = read('app/build.gradle');
    expect(gradle).toContain('def media3Version = "1.10.1"');
    expect(gradle).toContain('androidx.media3:media3-session:${media3Version}');
    expect(service).toContain('class RadioTeduCarService : MediaLibraryService()');
    expect(service).toContain(
      'MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS',
    );
    expect(service).toContain('override fun onSearch(');
    expect(service).toContain('override fun onGetSearchResult(');
    expect(service).toContain('requestMetadata.searchQuery');
    expect(service).toContain('DefaultRenderersFactory');
    expect(service).toContain('.setEnableDecoderFallback(true)');
    expect(service).toContain('EXTENSION_RENDERER_MODE_PREFER');
    expect(service).toContain('PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST');
    expect(service).toContain('recoverRadioToLowIfAllowed("player_error")');
    expect(service).toContain('recoverRadioToLowIfAllowed("buffer_timeout")');
    expect(service).toContain('private const val BUFFERING_WATCHDOG_MS = 6_000L');
    expect(service).toContain('private fun CatalogItem.toLowVariant()');
    expect(service).toContain('private fun CatalogItem.toSameStreamRecoveryVariant()');
    expect(service).toContain('private val LOW_RECOVERY_MOUNT_PATHS = setOf(');
    expect(service).toContain('MAX_LOW_RECOVERY_ATTEMPTS = 3');
    expect(gradle).toContain('kotlinaudio-v2.1.0-radiotedu.aar');
    expect(gradle).toContain('exoplayer-flac-2.19.0-radiotedu.aar');
    expect(
      fs.existsSync(path.join(root, 'vendor/kotlinaudio-v2.1.0-radiotedu.aar')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(root, 'vendor/exoplayer-flac-2.19.0-radiotedu.aar')),
    ).toBe(true);
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
    const manifest = read('app/src/main/AndroidManifest.xml');
    const service = read(
      'app/src/main/java/com/radiotedumobile/car/RadioTeduCarService.kt',
    );
    const provider = read(
      'app/src/main/java/com/radiotedumobile/car/CarArtworkProvider.kt',
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
    expect(service).toContain('normalizeRemoteArtwork');
    expect(service).toContain('cachedCarArtworkUri');
    expect(manifest).toContain('.car.CarArtworkProvider');
    expect(provider).toContain('SAFE_ARTWORK_NAME');
    expect(provider).toContain('ParcelFileDescriptor.MODE_READ_ONLY');

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
    expect(gradle).toContain('versionCode 13071');
    expect(manifest).toContain('android.software.leanback');
    expect(manifest).toContain('android.intent.category.LEANBACK_LAUNCHER');
    expect(manifest).toContain('android.hardware.touchscreen');
    expect(manifest).toContain('android:required="false"');
  });

  it('publishes a standalone Wear app under the same package', () => {
    const gradle = read('wear/build.gradle');
    const manifest = read('wear/src/main/AndroidManifest.xml');
    expect(gradle).toContain('applicationId "com.radiotedumobile"');
    expect(gradle).toContain('versionCode 13072');
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
    const gradle = read('formfactor/build.gradle');
    const tvManifest = read('tv/src/main/AndroidManifest.xml');
    const wearManifest = read('wear/src/main/AndroidManifest.xml');
    expect(channels).toContain('https://stream.radiotedu.com/radio');
    expect(channels).toContain('https://stream.radiotedu.com/rock');
    expect(gradle.match(/androidx\.media3:[^:]+:1\.10\.1/g)).toHaveLength(2);
    expect(service).toContain('MediaLibraryService');
    expect(service).toContain('override fun onSearch(');
    expect(service).toContain('requestMetadata.searchQuery');
    expect(service).toContain('.setEnableDecoderFallback(true)');
    expect(service).toContain('EXTENSION_RENDERER_MODE_PREFER');
    expect(service).toContain('Icy-MetaData');
    expect(service).toContain('setAudioAttributes');
    for (const manifest of [tvManifest, wearManifest]) {
      expect(manifest).toContain('android:exported="true"');
      expect(manifest).toContain('androidx.media3.session.MediaLibraryService');
      expect(manifest).toContain('android.media.action.MEDIA_PLAY_FROM_SEARCH');
      expect(manifest).toContain('android.intent.action.MEDIA_BUTTON');
    }
  });
});
