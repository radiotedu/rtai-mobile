import React from 'react';
import renderer, {act, ReactTestRenderer} from 'react-test-renderer';
import {LyricsShareModal} from '../src/components/LyricsShareModal';
import {ImageShareContent} from '../src/components/ImageShareSheet';

jest.mock('react-i18next', () => ({useTranslation: () => ({i18n: {language: 'en'}})}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../src/components/ImageShareSheet', () => ({ImageShareContent: 'ImageShareContent'}));

it('retains the opened song during live updates and captures a new song after reopening', async () => {
  const onClose = jest.fn();
  const first = {visible: true, onClose, lyricsLines: ['First invented line', 'Second invented line'],
    trackTitle: 'First song', trackArtist: 'First artist', artworkUrl: 'https://example.org/first.jpg'};
  const next = {...first, lyricsLines: ['New invented line'], trackTitle: 'Next song',
    trackArtist: 'Next artist', artworkUrl: 'https://example.org/next.jpg'};
  let tree: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<LyricsShareModal {...first} />); });
  const data = () => tree!.root.findByType(ImageShareContent).props.data;
  expect(data()).toMatchObject({title: first.trackTitle, artist: first.trackArtist,
    artwork: first.artworkUrl, body: first.lyricsLines.join('\n')});
  await act(async () => { tree!.update(<LyricsShareModal {...next} />); });
  expect(data()).toMatchObject({title: first.trackTitle, artist: first.trackArtist,
    artwork: first.artworkUrl, body: first.lyricsLines.join('\n')});
  await act(async () => { tree!.update(<LyricsShareModal {...next} visible={false} />); });
  expect(tree!.toJSON()).toBeNull();
  await act(async () => { tree!.update(<LyricsShareModal {...next} />); });
  expect(data()).toMatchObject({title: next.trackTitle, artist: next.trackArtist,
    artwork: next.artworkUrl, body: next.lyricsLines.join('\n')});
  await act(async () => { tree!.unmount(); });
});
