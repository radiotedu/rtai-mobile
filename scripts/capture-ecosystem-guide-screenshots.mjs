import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromStudyGame = createRequire(path.join(repositoryRoot, 'study-game', 'package.json'));
const {chromium} = requireFromStudyGame('playwright');

const outputArgument = process.argv.indexOf('--output');
const output = path.resolve(outputArgument >= 0 ? process.argv[outputArgument + 1] : 'ecosystem-guide-assets');
await fs.mkdir(output, {recursive: true});

const pages = [
  ['homepage', 'https://radiotedu.com/'],
  ['account-login', 'https://radiotedu.com/giris/'],
  ['voting', 'https://radiotedu.com/vote/'],
  ['juke-controller', 'https://radiotedu.com/juke-local/controller/'],
  ['juke-kiosk', 'https://radiotedu.com/juke-local/'],
  ['social', 'https://radiotedu.com/social/'],
  ['management-login', 'https://radiotedu.com/management/dashboard/'],
  ['technology', 'https://radiotedu.com/teknoloji/'],
];

const browser = await chromium.launch({headless: true});
const context = await browser.newContext({
  colorScheme: 'dark',
  locale: 'tr-TR',
  reducedMotion: 'reduce',
  viewport: {height: 900, width: 1440},
});
const report = [];
try {
  for (const [name, url] of pages) {
    const page = await context.newPage();
    const response = await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 30_000});
    await page.waitForTimeout(1_500);
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
    const file = path.join(output, `${name}.png`);
    await page.screenshot({path: file, fullPage: false});
    report.push({
      file,
      finalUrl: page.url(),
      name,
      status: response?.status() ?? null,
      title: await page.title(),
    });
    await page.close();
  }
  const contactSheet = await context.newPage();
  const figures = await Promise.all(report.map(async item => {
    const data = await fs.readFile(item.file, 'base64');
    return `<figure><img src="data:image/png;base64,${data}" alt="${item.name}"><figcaption>${item.name} · HTTP ${item.status}</figcaption></figure>`;
  }));
  await contactSheet.setContent(`<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:24px;background:#090b10;color:#fff;font:16px system-ui}
    main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
    figure{margin:0;padding:10px;border:1px solid #343944;border-radius:14px;background:#151922}
    img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;border-radius:8px}
    figcaption{padding:10px 2px 2px;font-weight:700}
  </style><main>${figures.join('')}</main>`);
  const contactSheetFile = path.join(output, 'contact-sheet.png');
  await contactSheet.screenshot({path: contactSheetFile, fullPage: true});
  await contactSheet.close();
  report.push({file: contactSheetFile, name: 'contact-sheet', status: 200, title: 'Ecosystem contact sheet'});
} finally {
  await context.close();
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
