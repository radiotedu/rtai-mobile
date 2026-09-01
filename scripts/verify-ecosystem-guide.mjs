import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromStudyGame = createRequire(path.join(repositoryRoot, 'study-game', 'package.json'));
const {chromium} = requireFromStudyGame('playwright');
const guide = path.resolve(process.argv[2] || 'C:/Users/tuna.ozsari/Desktop/RadioTEDU-Ekosistem-Rehberi.html');
const output = path.resolve(process.argv[3] || path.join(path.dirname(guide), 'RadioTEDU-Ekosistem-Rehberi-assets', 'ecosystem-guide-final.png'));
const publicMode = process.argv.includes('--public');
const stat = await fs.stat(guide);

const browser = await chromium.launch({headless: true});
let audit;
try {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(pathToFileURL(guide).href, {waitUntil: 'domcontentloaded', timeout: 30_000});
  await page.evaluate(() => {
    const details = document.querySelector('#ecosystem-final-update');
    if (details) details.open = true;
    const root = document.querySelector('#ecosystem-final-update') || document.querySelector('main');
    if (root) Object.assign(root.style, {position: 'static', width: '100%', maxWidth: 'none'});
    const body = document.querySelector('#ecosystem-guide-body');
    if (body) Object.assign(body.style, {maxHeight: 'none', overflow: 'visible'});
  });
  await page.waitForTimeout(500);
  audit = await page.evaluate(({size, pageErrors}) => {
    const root = document.querySelector('#ecosystem-final-update') || document.querySelector('main');
    const images = [...root.querySelectorAll('img')];
    const sectionIds = [...root.querySelectorAll('.eco-section')].map(section => section.id).filter(Boolean);
    const text = root.textContent || '';
    return {
      bytes: size,
      sectionCount: root.querySelectorAll('.eco-section, .card').length,
      sectionIds,
      images: images.map(image => ({src: image.getAttribute('src'), complete: image.complete, naturalWidth: image.naturalWidth})),
      hasJukeCredentials: text.includes('admin@radiotedu') && text.includes('PC 2 / Kolej kiosk'),
      hasManagement: Boolean(root.querySelector('a[href*="/management/dashboard/"]') && root.querySelector('a[href*="/erp/room/reservation"]')),
      hasTroubleshooting: text.includes('Ayrıntılı sorun giderme karar tablosu'),
      hasBackup: text.includes('20260901-stations-flagship-before'),
      hasNoTouchBoundaries: text.includes('Sesli Kütüphane') && text.includes('nuke, reset, truncate'),
      hasStationsAudit: text.includes('Radyolar') && text.includes('19/19'),
      hasPlaintextKioskCredentials: text.includes('PC 2 / Kolej kiosk') || text.includes('admin / admin'),
      pageErrors,
    };
  }, {size: stat.size, pageErrors});
  await page.locator(publicMode ? 'main' : '#ecosystem-final-update').screenshot({path: output});
  await context.close();
} finally {
  await browser.close();
}

const checks = publicMode ? {
  substantialGuide: audit.bytes > 14_000 && audit.sectionCount >= 10,
  stationsAndAuditDocumented: audit.hasStationsAudit,
  managementDocumented: audit.hasManagement,
  noPlaintextKioskCredentials: !audit.hasPlaintextKioskCredentials,
  noPageErrors: audit.pageErrors.length === 0,
} : {
  substantialGuide: audit.bytes > 300_000 && audit.sectionCount >= 28,
  screenshotsLoaded: audit.images.length >= 6 && audit.images.every(image => image.complete && image.naturalWidth > 0),
  credentialsDocumented: audit.hasJukeCredentials,
  managementDocumented: audit.hasManagement,
  troubleshootingDocumented: audit.hasTroubleshooting,
  backupDocumented: audit.hasBackup,
  safetyBoundariesDocumented: audit.hasNoTouchBoundaries,
  noPageErrors: audit.pageErrors.length === 0,
};
const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
console.log(JSON.stringify({passed: failures.length === 0, failures, checks, bytes: audit.bytes, sectionCount: audit.sectionCount, screenshotCount: audit.images.length, output}, null, 2));
if (failures.length) process.exitCode = 1;
