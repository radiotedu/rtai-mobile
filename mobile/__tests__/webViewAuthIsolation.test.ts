import {describe, expect, it, jest} from '@jest/globals';

import {
  buildJukeLocalAuthInjection,
} from '../src/services/jukeLocalWebViewService';
import {
  createStudyAuthClearInjection,
  createStudyWebViewBridge,
} from '../src/services/studyWebViewService';
import {buildWebViewAccountBridge} from '../src/services/webViewAccountBridge';

class RuntimeHeaders {
  private readonly values = new Map<string, string>();

  constructor(initial?: unknown) {
    if (initial instanceof RuntimeHeaders) {
      initial.forEach((value, name) => this.set(name, value));
    } else if (initial && typeof initial === 'object') {
      Object.entries(initial as Record<string, unknown>).forEach(
        ([name, value]) => this.set(name, String(value)),
      );
    }
  }

  set(name: string, value: string) {
    this.values.set(name.toLowerCase(), value);
  }

  get(name: string) {
    return this.values.get(name.toLowerCase()) ?? null;
  }

  forEach(callback: (value: string, name: string) => void) {
    this.values.forEach((value, name) => callback(value, name));
  }
}

class RuntimeURL extends URL {}

class RuntimeStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

class RuntimeCustomEvent {
  constructor(
    public readonly type: string,
    public readonly init?: {detail?: unknown},
  ) {}
}

function createRuntime(pathname: string) {
  const nativeFetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({data: {}}),
  }));
  const runtimeWindow: any = {
    fetch: nativeFetch,
    Headers: RuntimeHeaders,
    URL: RuntimeURL,
    location: {
      href: `https://radiotedu.com${pathname}`,
      origin: 'https://radiotedu.com',
      protocol: 'https:',
      hostname: 'radiotedu.com',
      port: '',
      pathname,
    },
    localStorage: new RuntimeStorage(),
    dispatchEvent: jest.fn(),
  };
  return {nativeFetch, runtimeWindow};
}

function execute(script: string, runtimeWindow: any) {
  // Generated WebView bootstrap code must be exercised in an isolated mock realm.
  // eslint-disable-next-line no-new-func
  const run = new Function('window', 'CustomEvent', 'Storage', script);
  run(runtimeWindow, RuntimeCustomEvent, RuntimeStorage);
}

function lastAuthorization(nativeFetch: ReturnType<typeof jest.fn>) {
  const calls = nativeFetch.mock.calls as unknown as Array<[unknown, any]>;
  const options = calls[calls.length - 1]?.[1];
  return options?.headers instanceof RuntimeHeaders
    ? options.headers.get('Authorization')
    : undefined;
}

const studyInput = (accessToken: string) => ({
  account: {id: 'user-1', displayName: 'Ada', authenticated: true},
  globalPoints: 42,
  apiBase: 'https://radiotedu.com/jukebox/api/v1',
  accessToken,
});

