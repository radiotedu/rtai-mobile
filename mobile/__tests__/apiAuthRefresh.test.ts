import {beforeEach, describe, expect, it, jest} from '@jest/globals';

jest.mock('axios', () => {
  const mockedAxios: any = {};
  const instance = Object.assign(jest.fn(), {
    interceptors: {
      request: {use: jest.fn()},
      response: {
        use: jest.fn((_success, error) => {
          mockedAxios.responseErrorHandler = error;
        }),
      },
    },
  });
  mockedAxios.create = jest.fn(() => instance);
  mockedAxios.instance = instance;
  mockedAxios.isAxiosError = jest.fn(
    (error: any) => error?.isAxiosError === true,
  );
  mockedAxios.post = jest.fn();
  return {__esModule: true, default: mockedAxios};
});

jest.mock('../src/services/authTokenStorage', () => ({
  clearAuthTokensIfCurrent: jest.fn(),
  getAccessToken: jest.fn(),
  getAuthTokenSnapshot: jest.fn(),
  updateAccessToken: jest.fn(),
}));

jest.mock('../src/services/authSessionEvents', () => ({
  notifyAuthSessionChanged: jest.fn(),
}));

import axios from 'axios';
import {notifyAuthSessionChanged} from '../src/services/authSessionEvents';
import {
  clearAuthTokensIfCurrent,
  getAccessToken,
  getAuthTokenSnapshot,
  updateAccessToken,
} from '../src/services/authTokenStorage';
import '../src/services/api';

const mockedAxios = axios as any;
const apiInstance = mockedAxios.instance as any;
const responseErrorHandler = () =>
  mockedAxios.responseErrorHandler as (error: any) => Promise<unknown>;
const getAccessTokenMock = getAccessToken as jest.MockedFunction<
  typeof getAccessToken
>;
const getAuthTokenSnapshotMock =
  getAuthTokenSnapshot as jest.MockedFunction<typeof getAuthTokenSnapshot>;
const updateAccessTokenMock = updateAccessToken as jest.MockedFunction<
  typeof updateAccessToken
>;
const clearAuthTokensIfCurrentMock =
  clearAuthTokensIfCurrent as jest.MockedFunction<
    typeof clearAuthTokensIfCurrent
  >;
const notifyAuthSessionChangedMock =
  notifyAuthSessionChanged as jest.MockedFunction<
    typeof notifyAuthSessionChanged
  >;

function unauthorizedRequest(path = '/protected') {
  return {
    config: {url: path, headers: {}},
    isAxiosError: true,
    response: {status: 401},
  };
}

describe('configured API auth refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAccessTokenMock.mockResolvedValue('expired-access');
    getAuthTokenSnapshotMock.mockResolvedValue({
      accessToken: 'expired-access',
      refreshToken: 'refresh-1',
      generation: 1,
    });
    updateAccessTokenMock.mockResolvedValue(true);
    clearAuthTokensIfCurrentMock.mockResolvedValue(true);
    apiInstance.mockResolvedValue({data: {ok: true}});
  });

  it('shares one refresh request across concurrent 401 responses', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        data: {
          access_token: 'access-2',
          refresh_token: 'refresh-2',
        },
      },
    });

    const first = responseErrorHandler()(unauthorizedRequest('/first'));
    const second = responseErrorHandler()(unauthorizedRequest('/second'));
    await Promise.all([first, second]);

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(updateAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(notifyAuthSessionChangedMock).toHaveBeenCalledTimes(1);
    expect(apiInstance).toHaveBeenCalledTimes(2);
    expect(apiInstance.mock.calls[0][0].headers.Authorization).toBe(
      'Bearer access-2',
    );
    expect(apiInstance.mock.calls[1][0].headers.Authorization).toBe(
      'Bearer access-2',
    );
  });

  it('preserves stored credentials when refresh fails offline or with 5xx', async () => {
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: {status: 503},
    });

    await expect(
      responseErrorHandler()(unauthorizedRequest()),
    ).rejects.toEqual(expect.objectContaining({response: {status: 503}}));

    expect(clearAuthTokensIfCurrentMock).not.toHaveBeenCalled();
    expect(notifyAuthSessionChangedMock).not.toHaveBeenCalled();
  });

  it('clears only the rejected token generation after a definitive 401', async () => {
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: {status: 401},
    });

    await expect(
      responseErrorHandler()(unauthorizedRequest()),
    ).rejects.toEqual(expect.objectContaining({response: {status: 401}}));

    expect(clearAuthTokensIfCurrentMock).toHaveBeenCalledWith(
      expect.objectContaining({refreshToken: 'refresh-1', generation: 1}),
    );
    expect(notifyAuthSessionChangedMock).toHaveBeenCalledTimes(1);
  });
});
