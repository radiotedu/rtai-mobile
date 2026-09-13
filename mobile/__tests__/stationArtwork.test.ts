import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {fetchStationArtwork, fetchStationLiveMetadata} from '../src/services/stationArtwork';
import {parseTrackPlayerMetadataEvent} from '../src/services/streamMetadata';

afterEach(() => {jest.restoreAllMocks();});
const result = (overrides = {}) => ({station_id: 'radiotedu-main', track: 'Test song', artist: 'Test artist',
  artwork_url: 'https://images.example/cover.jpg', ...overrides});
const reply = (data: unknown) => jest.spyOn(global, 'fetch').mockResolvedValue({ok: true, json: async () => data} as Response);

describe('station artwork enrichment', () => {
  it('does not display unrelated album art returned for a station jingle', async () => {
    reply(result({online: true, track: 'TEDU_4'}));
    expect(await fetchStationLiveMetadata('radiotedu-main')).toEqual({
      title: 'RadioTEDU Jingle', artist: 'RadioTEDU', artwork: '',
    });
    expect(parseTrackPlayerMetadataEvent({title: 'TEDU_4', artwork: 'https://images.example/wrong.jpg'}))
      .toEqual({title: 'RadioTEDU Jingle', artist: 'RadioTEDU', isJingle: true});
  });
  it('preserves actual song artwork from live polling', async () => {
    reply(result({online: true}));
    expect(await fetchStationLiveMetadata('radiotedu-main')).toEqual({
      title: 'Test song', artist: 'Test artist', artwork: 'https://images.example/cover.jpg',
    });
  });
  it('fills missing artist and cover for the same broadcast title', async () => {
    reply(result());
    expect(await fetchStationArtwork('radiotedu-main', 'Test song (Album)'))
      .toEqual({artist: 'Test artist', artwork: 'https://images.example/cover.jpg'});
  });
  it.each([
    {station_id: 'radiotedu-rock'}, {track: 'Next song'}, {artist: 'Another artist'},
    {artwork_url: 'http://images.example/cover.jpg'}, {artist: ''},
  ])('rejects mismatched or unsafe enrichment: %j', async overrides => {
    reply(result(overrides));
    expect(await fetchStationArtwork('radiotedu-main', 'Test song', 'Test artist')).toBeNull();
  });
  it('leaves fallback artwork available when the service fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Offline'));
    expect(await fetchStationArtwork('radiotedu-main', 'Test song')).toBeNull();
  });
});
