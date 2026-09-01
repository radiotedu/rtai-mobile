import {describe, expect, it} from '@jest/globals';
import {parseTrackPlayerMetadataEvent} from '../src/services/streamMetadata';

describe('Icecast stream metadata', () => {
  it('parses legacy ICY title and artist fields', () => {
    expect(parseTrackPlayerMetadataEvent({title: 'Song', artist: 'Artist'})).toEqual({
      title: 'Song',
      artist: 'Artist',
    });
  });

  it('parses StreamTitle from timed Icecast metadata', () => {
    expect(
      parseTrackPlayerMetadataEvent({
        metadata: [
          {
            raw: [{key: 'StreamTitle', value: "StreamTitle='Artist - Song';"}],
          },
        ],
      }),
    ).toEqual({title: 'Song', artist: 'Artist'});
  });

  it('identifies and formats jingles and station identifiers cleanly', () => {
    expect(parseTrackPlayerMetadataEvent({title: 'TEDU_4'})).toEqual({
      title: 'RadioTEDU Jingle',
      artist: 'RadioTEDU',
      isJingle: true,
    });
    expect(parseTrackPlayerMetadataEvent({title: 'RadioTEDU ID - Station Sweeper'})).toEqual({
      title: 'RadioTEDU Jingle',
      artist: 'RadioTEDU',
      isJingle: true,
    });
  });
});
