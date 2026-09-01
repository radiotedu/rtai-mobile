import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromStudyGame = createRequire(path.join(repositoryRoot, 'study-game', 'package.json'));
const {chromium} = requireFromStudyGame('playwright');
const cases = [
  {name: 'registration-tr', url: 'https://radiotedu.com/kayit/', locale: 'tr-TR', expected: 'Aylık RadioTEDU podcast bültenini'},
  {name: 'registration-en', url: 'https://radiotedu.com/en/register/', locale: 'en-US', expected: 'I want to receive the monthly RadioTEDU podcast newsletter'},
];

const browser = await chromium.launch({headless: true});
const results = [];
try {
  for (const item of cases) {
    const context = await browser.newContext({locale: item.locale, viewport: {width: 390, height: 844}});
    const page = await context.newPage();
    const posts = [];
    const pageErrors = [];
    page.on('request', request => {
      if (request.method() === 'POST' && /newsletter\/subscribe|auth\/web\/register/.test(request.url())) posts.push(request.url());
    });
    page.on('pageerror', error => pageErrors.push(error.message));
    const response = await page.goto(`${item.url}?registration-audit=${Date.now()}`, {waitUntil: 'domcontentloaded', timeout: 30_000});
    await page.waitForSelector('[data-rt-auth="register"] input[name="newsletter_opt_in"]', {timeout: 15_000});
    const audit = await page.evaluate(() => {
      const input = document.querySelector('[data-rt-auth="register"] input[name="newsletter_opt_in"]');
      const label = input?.closest('label');
      return {
        path: location.pathname,
        checked: input instanceof HTMLInputElement ? input.checked : null,
        required: input instanceof HTMLInputElement ? input.required : null,
        value: input instanceof HTMLInputElement ? input.value : null,
        label: label?.textContent?.replace(/\s+/g, ' ').trim() || '',
      };
    });
    const checks = {
      http200: response?.status() === 200,
      optionalAndUnchecked: audit.checked === false && audit.required === false && audit.value === '1',
      localizedConsent: audit.label.startsWith(item.expected),
      readOnlyAudit: posts.length === 0,
      noPageErrors: pageErrors.length === 0,
    };
    results.push({name: item.name, checks, audit, posts, pageErrors});
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
