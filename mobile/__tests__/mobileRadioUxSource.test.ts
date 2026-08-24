import fs from 'fs';
import path from 'path';
import {describe, expect, it} from '@jest/globals';

const read = (relative: string) =>
  fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

describe('mobile radio presentation', () => {
  it('shows Hi-Fi beside LIVE only for active FLAC playback', () => {
    const radio = read('src/screens/RadioScreen.tsx');
    expect(radio).toContain("currentQuality === 'flac'");
    expect(radio).toContain('<Text style={styles.hifiText}>Hi-Fi</Text>');
    expect(radio).toMatch(/liveBadge[\s\S]*?hifiBadge/);
  });

  it('uses short mobile names while car surfaces retain branded titles', () => {
    const channels = read('src/data/radioChannels.ts');
    const car = read('src/services/carBridge.ts');
    const carPlay = read('ios/RadioTEDUMobile/CarPlaySceneDelegate.mm');
    expect(channels).toContain("name: 'Classical'");
    expect(channels).toContain("name: 'Lo-Fi'");
    expect(channels).toContain("name: 'Voting'");
    expect(channels).not.toContain("name: 'RadioTEDU Lo-Fi'");
    expect(car).toContain("'radiotedu-classic': 'RadioTEDU Classical'");
    expect(car).toContain("'radiotedu-lofi': 'RadioTEDU Lo-Fi'");
    expect(car).toContain("'radiotedu-spark': 'RadioTEDU Voting'");
    expect(carPlay).toContain('@"title": @"RadioTEDU Classical"');
    expect(carPlay).toContain('@"title": @"RadioTEDU Lo-Fi"');
    expect(carPlay).toContain('@"title": @"RadioTEDU Voting"');
  });

  it('handles Android Back through navigation instead of exiting', () => {
    const app = read('App.tsx');
    expect(app).toContain("BackHandler.addEventListener('hardwareBackPress'");
    expect(app).toContain('navigationRef.canGoBack()');
    expect(app).toContain("activeTab !== 'Home'");
    expect(app).toContain('return true;');
  });
});
