import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {checkStreamAvailability} from '../src/utils/api';

describe('stream availability probe', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses HEAD and accepts a live Ogg mount', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      status: 200,
      headers: {get: () => 'audio/ogg'},
    } as unknown as Response);

    await expect(
      checkStreamAvailability('https://stream.radiotedu.com/spark'),
    ).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://stream.radiotedu.com/spark',
      expect.objectContaining({method: 'HEAD'}),
    );
  });

  it('rejects a stopped mount', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      status: 404,
      headers: {get: () => 'text/plain'},
    } as unknown as Response);

    await expect(
      checkStreamAvailability('https://stream.radiotedu.com/en'),
    ).resolves.toBe(false);
  });
});
