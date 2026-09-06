import {Share} from 'react-native';

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

    const shareMessage = `“${selectedLines.join('\n')}”\n\n🎵 ${trackTitle} — ${trackArtist}\n📻 RadioTEDU dinliyorum: https://radiotedu.com`;

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
});
