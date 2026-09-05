import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {fetchStationArtwork} from '../src/services/stationArtwork';

afterEach(() => {jest.restoreAllMocks();});
const result = (overrides = {}) => ({station_id: 'radiotedu-main', track: 'Test song', artist: 'Test artist',
  artwork_url: 'https://images.example/cover.jpg', ...overrides});
const reply = (data: unknown) => jest.spyOn(global, 'fetch').mockResolvedValue({ok: true, json: async () => data} as Response);

describe('station artwork enrichment', () => {
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
