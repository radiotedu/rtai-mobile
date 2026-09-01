import axios from 'axios';

const NEWSLETTER_SUBSCRIBE_URL = 'https://radiotedu.com/wp-json/radiotedu/v1/newsletter/subscribe';

export type NewsletterLanguage = 'tr' | 'en';

export function newsletterLanguage(language: unknown): NewsletterLanguage {
  const code = typeof language === 'string'
    ? language.trim().toLowerCase().split(/[-_]/)[0]
    : '';
  return code === 'tr' ? 'tr' : 'en';
}

export async function subscribeToMonthlyNewsletter(email: string, language: unknown): Promise<boolean> {
  const response = await axios.post(
    NEWSLETTER_SUBSCRIBE_URL,
    {
      email: email.trim().toLowerCase(),
      language: newsletterLanguage(language),
      consent: '1',
    },
    {
      timeout: 7500,
      headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
    },
  );
  return response.status >= 200 && response.status < 300 && response.data?.ok === true;
}