describe('WebView bearer isolation', () => {
  it('keeps generic bearer state in a refreshable closure and clears old wrappers', async () => {
    const {nativeFetch, runtimeWindow} = createRuntime('/vote/');
    execute(
      buildWebViewAccountBridge(
        {
          accessToken: 'first-secret',
          user: {
            id: 'user-1',
            display_name: 'Ada',
            avatar_url: 'https://radiotedu.com/avatar.png',
            email: 'private@example.test',
          },
        },
        ['/jukebox/api/v1/'],
      ),
      runtimeWindow,
    );

    const retainedWrapper = runtimeWindow.fetch;
    expect(runtimeWindow.__RADIOTEDU_NATIVE_AUTH__).toEqual({
      authenticated: true,
      user: {
        id: 'user-1',
        display_name: 'Ada',
        avatar_url: 'https://radiotedu.com/avatar.png',
      },
    });
    expect(runtimeWindow.__RADIOTEDU_NATIVE_AUTH__.accessToken).toBeUndefined();
    expect(
      Object.getOwnPropertyDescriptor(
        runtimeWindow,
        '__RADIOTEDU_UPDATE_NATIVE_AUTH__',
      ),
    ).toMatchObject({configurable: false, writable: false});

    await retainedWrapper(
      'https://radiotedu.com/jukebox/api/v1/voting/round',
    );
    expect(lastAuthorization(nativeFetch)).toBe('Bearer first-secret');

    await retainedWrapper(
      'https://evil.example/?next=/jukebox/api/v1/voting/round',
    );
    expect(lastAuthorization(nativeFetch)).toBeUndefined();

    execute(
      buildWebViewAccountBridge(
        {accessToken: 'second-secret', user: {id: 'user-1'}},
        ['/jukebox/api/v1/'],
      ),
      runtimeWindow,
    );
    await retainedWrapper(
      'https://radiotedu.com/jukebox/api/v1/voting/round',
    );
    expect(lastAuthorization(nativeFetch)).toBe('Bearer second-secret');

    execute(
      buildWebViewAccountBridge({accessToken: null, user: null}, [
        '/jukebox/api/v1/',
      ]),
      runtimeWindow,
    );
    await retainedWrapper(
      'https://radiotedu.com/jukebox/api/v1/voting/round',
    );
    expect(lastAuthorization(nativeFetch)).toBeUndefined();
    expect(runtimeWindow.__RADIOTEDU_NATIVE_AUTH__).toEqual({
      authenticated: false,
      user: null,
    });
  });

  it('keeps Study bearer state out of globals and invalidates retained wrappers', async () => {
    const {nativeFetch, runtimeWindow} = createRuntime('/study/');
    execute(createStudyWebViewBridge(studyInput('first-study-secret')), runtimeWindow);

    const retainedWrapper = runtimeWindow.fetch;
    expect(runtimeWindow.__RADIOTEDU_STUDY_ACCESS_TOKEN__).toBeUndefined();
    expect(runtimeWindow.RadioTEDUStudyBridge.accessToken).toBeUndefined();
    expect(
      Object.getOwnPropertyDescriptor(
        runtimeWindow,
        '__RADIOTEDU_UPDATE_STUDY_AUTH__',
      ),
    ).toMatchObject({configurable: false, writable: false});

    await retainedWrapper(
      'https://radiotedu.com/jukebox/api/v1/study/session',
    );
    expect(lastAuthorization(nativeFetch)).toBe('Bearer first-study-secret');

    await retainedWrapper(
      'https://evil.example/?next=/jukebox/api/v1/study/session',
    );
    expect(lastAuthorization(nativeFetch)).toBeUndefined();

    execute(createStudyWebViewBridge(studyInput('second-study-secret')), runtimeWindow);
    await retainedWrapper(
      'https://radiotedu.com/jukebox/api/v1/study/session',
    );
    expect(lastAuthorization(nativeFetch)).toBe('Bearer second-study-secret');

    execute(createStudyAuthClearInjection(), runtimeWindow);
    await retainedWrapper(
      'https://radiotedu.com/jukebox/api/v1/study/session',
    );
    expect(lastAuthorization(nativeFetch)).toBeUndefined();
    expect(runtimeWindow.RadioTEDUStudyAccount).toBeNull();
    expect(runtimeWindow.RadioTEDUStudyBridge).toBeNull();
  });

  it('limits Juke raw compatibility state to the exact controller route', () => {
    const untrusted = createRuntime('/juke-local/kiosk/').runtimeWindow;
    execute(
      buildJukeLocalAuthInjection({
        accessToken: 'juke-secret',
        user: {
          id: 'user-1',
          display_name: 'Ada',
          email: 'private@example.test',
          role: 'admin',
        },
      }),
      untrusted,
    );
    expect(untrusted.__RADIOTEDU_EPHEMERAL_TOKEN__).toBeUndefined();
    expect(untrusted.__RADIOTEDU_NATIVE_AUTH__.accessToken).toBeUndefined();

    const trusted = createRuntime('/juke-local/controller/').runtimeWindow;
    execute(
      buildJukeLocalAuthInjection({
        accessToken: 'juke-secret',
        user: {
          id: 'user-1',
          display_name: 'Ada',
          email: 'private@example.test',
          role: 'admin',
        },
      }),
      trusted,
    );
    expect(trusted.__RADIOTEDU_EPHEMERAL_TOKEN__).toBe('juke-secret');
    expect(trusted.__RADIOTEDU_NATIVE_AUTH__.accessToken).toBe('juke-secret');
    expect(trusted.__RADIOTEDU_NATIVE_AUTH__.user).toEqual({
      id: 'user-1',
      display_name: 'Ada',
      is_guest: false,
      role: 'listener',
      total_songs_added: 0,
      last_super_vote_at: null,
    });
    expect(trusted.localStorage.getItem('token')).toBe('juke-secret');
    expect(JSON.parse(trusted.localStorage.getItem('user'))).toEqual(
      trusted.__RADIOTEDU_NATIVE_AUTH__.user,
    );
  });
});
