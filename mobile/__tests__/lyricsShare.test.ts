import {Share} from 'react-native';
import {appCopy} from '../src/i18n/appCopy';

describe('LyricsShare logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('formats lyrics quote card message correctly for social sharing', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({action: 'sharedAction'});

    const trackTitle = 'Take Five';
    const trackArtist = 'The Dave Brubeck Quartet';
    const selectedLines = [
      'Won\'t you stop and take',
      'A little time out with me',
    ];

    const shareMessage = `“${selectedLines.join('\n')}”\n\n🎵 ${trackTitle} — ${trackArtist}\n📻 ${appCopy('tr', 'lyrics.listeningOn', {station: 'RadioTEDU'})}`;

    await Share.share({
      title: `${trackTitle} - ${trackArtist} (RadioTEDU)`,
      message: shareMessage,
    });

    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(shareSpy).toHaveBeenCalledWith({
      title: 'Take Five - The Dave Brubeck Quartet (RadioTEDU)',
      message: expect.stringContaining('Take Five'),
    });
    expect(shareMessage).toContain('RadioTEDU dinliyorum: https://radiotedu.com');
    expect(shareMessage).toContain('Won\'t you stop and take');
  });

  test('localizes lyrics share headers, actions, and messages across all supported languages', () => {
    const languages = ['en', 'tr', 'ru', 'ar', 'de', 'fr'] as const;

    for (const lang of languages) {
      const header = appCopy(lang, 'lyrics.shareHeader');
      const title = appCopy(lang, 'lyrics.shareTitle');
      const selectLines = appCopy(lang, 'lyrics.selectLines');
      const storyAction = appCopy(lang, 'lyrics.shareStory');
      const listening = appCopy(lang, 'lyrics.listeningOn', {station: 'RadioTEDU'});

      expect(header).toBeTruthy();
      expect(header).not.toBe('lyrics.shareHeader');
      expect(title).toBeTruthy();
      expect(title).not.toBe('lyrics.shareTitle');
      expect(selectLines).toBeTruthy();
      expect(selectLines).not.toBe('lyrics.selectLines');
      expect(storyAction).toBeTruthy();
      expect(storyAction).not.toBe('lyrics.shareStory');
      expect(listening).toContain('RadioTEDU');
      expect(listening).toContain('https://radiotedu.com');
    }

    expect(appCopy('en', 'lyrics.shareHeader')).toBe('Share');
    expect(appCopy('tr', 'lyrics.shareHeader')).toBe('Paylaş');
    expect(appCopy('de', 'lyrics.shareHeader')).toBe('Teilen');
    expect(appCopy('fr', 'lyrics.shareHeader')).toBe('Partager');
    expect(appCopy('ru', 'lyrics.shareHeader')).toBe('Поделиться');
    expect(appCopy('ar', 'lyrics.shareHeader')).toBe('مشاركة');
  });

  test('localizes listening recap share across all supported languages', () => {
    const languages = ['en', 'tr', 'ru', 'ar', 'de', 'fr'] as const;

    for (const lang of languages) {
      const shareBtn = appCopy(lang, 'stats.share');
      const recapTitle = appCopy(lang, 'stats.recapTitle');
      const msg = appCopy(lang, 'stats.shareMessage', {
        time: '45 min',
        genre: 'Jazz',
        peak: 'Gece Kuşu',
      });

      expect(shareBtn).toBeTruthy();
      expect(shareBtn).not.toBe('stats.share');
      expect(recapTitle).toBeTruthy();
      expect(recapTitle).not.toBe('stats.recapTitle');
      expect(msg).toContain('45 min');
      expect(msg).toContain('Jazz');
      expect(msg).toContain('https://radiotedu.com');
    }

    expect(appCopy('en', 'stats.share')).toBe('Share My Recap');
    expect(appCopy('tr', 'stats.share')).toBe('Özetimi Paylaş');
    expect(appCopy('de', 'stats.share')).toBe('Statistik teilen');
    expect(appCopy('fr', 'stats.share')).toBe('Partager mon bilan');
    expect(appCopy('ru', 'stats.share')).toBe('Поделиться итогами');
    expect(appCopy('ar', 'stats.share')).toBe('مشاركة ملخصي');
  });
});
