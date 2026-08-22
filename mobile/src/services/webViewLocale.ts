export const WEBVIEW_LOCALES = ['en', 'tr', 'ar', 'ru', 'de', 'fr'] as const;

export type WebViewLocale = (typeof WEBVIEW_LOCALES)[number];

export function normalizeWebViewLocale(locale?: unknown): WebViewLocale {
  const code =
    typeof locale === 'string'
      ? locale.trim().toLowerCase().split(/[-_]/)[0]
      : '';

  return (WEBVIEW_LOCALES as readonly string[]).includes(code)
    ? (code as WebViewLocale)
    : 'en';
}
