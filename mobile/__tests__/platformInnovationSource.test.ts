import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

const repo = path.join(__dirname, '..', '..');
const mobile = path.join(repo, 'mobile');
const read = (base: string, relative: string) => fs.readFileSync(path.join(base, relative), 'utf8');

describe('innovative media surfaces', () => {
  it('versions the repaired footer-player metadata pipeline', () => {
    const php = read(repo, 'website/wordpress-overlay/wp-content/plugins/radiotedu-core/includes/class-radiotedu-rest.php');
    const js = read(repo, 'website/wordpress-overlay/wp-content/themes/radiotedu/assets/js/app.js');
    expect(php).toContain("CURLOPT_CAINFO => ABSPATH . WPINC . '/certificates/ca-bundle.crt'");
    expect(php).toContain("CURLOPT_HTTPHEADER => ['Icy-MetaData: 1'");
    expect(php).toContain("!$isLofi && $payload['track']");
    expect(php).toContain('https://itunes.apple.com/search');
    expect(js).toContain('/live?player=1');
    expect(js).toContain('data.artwork_url');
  });

  it('keeps Maps integration on the Android media contract', () => {
    const manifest = read(mobile, 'android/app/src/main/AndroidManifest.xml');
    const service = read(mobile, 'android/app/src/main/java/com/radiotedumobile/car/RadioTeduCarService.kt');
    expect(manifest).toContain('com.google.android.gms.car.application');
    expect(manifest).toContain('android:appCategory="audio"');
    expect(service).toContain('MediaLibraryService');
    expect(manifest).not.toContain('com.google.android.geo.API_KEY');
    expect(manifest).not.toContain('ACCESS_FINE_LOCATION');
  });

  it('ships Siri intents, AirPlay and Handoff without location access', () => {
    const intents = read(mobile, 'ios/RadioTEDUMobile/RadioTEDUAppIntents.swift');
    const picker = read(mobile, 'ios/RadioTEDUMobile/AirPlayRoutePickerManager.mm');
    const continuity = read(mobile, 'ios/RadioTEDUMobile/ContinuityBridge.mm');
    expect(intents).toContain('struct PlayRadioTEDUIntent: AppIntent');
    expect(intents).toContain('struct RadioTEDUAppShortcuts: AppShortcutsProvider');
    expect(picker).toContain('AVRoutePickerView');
    expect(continuity).toContain('eligibleForHandoff = YES');
  });

  it('ships Cast, Wear glance surfaces and voting-only Android live updates', () => {
    const gradle = read(mobile, 'android/app/build.gradle');
    const wearManifest = read(mobile, 'android/wear/src/main/AndroidManifest.xml');
    const live = read(mobile, 'android/app/src/main/java/com/radiotedumobile/live/LiveVoteBridgeModule.kt');
    expect(gradle).toContain('play-services-cast-framework:22.3.1');
    expect(wearManifest).toContain('RadioTeduTileService');
    expect(wearManifest).toContain('RadioTeduComplicationService');
    expect(live).toContain('Notification.ProgressStyle');
    expect(live).toContain('radiotedu://voting');
    expect(live.toLowerCase()).not.toContain('juke');
  });

  it('isolates EAP AppFunctions from the production settings graph', () => {
    const preview = read(mobile, 'android/appfunctions-preview/src/main/java/com/radiotedumobile/appfunctions/BaseRadioTeduAppFunctionService.kt');
    const settings = read(mobile, 'android/settings.gradle');
    expect(preview).toContain('@AppFunctionServiceEntryPoint');
    expect(preview).toContain('@AppFunction');
    expect(settings).not.toContain('appfunctions-preview');
  });
});
