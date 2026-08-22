import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';
import {appCopy, missingAppCopyKeys} from '../src/i18n/appCopy';
import {authCopy, screenCopy} from '../src/i18n/screenCopy';

const languages = ['en', 'tr', 'ru', 'ar', 'de', 'fr'];

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('six-language source audit fixes', () => {
  it('keeps every app-copy key complete across supported languages', () => {
    for (const language of languages) {
      expect(missingAppCopyKeys(language as 'en' | 'tr' | 'ru' | 'ar' | 'de' | 'fr')).toEqual([]);
    }
  });

  it('ships every newly used copy key in all supported languages', () => {
    const appKeys = [
      'common.back',
      'avatar.title',
      'avatar.slot.hair',
      'avatar.loadError',
      'avatar.pointsCost',
      'juke.songSkippedTitle',
      'juke.connectFirst',
      'juke.guestLimitText',
      'juke.addedBy',
      'juke.deviceConnectionError',
      'player.previous',
      'player.play',
      'player.pause',
      'player.next',
      'player.flacDescription',
      'votePanel.seconds',
    ];
    const authKeys = ['login.requestError', 'login.resetSubject', 'register.requestError'];
    const screenKeys = ['radio.live', 'study.kicker', 'profile.lastSyncFailed'];

    for (const language of languages) {
      for (const key of appKeys) {
        const value = appCopy(language, key, {name: 'Alex', points: 10, seconds: 9});
        expect(value).not.toBe(key);
        expect(value).not.toContain('Cazz');
      }
      for (const key of authKeys) {
        expect(authCopy(language, key)).not.toBe(key);
      }
      for (const key of screenKeys) {
        expect(screenCopy(language, key)).not.toBe(key);
      }
      const locale = JSON.parse(readSource(`src/i18n/locales/${language}.json`));
      expect(locale.focus.jazz).toBeTruthy();
      expect(locale.focus.classic).toBeTruthy();
      expect(locale.focus.lofi).toBeTruthy();
    }
  });

  it('routes Jukebox and avatar UI through locale copy', () => {
    const jukebox = readSource('src/screens/jukebox/JukeboxScreen.tsx');
    const avatar = readSource('src/screens/study/AvatarClosetScreen.tsx');

    expect(jukebox).toContain("copy('juke.songSkippedTitle')");
    expect(jukebox).toContain("copy('juke.addedBy'");
    expect(jukebox).not.toMatch(/Şarkı Geçildi|Limit Asildi|Cihaza bağlanılamadı|error\.response\?\.data\?\.error \|\|/);
    expect(avatar).toContain("copy('avatar.title')");
    expect(avatar).toContain('copy(slot.titleKey)');
    expect(avatar).not.toMatch(/>Avatar Closet<|>Global points<|>spendable_points<|>No clothes in this slot yet\.</);
  });

  it('uses locale-aware labels, time, units, and generic errors', () => {
    const player = readSource('src/screens/PlayerScreen.tsx');
    const radio = readSource('src/screens/RadioScreen.tsx');
    const votePanel = readSource('src/screens/next-song-vote/NextSongVotePanel.tsx');
    const login = readSource('src/screens/auth/LoginScreen.tsx');
    const register = readSource('src/screens/auth/RegisterScreen.tsx');
    const market = readSource('src/screens/MarketScreen.tsx');

    expect(player).toContain("copy('player.previous')");
    expect(player).not.toMatch(/accessibilityLabel="Önceki"|accessibilityLabel="Sonraki"/);
    expect(radio).toContain("copy('radio.live')");
    expect(radio).not.toContain("toLocaleTimeString('tr-TR'");
    expect(votePanel).toContain("copy('votePanel.seconds'");
    expect(login).toContain("copy('login.resetSubject')");
    expect(login).not.toContain("Alert.alert(copy('login.errorTitle'), error.message)");
    expect(register).not.toContain("Alert.alert(copy('register.genericError'), error.message)");
    expect(market).not.toContain("error?.response?.data?.error || copy('market.error')");
  });
});
