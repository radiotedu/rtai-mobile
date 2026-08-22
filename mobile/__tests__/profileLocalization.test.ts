import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';
import {screenCopy} from '../src/i18n/screenCopy';

const languages = ['en', 'tr', 'ru', 'ar', 'de', 'fr'];

describe('Profile and Leaderboard localization', () => {
  const profileSource = fs.readFileSync(
    path.join(__dirname, '../src/screens/ProfileScreen.tsx'),
    'utf8',
  );
  const leaderboardSource = fs.readFileSync(
    path.join(__dirname, '../src/screens/LeaderboardScreen.tsx'),
    'utf8',
  );

  it('ships localized copy for dynamic profile and leaderboard controls', () => {
    const keys = [
      'profile.notificationsReady',
      'profile.feedCreated',
      'profile.deleteDataText',
      'profile.readinessTitle',
      'profile.status.permissionRequired',
      'profile.notification.jukebox',
      'profile.appSection',
      'leaderboard.category.listening',
      'leaderboard.category.games',
    ];

    for (const language of languages) {
      for (const key of keys) {
        expect(screenCopy(language, key)).not.toBe(key);
      }
      expect(screenCopy(language, 'profile.notification.jukebox')).toBe('Jukebox');
    }
  });

  it('uses local initials instead of sending names to avatar placeholder services', () => {
    expect(profileSource).toContain('getInitials(');
    expect(leaderboardSource).toContain('getLeaderboardInitials(');
    expect(profileSource).not.toContain('ui-avatars.com');
    expect(leaderboardSource).not.toContain('ui-avatars.com');
  });

  it('routes previously hardcoded user-facing text through copy keys', () => {
    expect(profileSource).toContain("copy('profile.headlineEmpty')");
    expect(profileSource).toContain("copy('profile.notSelected')");
    expect(profileSource).toContain("copy('profile.feedDeleteQuestion'");
    expect(profileSource).not.toContain("'Not selected'");
    expect(profileSource).not.toContain('Published Android readiness</Text>');
    expect(leaderboardSource).toContain("key: 'leaderboard.category.jukebox'");
  });
});
