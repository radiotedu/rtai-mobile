import axios from 'axios';

import {
  newsletterLanguage,
  subscribeToMonthlyNewsletter,
} from '../src/services/newsletterService';

jest.mock('axios', () => ({
  __esModule: true,
  default: {post: jest.fn()},
}));

const mockedPost = axios.post as jest.MockedFunction<typeof axios.post>;

describe('registration newsletter consent', () => {
  beforeEach(() => mockedPost.mockReset());

  it('uses Turkish only for Turkish locales and English for every other locale', () => {
    expect(newsletterLanguage('tr-TR')).toBe('tr');
    expect(newsletterLanguage('en-US')).toBe('en');
    expect(newsletterLanguage('de-DE')).toBe('en');
  });

  it('subscribes only when the registration flow explicitly calls the consent service', async () => {
    mockedPost.mockResolvedValue({status: 200, data: {ok: true}} as never);
    await expect(subscribeToMonthlyNewsletter(' User@Example.com ', 'tr-TR')).resolves.toBe(true);
    expect(mockedPost).toHaveBeenCalledWith(
      'https://radiotedu.com/wp-json/radiotedu/v1/newsletter/subscribe',
      {email: 'user@example.com', language: 'tr', consent: '1'},
      expect.objectContaining({timeout: 7500}),
    );
  });
});
