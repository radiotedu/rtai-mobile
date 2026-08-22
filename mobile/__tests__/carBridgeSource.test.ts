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

    expect(serviceSource).toContain('MediaBrowserServiceCompat');
    expect(serviceSource).toContain('MediaSessionCompat');
    expect(serviceSource).toContain('onPlayFromSearch');
    expect(serviceSource).toContain('onPlayFromMediaId');
    expect(serviceSource).not.toContain('GoogleMap');
    expect(serviceSource).not.toContain('Maps SDK');
  });

  it('keeps Lo-Fi song metadata hidden while retaining its station logo on car surfaces', () => {
    const carBridgeSource = source();

    expect(carBridgeSource).toContain('shouldUseStationOnlyPresentation');
    expect(carBridgeSource).toContain("shouldUseStationOnlyPresentation(c, catalogQuality) ? '' : copy.description");
    expect(carBridgeSource).toContain("stationOnly ? 'RadioTEDU Lo-Fi' : track?.title");
  });

  it('groups podcast episodes by series and carries quality to native playback', () => {
    const carBridgeSource = source();
    const nativeSourceText = nativeSource();

    expect(carBridgeSource).toContain('seriesId: `podcast-series:');
    expect(carBridgeSource).toContain("parentId: 'cat_podcasts'");
    expect(carBridgeSource).toContain('quality: track.streamQuality');
    expect(nativeSourceText).toContain('cyclePodcast(1)');
    expect(nativeSourceText).toContain('seriesId = json.optString("seriesId"');
    expect(nativeSourceText).toContain('Icy-MetaData');
    expect(nativeSourceText).toContain('setIconBitmap');
    expect(nativeSourceText).toContain('FLAC uses considerably more mobile data');
  });
});
