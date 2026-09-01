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
    await page.waitForLoadState('networkidle', {timeout: 3_000}).catch(() => {});
    const audit = await page.evaluate(() => {
      const quick = [...document.querySelectorAll('.rt-header__quick a')].map(element => element.textContent?.trim() || '');
      const primary = [...document.querySelectorAll('#rt-primary-nav .rt-nav__list a')].map(element => element.textContent?.replace(/\s+/g, ' ').trim() || '');
      const menuToggle = document.querySelector('.rt-nav-toggle__label')?.textContent?.trim() || '';
      const lyricsLabel = document.querySelector('[data-rt-player-lyrics] .rt-player__lyrics-head > span')?.textContent?.trim() || '';
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
        menuToggle,
        lyricsLabel,
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
      localizedMenuToggle: audit.menuToggle === (english ? 'Menu' : 'Menü'),
      localizedLyrics: audit.lyricsLabel === (english ? 'LIVE LYRICS' : 'CANLI SÖZLER'),
      persistentLanguageLinks: audit.languageLinks.length === 2 && audit.languageLinks.every(link => link.noPjax && /rt_language_choice=(tr|en)/.test(link.href || '')),
      noPageErrors: pageErrors.length === 0,
    };
    results.push({name: item.name, locale: item.locale, preference: item.preference || null, checks, audit, pageErrors});
    await context.close();
  }

  const toggleContext = await browser.newContext({locale: 'tr-TR', viewport: {width: 1280, height: 900}});
  const togglePage = await toggleContext.newPage();
  const toggleErrors = [];
  togglePage.on('pageerror', error => toggleErrors.push(error.message));
  await togglePage.goto(`${baseUrl}/?${cacheBust()}`, {waitUntil: 'domcontentloaded', timeout: 30_000});
  await togglePage.locator('.rt-nav-toggle').click();
  await togglePage.locator('.rt-language__link[hreflang="en"]').evaluate(element => element.click());
  await togglePage.waitForFunction(() => location.pathname === '/en/' && !new URL(location.href).searchParams.has('rt_language_choice'), null, {timeout: 30_000});
  const toggleAudit = await togglePage.evaluate(() => ({
    path: location.pathname,
    documentLanguage: document.documentElement.lang,
    quick: [...document.querySelectorAll('.rt-header__quick a')].map(element => element.textContent?.trim() || ''),
    primary: [...document.querySelectorAll('#rt-primary-nav .rt-nav__list a')].map(element => element.textContent?.replace(/\s+/g, ' ').trim() || ''),
    menuToggle: document.querySelector('.rt-nav-toggle__label')?.textContent?.trim() || '',
    lyricsLabel: document.querySelector('[data-rt-player-lyrics] .rt-player__lyrics-head > span')?.textContent?.trim() || '',
    preference: document.cookie.match(/(?:^|;\s*)rt_language_preference=(tr|en)(?:;|$)/)?.[1] || '',
  }));
  results.push({
    name: 'toggle-turkish-to-english',
    locale: 'tr-TR',
    preference: null,
    checks: {
      expectedPath: toggleAudit.path === '/en/',
      correctDocumentLanguage: toggleAudit.documentLanguage.toLowerCase().startsWith('en'),
      englishQuickMenu: ['Stations', 'AI', 'Playlists', 'Podcasts', 'Schedule'].every((label, index) => toggleAudit.quick[index] === label),
      englishPrimaryMenu: toggleAudit.primary.every(label => !/^(Radyolar|Listeler|Podcastler|Yayın Akışı|Duyurular|Teknoloji|Etkinlikler|Hakkımızda|İletişim|Dinle)$/i.test(label)),
      localizedMenuToggle: toggleAudit.menuToggle === 'Menu',
      localizedLyrics: toggleAudit.lyricsLabel === 'LIVE LYRICS',
      preferencePersisted: toggleAudit.preference === 'en',
      noPageErrors: toggleErrors.length === 0,
    },
    audit: toggleAudit,
    pageErrors: toggleErrors,
  });
  await toggleContext.close();
} finally {
  await browser.close();
}

const failures = results.flatMap(result => Object.entries(result.checks)
  .filter(([, passed]) => !passed)
  .map(([check]) => `${result.name}:${check}`));
console.log(JSON.stringify({passed: failures.length === 0, failures, results}, null, 2));
if (failures.length) process.exitCode = 1;
