import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromStudyGame = createRequire(path.join(repositoryRoot, 'study-game', 'package.json'));
const {chromium} = requireFromStudyGame('playwright');
const outputIndex = process.argv.indexOf('--output');
const output = path.resolve(outputIndex >= 0 ? process.argv[outputIndex + 1] : 'stations-page-verification');
await fs.mkdir(output, {recursive: true});

const cases = [
  {name: 'stations-tr-desktop', url: 'https://radiotedu.com/radyolar/', width: 1440, height: 1000},
  {name: 'stations-en-desktop', url: 'https://radiotedu.com/en/stations/', width: 1440, height: 1000},
  {name: 'stations-tr-mobile', url: 'https://radiotedu.com/radyolar/', width: 390, height: 844, mobile: true},
  {name: 'stations-en-mobile', url: 'https://radiotedu.com/en/stations/', width: 390, height: 844, mobile: true},
];

const browser = await chromium.launch({headless: true});
const results = [];
try {
  for (const item of cases) {
    const context = await browser.newContext({
      viewport: {width: item.width, height: item.height},
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: Boolean(item.mobile),
      locale: item.name.includes('-en-') ? 'en-US' : 'tr-TR',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const response = await page.goto(item.url, {waitUntil: 'domcontentloaded', timeout: 30_000});
    await page.waitForSelector('[data-rt-station-feature]', {timeout: 15_000});
    await page.waitForFunction(() => {
      const feature = document.querySelector('[data-rt-station-feature]');
      return ['ready', 'waiting', 'error'].includes(feature?.dataset.metadataState || '');
    }, {timeout: 15_000});
    await page.evaluate(() => {
      for (const element of document.querySelectorAll('body *')) {
        const text = element.textContent?.replace(/\s+/g, ' ').trim();
        if (text !== 'Çerez tercihleri' && text !== 'Cookie preferences') continue;
        let container = element;
        while (container.parentElement && getComputedStyle(container).position !== 'fixed') {
          container = container.parentElement;
        }
        if (getComputedStyle(container).position === 'fixed') container.remove();
      }
    });
    const audit = await page.evaluate(() => {
      const feature = document.querySelector('[data-rt-station-feature]');
      const directory = document.querySelector('.rt-stations-directory');
      const mainLogo = document.querySelector('.rt-stations-flagship__identity > img');
      const mainTitle = document.querySelector('.rt-stations-flagship__identity h1');
      const stationLogos = [...document.querySelectorAll('.rt-stations-directory .rt-station-card__art img')];
      const metadataTrack = document.querySelector('[data-rt-station-feature-track]')?.textContent?.trim() || '';
      const metadataArtist = document.querySelector('[data-rt-station-feature-artist]')?.textContent?.trim() || '';
      return {
        featureBeforeDirectory: Boolean(feature && directory && (feature.compareDocumentPosition(directory) & Node.DOCUMENT_POSITION_FOLLOWING)),
        metadataState: feature?.dataset.metadataState || '',
        metadataTrack,
        metadataArtist,
        noComingSoon: !/(YAKINDA|COMING SOON)/i.test(document.body.innerText),
        noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        mainLogoNaturalWidth: mainLogo?.naturalWidth || 0,
        mainLogoRenderedWidth: Math.round(mainLogo?.getBoundingClientRect().width || 0),
        stationLogoCount: stationLogos.length,
        stationLogoNaturalWidths: stationLogos.map(image => image.naturalWidth),
        stationLogoRenderedWidths: stationLogos.map(image => Math.round(image.getBoundingClientRect().width)),
        playButtonReady: Boolean(feature?.querySelector('[data-rt-play="station"][data-src]')),
        mainTitleContained: Boolean(mainTitle && mainTitle.getBoundingClientRect().left >= 0 && mainTitle.getBoundingClientRect().right <= window.innerWidth),
        cssHrefs: [...document.styleSheets].map(sheet => sheet.href || 'inline').slice(0, 12),
        mainLogoComputed: mainLogo ? {
          width: getComputedStyle(mainLogo).width,
          maxWidth: getComputedStyle(mainLogo).maxWidth,
          selectorRulePresent: [...document.styleSheets].some(sheet => {
            try { return [...sheet.cssRules].some(rule => rule.selectorText?.includes('.rt-stations-flagship__identity > img')); } catch { return false; }
          }),
        } : null,
      };
    });
    const limits = item.mobile ? {main: 74, station: 70} : {main: 118, station: 96};
    const checks = {
      http200: response?.status() === 200,
      featureFirst: audit.featureBeforeDirectory,
      metadataReady: audit.metadataState === 'ready' && Boolean(audit.metadataTrack) && Boolean(audit.metadataArtist),
      noComingSoon: audit.noComingSoon,
      noHorizontalOverflow: audit.noHorizontalOverflow,
      mainLogoCrispAndMeasured: audit.mainLogoNaturalWidth >= 768 && audit.mainLogoRenderedWidth <= limits.main,
      stationLogosCrispAndMeasured: audit.stationLogoCount >= 7 && audit.stationLogoNaturalWidths.every(width => width >= 768) && audit.stationLogoRenderedWidths.every(width => width <= limits.station),
      playButtonReady: audit.playButtonReady,
      mainTitleContained: audit.mainTitleContained,
      noPageErrors: pageErrors.length === 0,
    };
    const screenshot = path.join(output, `${item.name}.png`);
    await page.screenshot({path: screenshot, fullPage: true});
    results.push({name: item.name, status: response?.status() ?? null, checks, audit, pageErrors, screenshot});
    await context.close();
  }
} finally {
  await browser.close();
}

const failures = results.flatMap(result => Object.entries(result.checks).filter(([, passed]) => !passed).map(([check]) => `${result.name}:${check}`));
console.log(JSON.stringify({passed: failures.length === 0, failures, results}, null, 2));
if (failures.length) process.exitCode = 1;
