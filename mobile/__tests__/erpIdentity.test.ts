import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import axios from 'axios';
import {Linking} from 'react-native';

import {
  ERP_IDENTITY_TIMEOUT_MS,
  exchangeTeduLoginCode,
  parseTeduLoginCallback,
  startTeduLogin,
  TEDU_LOGIN_RETURN_URI,
} from '../src/services/erpIdentity';
import {authCopy} from '../src/i18n/screenCopy';

jest.mock('axios', () => ({post: jest.fn()}));
jest.mock('react-native', () => ({
  Linking: {openURL: jest.fn()},
}));

type AxiosPostMock = jest.MockedFunction<(
  url: string,
  body: unknown,
  config?: {timeout?: number; signal?: AbortSignal},
) => Promise<any>>;

describe('TEDÜ mobile identity login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts only the exact RadioTEDU ERP callback deep link', () => {
    expect(parseTeduLoginCallback(
      'radiotedu://auth/erp/linked?erp_status=success&erp_code=one-time-code',
    )).toEqual({matched: true, code: 'one-time-code', error: null});
    expect(parseTeduLoginCallback(
      'radiotedu://jukebox/device?erp_status=success&erp_code=stolen',
    )).toEqual({matched: false});
    expect(parseTeduLoginCallback(
      'https://evil.example/erp/linked?erp_status=success&erp_code=stolen',
    )).toEqual({matched: false});
  });

  it('returns a stable localizable code when the callback reports failure', () => {
    expect(parseTeduLoginCallback(
      'radiotedu://auth/erp/linked?erp_status=failed',
    )).toEqual({matched: true, code: null, error: 'erp.callbackFailed'});

    for (const language of ['en', 'tr', 'ru', 'ar', 'de', 'fr']) {
      expect(authCopy(language, 'erp.callbackFailed')).not.toBe('erp.callbackFailed');
      expect(authCopy(language, 'erp.invalidSession')).not.toBe('erp.invalidSession');
    }
  });

  it('starts login only with the HTTPS RadioTEDU ERP authorization URL', async () => {
    const post = axios.post as AxiosPostMock;
    post.mockResolvedValueOnce({
      data: {data: {authorization_url: 'https://radiotedu.com/erp/oauth/authorize?state=opaque'}},
    });

    await startTeduLogin();
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/erp-link/login/start'),
      {return_uri: TEDU_LOGIN_RETURN_URI},
      {timeout: ERP_IDENTITY_TIMEOUT_MS, signal: undefined},
    );
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://radiotedu.com/erp/oauth/authorize?state=opaque',
    );
  });

  it('exchanges the short-lived code for the shared RadioTEDU session', async () => {
    const post = axios.post as AxiosPostMock;
    post.mockResolvedValueOnce({
      data: {data: {user: {id: 'u1'}, access_token: 'access', refresh_token: 'refresh'}},
    });

    await expect(exchangeTeduLoginCode('one-time')).resolves.toMatchObject({
      user: {id: 'u1'},
      access_token: 'access',
      refresh_token: 'refresh',
    });
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/erp-link/login/exchange'),
      {code: 'one-time'},
      {timeout: ERP_IDENTITY_TIMEOUT_MS, signal: undefined},
    );
  });

  it('rejects invalid responses with stable ERP error codes', async () => {
    const post = axios.post as AxiosPostMock;
    post
      .mockResolvedValueOnce({data: {data: {authorization_url: 'https://evil.example/authorize'}}})
      .mockResolvedValueOnce({data: {data: {user: {id: 'u1'}, access_token: '', refresh_token: ''}}});

    await expect(startTeduLogin()).rejects.toMatchObject({code: 'erp.unsafeUrl'});
    await expect(exchangeTeduLoginCode('one-time')).rejects.toMatchObject({code: 'erp.invalidSession'});
  });

  it('honors cancellation even when a mocked request resolves after abort', async () => {
    const post = axios.post as AxiosPostMock;
    const startController = new AbortController();
    post.mockImplementationOnce(async () => {
      startController.abort();
      return {
        data: {data: {
          authorization_url: 'https://radiotedu.com/erp/oauth/authorize?state=stale',
        }},
      };
    });

    await expect(startTeduLogin(startController.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(Linking.openURL).not.toHaveBeenCalled();

    const exchangeController = new AbortController();
    post.mockImplementationOnce(async () => {
      exchangeController.abort();
      return {
        data: {data: {
          user: {id: 'stale-user'},
          access_token: 'stale-access',
          refresh_token: 'stale-refresh',
        }},
      };
    });

    await expect(exchangeTeduLoginCode(
      'stale-code',
      exchangeController.signal,
    )).rejects.toMatchObject({name: 'AbortError'});
  });
});
