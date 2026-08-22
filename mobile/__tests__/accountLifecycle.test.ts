import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import axios from 'axios';

import {BASE_API} from '../src/services/config';
import {
  buildDeleteAccountPayload,
  buildLogoutPayload,
  deleteAccountAndClearSession,
  logoutAccountSession,
} from '../src/services/accountLifecycleService';
import {
  clearAuthTokens,
  getRefreshToken,
} from '../src/services/authTokenStorage';

jest.mock('../src/services/authTokenStorage', () => ({
  clearAuthTokens: jest.fn(),
  getRefreshToken: jest.fn(),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    post: jest.fn(),
    defaults: {
      headers: {
        common: {},
      },
    },
  },
}));

describe('mobile account lifecycle service', () => {
  const getRefreshTokenMock = getRefreshToken as jest.MockedFunction<
    typeof getRefreshToken
  >;
  const clearAuthTokensMock = clearAuthTokens as jest.MockedFunction<
    typeof clearAuthTokens
  >;
  const postMock = axios.post as jest.MockedFunction<typeof axios.post>;
  const deleteMock = axios.delete as jest.MockedFunction<typeof axios.delete>;

  beforeEach(() => {
    jest.clearAllMocks();
    delete axios.defaults.headers.common.Authorization;
  });

  it('builds the backend logout and account-deletion contracts exactly', () => {
    expect(buildLogoutPayload(' refresh-token ')).toEqual({
      refresh_token: 'refresh-token',
    });
    expect(buildDeleteAccountPayload(' secret ')).toEqual({
      confirmation: 'DELETE',
      password: ' secret ',
    });
    expect(buildDeleteAccountPayload()).toEqual({confirmation: 'DELETE'});
  });

  it('revokes the current refresh-token session before clearing local auth', async () => {
    getRefreshTokenMock.mockResolvedValueOnce('refresh-token');
    postMock.mockResolvedValueOnce({data: {data: {revoked: true}}});
    axios.defaults.headers.common.Authorization = 'Bearer access-token';

    await logoutAccountSession();

    expect(postMock).toHaveBeenCalledWith(`${BASE_API}/auth/logout`, {
      refresh_token: 'refresh-token',
    });
    expect(clearAuthTokensMock).toHaveBeenCalled();
    expect(axios.defaults.headers.common.Authorization).toBeUndefined();
  });

  it('still clears local auth when the server logout request fails', async () => {
    getRefreshTokenMock.mockResolvedValueOnce('refresh-token');
    postMock.mockRejectedValueOnce(new Error('offline'));

    await expect(logoutAccountSession()).rejects.toThrow('offline');

    expect(clearAuthTokensMock).toHaveBeenCalled();
  });

  it('deletes the account through the authenticated endpoint and clears auth on success', async () => {
    deleteMock.mockResolvedValueOnce({data: {data: {deleted: true}}});

    await deleteAccountAndClearSession('correct-password');

    expect(deleteMock).toHaveBeenCalledWith(`${BASE_API}/auth/account`, {
      data: {
        confirmation: 'DELETE',
        password: 'correct-password',
      },
    });
    expect(clearAuthTokensMock).toHaveBeenCalled();
  });

  it('keeps local auth when account deletion is rejected by the server', async () => {
    deleteMock.mockRejectedValueOnce(new Error('wrong password'));

    await expect(deleteAccountAndClearSession('wrong-password')).rejects.toThrow(
      'wrong password',
    );

    expect(clearAuthTokensMock).not.toHaveBeenCalled();
  });
});
