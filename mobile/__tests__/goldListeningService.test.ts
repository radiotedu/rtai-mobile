import {beforeEach, describe, expect, it, jest} from '@jest/globals';

import api from '../src/services/api';
import {
  createListeningClientSessionId,
  extractServerGoldBalance,
  heartbeatVerifiedListening,
  radioChannelForTrack,
  startVerifiedListening,
} from '../src/services/goldListeningService';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {post: jest.fn()},
}));

describe('verified Gold listening service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps only RadioTEDU live streams to server-approved channel ids', () => {
    expect(radioChannelForTrack({id: 'radiotedu-main', url: 'https://stream.radiotedu.com/radio'})).toBe('radio');
    expect(radioChannelForTrack({id: 'radiotedu-jazz', url: 'https://stream.radiotedu.com/cazz'})).toBe('jazz');
    expect(radioChannelForTrack({id: 'radiotedu-energize', url: 'https://stream.radiotedu.com/energize'})).toBe('energize');
    expect(radioChannelForTrack({id: 'radiotedu-rock', url: 'https://stream.radiotedu.com/rock'})).toBe('rock');
    expect(radioChannelForTrack({url: 'https://stream.radiotedu.com/cazz-flac'})).toBe('jazz');
    expect(radioChannelForTrack({url: 'https://stream.radiotedu.com/radio-high'})).toBe('radio');
    expect(radioChannelForTrack({url: 'https://stream.radiotedu.com/en-high'})).toBe('en');
    expect(radioChannelForTrack({url: 'https://stream.radiotedu.com/fr-flac'})).toBe('fr');
    expect(radioChannelForTrack({url: 'https://stream.radiotedu.com/it'})).toBe('it');
    expect(radioChannelForTrack({url: 'https://stream.radiotedu.com/ru-normal'})).toBe('ru');
    expect(radioChannelForTrack({url: 'https://stream.radiotedu.com/ar-high'})).toBe('ar');
    expect(radioChannelForTrack({url: 'https://stream.radiotedu.com/de'})).toBe('de');
    expect(radioChannelForTrack({url: 'https://stream.radiotedu.com/tr-low'})).toBe('tr');
    expect(radioChannelForTrack({url: 'https://stream.radiotedu.com/jp-flac'})).toBe('jp');
    expect(radioChannelForTrack({url: 'https://example.com/radio'})).toBeNull();
    expect(radioChannelForTrack({url: 'http://stream.radiotedu.com/radio'})).toBeNull();
    expect(radioChannelForTrack({url: 'https://stream.radiotedu.com.evil.example/radio'})).toBeNull();
    expect(radioChannelForTrack({url: 'https://stream.radiotedu.com/radio/other'})).toBeNull();
    expect(radioChannelForTrack({id: 'radiotedu-main', url: 'https://stream.radiotedu.com/rock'})).toBeNull();
    expect(radioChannelForTrack({id: 'podcast-1'})).toBeNull();
  });

  it('accepts a displayed balance only from a valid server reward response', () => {
    expect(extractServerGoldBalance({spendablePoints: 125})).toBe(125);
    expect(extractServerGoldBalance({spendable_points: 126})).toBe(126);
    expect(extractServerGoldBalance({points: {spendable_points: 127}})).toBe(127);
    expect(extractServerGoldBalance({spendablePoints: -1})).toBeNull();
    expect(extractServerGoldBalance({spendablePoints: 1.5})).toBeNull();
    expect(extractServerGoldBalance(null)).toBeNull();
  });

  it('creates server-safe, per-playback client session ids', () => {
    const id = createListeningClientSessionId(1_786_440_000_000, 0.42);
    expect(id).toMatch(/^mobile:[a-z0-9]+:[a-z0-9]+$/);
    expect(id.length).toBeLessThan(128);
  });

  it('starts the rotating-nonce listening protocol', async () => {
    const post = api.post as jest.MockedFunction<(path: string, body: unknown) => Promise<any>>;
    post.mockResolvedValueOnce({
      data: {data: {session: {id: 'session-1'}, nonce: 'nonce-1', heartbeat_after_seconds: 25}},
    });

    await startVerifiedListening('radio', 'mobile:session:1');
    expect(post).toHaveBeenCalledWith('/economy/listening/start', {
      channel_id: 'radio',
      client_session_id: 'mobile:session:1',
    });
  });

  it('rotates the one-time nonce and proves active playback on heartbeat', async () => {
    const post = api.post as jest.MockedFunction<(path: string, body: unknown) => Promise<any>>;
    post.mockResolvedValueOnce({data: {data: {session_id: 'session-1', nonce: 'nonce-2'}}});

    await heartbeatVerifiedListening('session-1', 'nonce-1');
    expect(post).toHaveBeenCalledWith('/economy/listening/heartbeat', {
      session_id: 'session-1',
      nonce: 'nonce-1',
      is_playing: true,
    });
  });
});
