import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {checkStreamAvailability} from '../src/utils/api';

describe('stream availability probe', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('shares an in-flight probe between the phone and car catalogs', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const url = 'https://stream.radiotedu.com/en';
    // Resolve all requests so a failing baseline does not leave pending timers.
    const completions: Array<(response: Response) => void> = [];
    fetchMock.mockImplementation(() => new Promise<Response>(resolve => {
      completions.push(resolve);
    }));
    const phone = checkStreamAvailability(url);
    const car = checkStreamAvailability(url);
    const refresh = checkStreamAvailability(url);
    const response = {status: 200, headers: {get: () => 'audio/mpeg'}} as unknown as Response;
    completions.forEach(resolve => resolve(response));
    await expect(Promise.all([phone, car, refresh])).resolves.toEqual([true, true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('checks again after a stopped stream becomes available', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({status: 404, headers: {get: () => 'text/plain'}} as unknown as Response)
      .mockResolvedValueOnce({status: 200, headers: {get: () => 'audio/mpeg'}} as unknown as Response);
    const url = 'https://stream.radiotedu.com/fr';
    await expect(checkStreamAvailability(url)).resolves.toBe(false);
    await expect(checkStreamAvailability(url)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a transient connection failure once', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('Temporary connection failure'))
      .mockResolvedValueOnce({status: 200, headers: {get: () => 'audio/mpeg'}} as unknown as Response);
    await expect(checkStreamAvailability('https://stream.radiotedu.com/en')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bounds the shared request to two five-second attempts', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((_url, options) =>
      new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
      }),
    );
    const phone = checkStreamAvailability('https://stream.radiotedu.com/spark');
    const car = checkStreamAvailability('https://stream.radiotedu.com/spark');
    await jest.advanceTimersByTimeAsync(10000);
    await expect(Promise.all([phone, car])).resolves.toEqual([false, false]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
