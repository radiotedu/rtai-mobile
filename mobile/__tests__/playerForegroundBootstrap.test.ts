import {describe, expect, it, jest} from '@jest/globals';

import {createRunOnceWhenActive} from '../src/services/playerForegroundBootstrap';

describe('player foreground bootstrap', () => {
  it('recovers the native foreground race without another app switch', async () => {
    jest.useFakeTimers();
    const task = jest.fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('app must be in the foreground'))
      .mockResolvedValueOnce(undefined);
    const runner = createRunOnceWhenActive(task, jest.fn());
    await runner.handleAppStateChange('active');
    await jest.advanceTimersByTimeAsync(250);
    expect(task).toHaveBeenCalledTimes(2);
    runner.cancel();
    jest.useRealTimers();
  });

  it('cancels a pending retry on background and bounds repeated failures', async () => {
    jest.useFakeTimers();
    const task = jest.fn(async () => {throw new Error('foreground required');});
    const runner = createRunOnceWhenActive(task, jest.fn());
    await runner.handleAppStateChange('active');
    runner.handleAppStateChange('background');
    await jest.advanceTimersByTimeAsync(2000);
    expect(task).toHaveBeenCalledTimes(1);
    await runner.handleAppStateChange('active');
    await jest.advanceTimersByTimeAsync(10000);
    expect(task).toHaveBeenCalledTimes(5);
    runner.cancel();
    jest.useRealTimers();
  });
  it('waits for foreground and runs a successful task only once', async () => {
    const task = jest.fn(async () => undefined);
    const onError = jest.fn();
    const runner = createRunOnceWhenActive(task, onError);

    runner.handleAppStateChange('background');
    expect(task).not.toHaveBeenCalled();

    await runner.handleAppStateChange('active');
    runner.handleAppStateChange('active');

    expect(task).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('retries on a later foreground transition after a failed attempt', async () => {
    const task = jest
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('not foreground yet'))
      .mockResolvedValueOnce(undefined);
    const onError = jest.fn();
    const runner = createRunOnceWhenActive(task, onError);

    await runner.handleAppStateChange('active');
    expect(onError).toHaveBeenCalledTimes(1);

    runner.handleAppStateChange('background');
    await runner.handleAppStateChange('active');

    expect(task).toHaveBeenCalledTimes(2);
  });

  it('does not start after cancellation', () => {
    const task = jest.fn(async () => undefined);
    const runner = createRunOnceWhenActive(task, jest.fn());

    runner.cancel();
    runner.handleAppStateChange('active');

    expect(task).not.toHaveBeenCalled();
  });
});
