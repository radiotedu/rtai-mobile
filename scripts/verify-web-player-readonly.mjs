import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromStudyGame = createRequire(path.join(repositoryRoot, 'study-game', 'package.json'));
const {chromium} = requireFromStudyGame('playwright');

const browser = await chromium.launch({channel: 'msedge', headless: true});
const profiles = [
  {name: 'desktop', viewport: {height: 900, width: 1440}},
  {
    name: 'mobile',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',
    viewport: {height: 844, width: 390},
  },
];
const report = [];
try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      locale: 'tr-TR',
      userAgent: profile.userAgent,
      viewport: profile.viewport,
    });
    await context.route(/google-analytics|googletagmanager|doubleclick/, route => route.abort());
    const page = await context.newPage();
    const response = await page.goto(`https://radiotedu.com/radyolar/?player-audit=${Date.now()}`, {waitUntil: 'domcontentloaded', timeout: 30_000});
    await page.waitForSelector('[data-rt-player-toggle]', {state: 'attached', timeout: 30_000});
    await page.evaluate(() => {
      for (const element of document.querySelectorAll('body *')) {
        const text = element.textContent?.replace(/\s+/g, ' ').trim();
        if (text !== 'Çerez tercihleri' && text !== 'Cookie preferences') continue;
        let container = element;
        while (container.parentElement && getComputedStyle(container).position !== 'fixed') container = container.parentElement;
        if (getComputedStyle(container).position === 'fixed') container.remove();
      }
    });
    const stationButton = page.locator('[data-rt-play="station"][data-id="radiotedu-main"]').first();
    if (await stationButton.count()) await stationButton.click();
    else await page.locator('[data-rt-player-toggle]').click();
    await page.waitForTimeout(7_000);
    const state = await page.evaluate(() => {
      const text = selector => document.querySelector(selector)?.textContent?.trim() || '';
      const visible = selector => {
        const element = document.querySelector(selector);
        return Boolean(element && !element.hidden && getComputedStyle(element).display !== 'none');
      };
      return {
        artworkVisible: visible('[data-rt-player-art]') && (document.querySelector('[data-rt-player-art]')?.naturalWidth || 0) > 0,
        isPlaying: document.querySelector('[data-rt-player]')?.classList.contains('is-playing') || false,
        metadataArtist: text('[data-rt-player-subtitle]'),
        metadataTitle: text('[data-rt-player-title]'),
        mediaSessionArtist: navigator.mediaSession?.metadata?.artist || '',
        mediaSessionTitle: navigator.mediaSession?.metadata?.title || '',
        playerPresent: Boolean(document.querySelector('[data-rt-player]')),
        playerStatus: text('[data-rt-player-status]'),
        purchaseLinksVisible: visible('[data-rt-player-store]'),
        toggleLabel: document.querySelector('[data-rt-player-toggle]')?.getAttribute('aria-label') || '',
      };
    });
    report.push({profile: profile.name, status: response?.status() ?? null, ...state});
    await context.close();
  }
} finally {
  await browser.close();
}

const failures = report.flatMap(item => {
  const checks = {
    http200: item.status === 200,
    playerPresent: item.playerPresent,
    playbackStarted: item.isPlaying,
    artworkVisible: item.artworkVisible,
    metadataVisible: Boolean(item.metadataTitle && item.metadataArtist && item.metadataTitle !== 'RadioTEDU'),
    mediaSessionMatches: item.mediaSessionTitle === item.metadataTitle && item.mediaSessionArtist === item.metadataArtist,
    accessibleToggle: item.toggleLabel === 'Duraklat' || item.toggleLabel === 'Pause',
  };
  return Object.entries(checks).filter(([, passed]) => !passed).map(([check]) => `${item.profile}:${check}`);
});
console.log(JSON.stringify({passed: failures.length === 0, failures, report}, null, 2));
if (failures.length) process.exitCode = 1;
