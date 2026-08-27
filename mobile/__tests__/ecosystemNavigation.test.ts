import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('RadioTEDU ecosystem navigation', () => {
  const homeSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'screens', 'HomeScreen.tsx'),
    'utf8',
  );
  const navigatorSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'navigation', 'RootNavigator.tsx'),
    'utf8',
  );

  it('places tickets directly after Voting and hides Room QR without ERP attendance permission', () => {
    expect(homeSource.indexOf("navigate('MyTickets')")).toBeGreaterThan(
      homeSource.indexOf("navigate('NextSongVote')"),
    );
    expect(homeSource.indexOf("navigate('MyTickets')")).toBeLessThan(
      homeSource.indexOf("navigate('Social')"),
    );
    expect(homeSource).toContain("erpIdentity.permissions.includes('room.attendance')");
    expect(homeSource).toContain('{canUseRoomQr ? (');
  });

  it('registers both authenticated ecosystem screens', () => {
    expect(navigatorSource).toContain('name="MyTickets" component={MyTicketsScreen}');
    expect(navigatorSource).toContain('name="RoomQr" component={RoomQrScreen}');
  });
});
