import fs from 'fs';
import path from 'path';
import {describe, expect, it} from '@jest/globals';

import {ecosystemCopy} from '../src/i18n/ecosystemCopy';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('RadioTEDU ecosystem dashboard', () => {
  it('is reachable from Home and the dashboard deep-link route', () => {
    const home = read('src/screens/HomeScreen.tsx');
    const navigator = read('src/navigation/RootNavigator.tsx');
    const app = read('App.tsx');

    expect(home).toContain("navigation.navigate('Ecosystem')");
    expect(navigator).toContain('name="Ecosystem"');
    expect(app).toContain("Ecosystem: 'dashboard'");
  });

  it('never renders Oda QR unless the ERP permission check succeeds', () => {
    const screen = read('src/screens/EcosystemScreen.tsx');

    expect(screen).toContain('fetchRoomAccessEligibility()');
    expect(screen).toContain('{roomAccess ? (');
    expect(screen).not.toContain('roomAccess ??');
    expect(screen).not.toContain('roomAccess.display_url');
  });

  it('keeps all six app languages internally complete', () => {
    for (const language of ['en', 'tr', 'ru', 'ar', 'de', 'fr']) {
      const copy = ecosystemCopy(language);
      expect(copy.navTitle.length).toBeGreaterThan(0);
      expect(copy.ticketsTitle.length).toBeGreaterThan(0);
      expect(copy.reservationTitle.length).toBeGreaterThan(0);
      expect(copy.roomTitle).toBe('Oda QR');
    }
  });
});
