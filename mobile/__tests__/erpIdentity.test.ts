import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import axios from 'axios';
import {Linking} from 'react-native';

import {
  exchangeTeduLoginCode,
  parseTeduLoginCallback,
  startTeduLogin,
  TEDU_LOGIN_RETURN_URI,
} from '../src/services/erpIdentity';

jest.mock('axios', () => ({post: jest.fn()}));
jest.mock('react-native', () => ({
  Linking: {openURL: jest.fn()},
}));

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

  it('starts login only with the HTTPS RadioTEDU ERP authorization URL', async () => {
    const post = axios.post as jest.MockedFunction<(url: string, body: unknown) => Promise<any>>;
    post.mockResolvedValueOnce({
      data: {data: {authorization_url: 'https://radiotedu.com/erp/oauth/authorize?state=opaque'}},
    });

    await startTeduLogin();
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/erp-link/login/start'),
      {return_uri: TEDU_LOGIN_RETURN_URI},
    );
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://radiotedu.com/erp/oauth/authorize?state=opaque',
    );
  });

  it('exchanges the short-lived code for the shared RadioTEDU session', async () => {
    const post = axios.post as jest.MockedFunction<(url: string, body: unknown) => Promise<any>>;
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
    );
  });
});
