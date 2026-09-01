import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromStudyGame = createRequire(path.join(repositoryRoot, 'study-game', 'package.json'));
const {chromium} = requireFromStudyGame('playwright');
const baseUrl = 'https://radiotedu.com';
const cacheBust = () => `language-audit=${Date.now()}-${Math.random().toString(16).slice(2)}`;

const cases = [
  {name: 'turkish-system', locale: 'tr-TR', expectedPath: '/'},
  {name: 'english-system', locale: 'en-US', expectedPath: '/en/'},
  {name: 'german-system', locale: 'de-DE', expectedPath: '/en/'},
  {name: 'explicit-turkish', locale: 'en-US', preference: 'tr', expectedPath: '/'},
  {name: 'explicit-english', locale: 'tr-TR', preference: 'en', expectedPath: '/en/'},
];

const browser = await chromium.launch({headless: true});
const results = [];
try {
  for (const item of cases) {
    const context = await browser.newContext({locale: item.locale, viewport: {width: 1280, height: 900}});
    if (item.preference) {
      await context.addCookies([{
        name: 'rt_language_preference',
        value: item.preference,
        domain: 'radiotedu.com',
        path: '/',
        secure: true,
        sameSite: 'Lax',
      }]);
    }
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const response = await page.goto(`${baseUrl}/?${cacheBust()}`, {waitUntil: 'domcontentloaded', timeout: 30_000});
    await page.waitForLoadState('networkidle', {timeout: 15_000}).catch(() => {});
    const audit = await page.evaluate(() => {
      const quick = [...document.querySelectorAll('.rt-header__quick a')].map(element => element.textContent?.trim() || '');
      const primary = [...document.querySelectorAll('#rt-primary-nav .rt-nav__list a')].map(element => element.textContent?.replace(/\s+/g, ' ').trim() || '');
      const languageLinks = [...document.querySelectorAll('.rt-language__link')].map(element => ({
        language: element.getAttribute('hreflang'),
        href: element.getAttribute('href'),
        noPjax: element.hasAttribute('data-no-pjax'),
      }));
      return {
        path: location.pathname,
        documentLanguage: document.documentElement.lang,
        quick,
        primary,
        languageLinks,
      };
    });
    const english = item.expectedPath === '/en/';
    const turkishMenuPattern = /^(Radyolar|Listeler|Podcastler|Yayın Akışı|Duyurular|Teknoloji|Etkinlikler|Hakkımızda|İletişim|Dinle)$/i;
    const checks = {
      http200: response?.status() === 200,
      expectedPath: audit.path === item.expectedPath,
      correctDocumentLanguage: audit.documentLanguage.toLowerCase().startsWith(english ? 'en' : 'tr'),
      englishQuickMenu: !english || ['Stations', 'AI', 'Playlists', 'Podcasts', 'Schedule'].every((label, index) => audit.quick[index] === label),
      englishPrimaryMenu: !english || audit.primary.every(label => !turkishMenuPattern.test(label)),
      persistentLanguageLinks: audit.languageLinks.length === 2 && audit.languageLinks.every(link => link.noPjax && /rt_language_choice=(tr|en)/.test(link.href || '')),
      noPageErrors: pageErrors.length === 0,
    };
    results.push({name: item.name, locale: item.locale, preference: item.preference || null, checks, audit, pageErrors});
    await context.close();
  }
} finally {
  await browser.close();
}

const failures = results.flatMap(result => Object.entries(result.checks)
  .filter(([, passed]) => !passed)
  .map(([check]) => `${result.name}:${check}`));
console.log(JSON.stringify({passed: failures.length === 0, failures, results}, null, 2));
if (failures.length) process.exitCode = 1;
