import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Android Auto car bridge source contract', () => {
  const source = () => fs.readFileSync(path.join(__dirname, '../src/services/carBridge.ts'), 'utf8');
  const nativeSource = () =>
    fs.readFileSync(
      path.join(__dirname, '../android/app/src/main/java/com/radiotedumobile/car/RadioTeduCarService.kt'),
      'utf8',
    );
  const nativeModuleSource = () =>
    fs.readFileSync(
      path.join(__dirname, '../android/app/src/main/java/com/radiotedumobile/car/CarBridgeModule.kt'),
      'utf8',
    );
  const manifestSource = () =>
    fs.readFileSync(path.join(__dirname, '../android/app/src/main/AndroidManifest.xml'), 'utf8');
  const androidBuildSource = () =>
    fs.readFileSync(path.join(__dirname, '../android/app/build.gradle'), 'utf8');
  const androidStringsSource = (qualifier = '') =>
    fs.readFileSync(
      path.join(__dirname, `../android/app/src/main/res/values${qualifier}/strings.xml`),
      'utf8',
    );

  it('keeps Android Auto browse independent of rankings and Jukebox services', () => {
    const carBridgeSource = source();

    expect(carBridgeSource).not.toContain("api.get('/users/leaderboard'");
    expect(carBridgeSource).not.toContain("api.get('/jukebox/devices'");
    expect(carBridgeSource).not.toContain("api.post('/jukebox/connect'");
    expect(carBridgeSource).toContain('cat_radio');
    expect(carBridgeSource).toContain('cat_podcasts');
  });

  it('keeps phone-only Study, avatar, and gamification surfaces out of the car browse tree', () => {
    const carBridgeSource = source();
    const browseTreeStart = carBridgeSource.indexOf('const categories = [');
    const browseTreeEnd = carBridgeSource.indexOf('CarBridge!.setCatalog', browseTreeStart);
    const browseTree = carBridgeSource.slice(browseTreeStart, browseTreeEnd);

    expect(browseTree).toContain('cat_radio');
    expect(browseTree).toContain('cat_podcasts');
    expect(browseTree).not.toContain('cat_rankings');
    expect(browseTree).not.toContain('cat_jukebox');
    expect(browseTree).toContain('parentId: \'cat_podcasts\'');
    expect(browseTree).not.toMatch(/Study|Çim|avatar|clothes|gamification|AvatarCloset|StudyRoom/);
  });

  it('supports Google Maps and Assistant playback through MediaSession search, not a map-specific SDK claim', () => {
    const serviceSource = nativeSource();

    expect(serviceSource).toContain('MediaLibraryService');
    expect(serviceSource).toContain('MediaLibrarySession');
    expect(serviceSource).toContain('onSetMediaItems');
    expect(serviceSource).toContain('requestMetadata.searchQuery');
    expect(serviceSource).toContain('onGetSearchResult');
    expect(serviceSource).not.toContain('GoogleMap');
    expect(serviceSource).not.toContain('Maps SDK');
  });

  it('declares modern and legacy browse actions with one aligned stable Media3 version', () => {
    const manifest = manifestSource();
    const build = androidBuildSource();

    expect(manifest).toContain('androidx.media3.session.MediaLibraryService');
    expect(manifest).toContain('android.media.browse.MediaBrowserService');
    expect(build).toContain('def media3Version = "1.10.1"');
    expect(build).toContain('media3-session:${media3Version}');
    expect(build).not.toMatch(/androidx\.media3:[^"']+:1\.3\.1/);
  });

  it('keeps Lo-Fi song metadata hidden while retaining its station logo on car surfaces', () => {
    const carBridgeSource = source();

    expect(carBridgeSource).toContain('shouldUseStationOnlyPresentation');
    expect(carBridgeSource).toContain(
      'shouldUseStationOnlyPresentation(c, track.streamQuality)',
    );
    expect(carBridgeSource).toContain("const description = stationOnly ? '' : copy.description");
    expect(carBridgeSource).toContain("stationOnly ? 'RadioTEDU Lo-Fi' : track?.title");
  });

  it('uses packaged square station resources instead of private Metro artwork URIs', () => {
    const carBridgeSource = source();
    expect(carBridgeSource).toContain("'radiotedu-jazz': `${TILE}car_station_cazz`");
    expect(carBridgeSource).toContain("'radiotedu-lofi': `${TILE}car_station_lofi`");
    expect(carBridgeSource).toContain('artwork: carStationArtwork(c.id)');

    for (const name of [
      'radiotedu',
      'classic',
      'cazz',
      'lofi',
      'energize',
      'rock',
      'en',
      'fr',
    ]) {
      const artwork = path.join(
        __dirname,
        `../android/app/src/main/res/drawable-nodpi/car_station_${name}.png`,
      );
      expect(fs.existsSync(artwork)).toBe(true);
      expect(fs.statSync(artwork).size).toBeGreaterThan(100_000);

      const thumbnail = path.join(
        __dirname,
        `../android/app/src/main/res/drawable-nodpi/car_station_${name}_thumb.png`,
      );
      expect(fs.existsSync(thumbnail)).toBe(true);
      expect(fs.statSync(thumbnail).size).toBeGreaterThan(1_000);
      expect(fs.statSync(thumbnail).size).toBeLessThan(64 * 1024);
    }
  });

  it('merges browse capabilities into response params and paginates lists safely', () => {
    const serviceSource = nativeSource();

    expect(serviceSource).toContain('Bundle(params?.extras ?: Bundle.EMPTY)');
    expect(serviceSource).toContain('.setRecent(params?.isRecent == true)');
    expect(serviceSource).toContain('.setOffline(params?.isOffline == true)');
    expect(serviceSource).toContain('.setSuggested(params?.isSuggested == true)');
    expect(serviceSource).toContain('paginate(children, page, pageSize)');
    expect(serviceSource).toContain('paginate(results, page, pageSize)');
    expect(serviceSource).toContain('page.toLong() * pageSize.toLong()');
    expect(serviceSource).not.toContain('return direct.take(20)');
  });

  it('groups podcast episodes by series and carries quality to native playback', () => {
    const carBridgeSource = source();
    const nativeSourceText = nativeSource();

    expect(carBridgeSource).toContain('seriesId: `podcast-series:');
    expect(carBridgeSource).toContain("parentId: 'cat_podcasts'");
    expect(carBridgeSource).toContain('quality: track.streamQuality');
    expect(carBridgeSource).toContain('audioFormat');
    expect(carBridgeSource).not.toContain('.slice(0, 12)');
    expect(carBridgeSource).toContain("quality === 'low' ? 'low' : 'normal'");
    expect(carBridgeSource).toContain("'radiotedu-classic': 'RadioTEDU Classical'");
    expect(nativeSourceText).toContain('meteredSafeQueueFor(resolved)');
    expect(nativeSourceText).toContain('queue.filterNot { it.quality == "flac" }');
    expect(nativeSourceText).toContain('remembered.quality == "flac"');
    expect(nativeSourceText).toContain('item.seriesId != null');
    expect(nativeSourceText).toContain('seriesId = json.optString("seriesId"');
    expect(nativeSourceText).toContain('Icy-MetaData');
    expect(nativeSourceText).toContain('DESCRIPTION_EXTRAS_KEY_COMPLETION_PERCENTAGE');
    expect(nativeSourceText).toContain('params?.isSuggested == true');
    expect(nativeSourceText).not.toContain('setIconBitmap');
    expect(nativeSourceText).toContain('setArtworkData');
    expect(nativeSourceText).toContain('enrichCurrentTrackArtwork');
    expect(nativeSourceText).toContain('setStation(if (fallback.seriesId == null) fallback.title else null)');
    expect(nativeSourceText).toContain('TRACK_ARTWORK_MAX_BYTES');
    expect(nativeSourceText).toContain('itunes.apple.com/search');
    expect(nativeSourceText).toContain('ACTION_TOGGLE_HIFI');
    expect(nativeSourceText).toContain('Confirm Hi-Fi');
    expect(nativeSourceText).toContain('CommandButton.ICON_QUALITY');
    expect(nativeSourceText).toContain('KEY_CONTENT_FORMAT_TINTABLE_LARGE_ICON_URI');
    expect(nativeSourceText).toContain('KEY_CONTENT_FORMAT_TINTABLE_SMALL_ICON_URI');
    expect(nativeSourceText).toContain('setSubtitle(if (quality == "flac") "$title · Hi-Fi" else if (seriesId == null) title');
    expect(nativeSourceText).toContain('.setSubtitle(subtitle)');
    expect(nativeSourceText).toContain('mediaMetadata.subtitle?.toString() != subtitle');
    expect(carBridgeSource).toContain('hiFiUrl: c.streams.flac');
    expect(nativeSourceText).toContain('CAR_TILE_MAX_BYTES');
    expect(nativeSourceText).toContain('R.drawable.car_tile_radio');
    expect(nativeSourceText).toContain('R.drawable.car_tile_podcasts');
    expect(nativeSourceText).toContain('R.drawable.car_station_cazz_thumb');
    expect(nativeSourceText).toContain('R.drawable.car_station_lofi_thumb');
    expect(nativeSourceText).toContain(
      'android.resource://com.radiotedumobile/drawable/car_station_radiotedu',
    );
    expect(nativeSourceText).not.toContain('R.drawable.car_tile_charts');
    expect(nativeSourceText).not.toContain('R.drawable.car_tile_jukebox');
    expect(nativeSourceText).toContain('R.string.car_flac_metered_warning');
  });

  it('allowlists only Live Radio and Podcasts from cached or cold-start catalogs', () => {
    const serviceSource = nativeSource();

    expect(serviceSource).toContain('ROOT_CATEGORY_IDS = listOf(CAT_RADIO, CAT_PODCASTS)');
    expect(serviceSource).toContain('CarCatalogPolicy.isAllowedCategory');
    expect(serviceSource).toContain('CarCatalogPolicy.isAllowedItem');
    expect(serviceSource).toContain('for (category in allowedCatalogCategories(categories))');
    expect(serviceSource).toContain('ROOT_CATEGORY_IDS.map { id ->');
    expect(serviceSource).toContain('fallbackRootCategory(id)');
    expect(serviceSource).toContain('RADIO_CATEGORY_ARTWORK');
    expect(serviceSource).toContain('PODCAST_CATEGORY_ARTWORK');
    expect(serviceSource).not.toContain('topLevelCategories(categories)');
  });

  it('resumes podcasts from schema-versioned absolute positions but never seeks live radio', () => {
    const serviceSource = nativeSource();

    expect(serviceSource).toContain('PODCAST_PROGRESS_SCHEMA = 2');
    expect(serviceSource).toContain('.putLong(KEY_POSITION_PREFIX + item.id, position)');
    expect(serviceSource).toContain('.putLong(KEY_DURATION_PREFIX + item.id, duration)');
    expect(serviceSource).toContain('savedPodcastPositionMs(resolved.id)');
    expect(serviceSource).toContain('val startPositionMs = if (resolved.seriesId != null)');
    expect(serviceSource).toContain('PODCAST_COMPLETION_THRESHOLD');
    expect(serviceSource).toContain('.remove(KEY_POSITION_PREFIX + mediaId)');
    expect(serviceSource).toContain('.remove(KEY_DURATION_PREFIX + mediaId)');
    expect(serviceSource).toContain('markPodcastCompleted(previous.id)');
  });

  it('keeps voice aliases and latest-podcast playback deterministic', () => {
    const serviceSource = nativeSource();

    expect(serviceSource).toContain('CarVoiceQueryPolicy.isLatestPodcastQuery');
    expect(serviceSource).toContain('CarVoiceQueryPolicy.stationAliasScore');
    expect(serviceSource).toContain('.sortedByDescending { (_, score) -> score }');
    expect(serviceSource).toContain('"latest", "newest"');
    expect(serviceSource).toContain('latestWords.any(words::contains)');
    expect(serviceSource).toContain('podcastWords.any(words::contains)');
    expect(serviceSource).toContain('"jazz", "cazz", "caz"');
    expect(serviceSource).toContain('"lofi", "lo fi", "lo-fi"');
    expect(serviceSource).toContain('allPlayableItems().firstOrNull { it.seriesId != null }');
    expect(serviceSource).toContain('Regex("[^\\\\p{L}\\\\p{N}]+")');
    expect(serviceSource).not.toContain('Regex("[^a-z0-9]+")');
    expect(serviceSource).toContain('if (normalized.isEmpty()) return emptyList()');
    expect(serviceSource).toContain('"последний", "новый"');
    expect(serviceSource).toContain('"احدث"');
    expect(serviceSource).toContain('"neuester", "neueste", "letzte"');
    expect(serviceSource).toContain('"dernier", "nouveau", "nouvel"');
    expect(serviceSource).toContain('"радио теду"');
    expect(serviceSource).toContain('"راديو تيدو"');
  });

  it('localizes every native car fallback in all six supported languages', () => {
    const keys = [
      'car_live_radio',
      'car_playback_error',
      'car_stream_connect_error',
      'car_flac_metered_warning',
      'car_no_media_item_requested',
      'car_unknown_media_item',
      'car_podcasts',
      'car_podcast_audio',
    ];

    for (const qualifier of ['', '-tr', '-ar', '-ru', '-de', '-fr']) {
      const strings = androidStringsSource(qualifier);
      for (const key of keys) {
        expect(strings).toContain(`name="${key}"`);
      }
    }
    expect(androidStringsSource()).toContain(
      '<string name="app_name" translatable="false">RadioTEDU</string>',
    );
  });

  it('synchronizes in-app language changes with cached JS and native Media3 copy', () => {
    const carBridgeSource = source();
    const serviceSource = nativeSource();
    const moduleSource = nativeModuleSource();

    expect(carBridgeSource).toContain("i18n.on('languageChanged'");
    expect(carBridgeSource).toContain('getLanguagePreference()');
    expect(carBridgeSource).toContain('setLanguagePreference?.');
    expect(carBridgeSource).toContain('writeCachedCarCatalog();');
    expect(moduleSource).toContain('fun setLanguagePreference(preference: String)');
    expect(moduleSource).toContain('"system", "en", "tr", "ar", "ru", "de", "fr"');
    expect(serviceSource).toContain('KEY_LANGUAGE_PREFERENCE');
    expect(serviceSource).toContain('private fun localizedString(@StringRes resourceId: Int)');
    expect(serviceSource).toContain('Configuration(resources.configuration)');
    expect(serviceSource).not.toMatch(/getString\(R\.string\./);
  });
});
