import {describe, expect, it, jest} from '@jest/globals';

import {
  createLatestRefreshCoordinator,
  resolveStableWebViewSession,
  type WebViewCredentialSnapshot,
} from '../src/services/webViewSessionRefreshCoordinator';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(next => {
    resolve = next;
  });
  return {promise, resolve};
};

const flush = () => new Promise<void>(resolve => setImmediate(resolve));

describe('WebView session refresh coordinator', () => {
  it('runs one refresh at a time and applies only the newest request', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const applied: string[] = [];
    let calls = 0;
    let active = 0;
    let maxActive = 0;
    const coordinator = createLatestRefreshCoordinator<string, string>({
      resolve: async () => {
        const current = calls++ === 0 ? first : second;
        active += 1;
        maxActive = Math.max(maxActive, active);
        const value = await current.promise;
        active -= 1;
        return value;
      },
      apply: value => applied.push(value),
    });

    const firstRun = coordinator.requestRefresh('first');
    await flush();
    const secondRun = coordinator.requestRefresh('second');
    first.resolve('stale-user-a');
    await flush();
    expect(calls).toBe(2);
    second.resolve('current-user-b');
    await Promise.all([firstRun, secondRun]);

    expect(maxActive).toBe(1);
    expect(applied).toEqual(['current-user-b']);
  });

  it('ignores an in-flight result after cleanup', async () => {
    const pending = deferred<string>();
    const apply = jest.fn<(value: string) => void>();
    const coordinator = createLatestRefreshCoordinator<void, string>({
      resolve: () => pending.promise,
      apply,
    });

    const run = coordinator.requestRefresh();
    coordinator.dispose();
    pending.resolve('must-not-apply');
    await run;

    expect(apply).not.toHaveBeenCalled();
  });

  it('refreshes only when AppState becomes active', async () => {
    const pending = deferred<string>();
    const apply = jest.fn<(value: string) => void>();
    const resolve = jest.fn(() => pending.promise);
    const coordinator = createLatestRefreshCoordinator<void, string>({
      resolve,
      apply,
    });

    await coordinator.handleAppStateChange('background', undefined);
    expect(resolve).not.toHaveBeenCalled();

    const activeRun = coordinator.handleAppStateChange('active', undefined);
    await flush();
    expect(resolve).toHaveBeenCalledTimes(1);
    pending.resolve('fresh');
    await activeRun;
    expect(apply).toHaveBeenCalledWith('fresh');
  });

  it('turns a logout during verification into empty auth', async () => {
    type TestUser = {id: string; is_guest: boolean};
    const refresh = deferred<TestUser | null>();
    let credential: WebViewCredentialSnapshot | null = {
      accessToken: 'test-token-a',
      generation: 1,
    };
    let currentUser: TestUser | null = {id: 'user-a', is_guest: false};
    const resultPromise = resolveStableWebViewSession({
      readCredential: async () => credential,
      refreshUser: () => refresh.promise,
      getCurrentUser: () => currentUser,
      isEligibleUser: user => !user.is_guest,
    });

    await flush();
    credential = null;
    currentUser = null;
    refresh.resolve({id: 'user-a', is_guest: false});

    await expect(resultPromise).resolves.toEqual({
      accessToken: null,
      user: null,
    });
  });

  it('retries when credentials change and never pairs user A with token B', async () => {
    type TestUser = {id: string; is_guest: boolean};
    const firstRefresh = deferred<TestUser | null>();
    let credential: WebViewCredentialSnapshot | null = {
      accessToken: 'test-token-a',
      generation: 1,
    };
    let currentUser: TestUser | null = {id: 'user-a', is_guest: false};
    let refreshCalls = 0;
    const resultPromise = resolveStableWebViewSession({
      readCredential: async () => credential,
      refreshUser: async () => {
        refreshCalls += 1;
        return refreshCalls === 1 ? firstRefresh.promise : currentUser;
      },
      getCurrentUser: () => currentUser,
      isEligibleUser: user => !user.is_guest,
    });

    await flush();
    credential = {accessToken: 'test-token-b', generation: 2};
    currentUser = {id: 'user-b', is_guest: false};
    firstRefresh.resolve({id: 'user-a', is_guest: false});

    await expect(resultPromise).resolves.toEqual({
      accessToken: 'test-token-b',
      user: {id: 'user-b', is_guest: false},
    });
    expect(refreshCalls).toBe(2);
  });
});
