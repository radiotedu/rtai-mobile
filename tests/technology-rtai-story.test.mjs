import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const technology = read('website/standalone/technology/index.html');
const teknoloji = read('website/standalone/teknoloji/index.html');
const rtai = read('website/standalone/rtai/index.html');
const header = read('website/wordpress-overlay/wp-content/themes/radiotedu/header.php');
const footer = read('website/wordpress-overlay/wp-content/themes/radiotedu/footer.php');
const themeFunctions = read('website/wordpress-overlay/wp-content/themes/radiotedu/functions.php');
const rootLlms = read('website/root-discovery/llms.txt');
const aiTxt = read('website/root-discovery/ai.txt');
const llmsAiTxt = read('website/root-discovery/llms-ai.txt');
const rtaiLlms = read('website/standalone/rtai/llms.txt');
const technologyLlms = read('website/standalone/technology/llms.txt');
const teknolojiLlms = read('website/standalone/teknoloji/llms.txt');
const sitemap = read('website/root-discovery/sitemap-radiotedu-products.xml');

test('Technology pages retain every ecosystem cluster', () => {
  const required = [
    'OnAir', 'RTSAS', 'Focus', 'AI Radio', 'RTAI Jingle', 'Situation Room',
    'Voting', 'Juke Local', 'Gold', 'tickets', 'Hub', 'ERP', 'ESG', 'Social', 'Android Auto',
    'Google Cast', 'Android TV', 'Wear OS', 'Offline podcasts', 'Sesli Kütüphane'
  ];
  for (const token of required) assert.ok(technology.includes(token), `missing ${token}`);
  const turkishRequired = ['OnAir', 'RTSAS', 'Focus', 'AI Radio', 'RTAI Jingle', 'Situation Room', 'Voting', 'Juke Local', 'Gold', 'Bilet', 'Hub', 'ERP', 'ESG', 'Social', 'Android Auto', 'Google Cast', 'Android TV', 'Wear OS', 'Sesli Kütüphane'];
  for (const token of turkishRequired) assert.ok(teknoloji.includes(token), `Turkish page missing ${token}`);
  for (const page of [technology, teknoloji]) {
    for (const goal of ['SDG 4', 'SDG 10', 'SDG 17']) assert.match(page, new RegExp(goal));
    assert.match(page, /github\.com\/akgularda\/situation-room/);
    assert.match(page, /github\.com\/radiotedu\/rtsas/);
    assert.doesNotMatch(page, /github\.com\/radiotedu\/(?:RadioTEDU-OnAir|rtai-jingle|rtai-mobile)/);
  }
});

test('Both papers are presented with Arda Akgül and downloadable files', () => {
  for (const page of [technology, teknoloji]) {
    assert.match(page, /Determining Optimal Audio Encoders/);
    assert.match(page, /Layered Audio Delivery for Efficient and Resilient/);
    assert.ok((page.match(/Arda Akgül/g) || []).length >= 2);
    assert.match(page, /determining-optimal-audio-encoders\.pdf/);
    assert.match(page, /layered-audio-delivery-radiotedu\.pdf/);
  }
  assert.ok(fs.existsSync(path.join(root, 'website/standalone/technology/research/determining-optimal-audio-encoders.pdf')));
  assert.ok(fs.existsSync(path.join(root, 'website/standalone/technology/research/layered-audio-delivery-radiotedu.pdf')));
});

test('Every local Technology image and research link ships with the release', () => {
  const references = [...technology.matchAll(/(?:src|href)="(\/technology\/(?:assets|research)\/[^"?#]+)"/g)]
    .map((match) => match[1]);
  assert.ok(references.length >= 14);
  for (const reference of references) {
    const local = reference.replace('/technology/', 'website/standalone/technology/');
    assert.ok(fs.existsSync(path.join(root, local)), `missing release asset ${reference}`);
  }
});

test('RTAI is English, sourced, scoped and uses its logo', () => {
  assert.match(rtai, /<html lang="en">/);
  assert.match(rtai, /\/rtai\/assets\/rtai-logo\.png/);
  assert.match(rtai, /applied media intelligence studio/i);
  assert.match(rtai, /not presented as a separate legal corporation|inside RadioTEDU/i);
  assert.match(rtai, /\$80B to \$130B/);
  assert.match(rtai, /48 markets/);
  assert.match(rtai, /US population age 12\+/);
  assert.match(rtai, /McKinsey/);
  assert.match(rtai, /Reuters Institute/);
  assert.match(rtai, /Edison Research/);
  assert.match(rtai, /Deloitte/);
  assert.match(rtai, /github\.com\/akgularda\/situation-room/);
  assert.match(rtai, /github\.com\/radiotedu\/rtsas/);
  assert.doesNotMatch(rtai, /Teknoloji Laboratuvarı|Yapay zekâ|Yazar:|Stüdyoları/);
});

test('Global navigation and footer expose AI and Ankara Studios', () => {
  assert.match(header, /home_url\('\/rtai\/'\)/);
  assert.match(header, />AI<\/a>/);
  assert.match(header, /home_url\('\/llms-ai\.txt'\)/);
  assert.match(footer, /RadioTEDU Ankara Studios/);
  assert.match(footer, /RadioTEDU Ankara Stüdyoları/);
  assert.match(footer, /Ziya Gökalp Cad\. No:48/);
});

test('Search and AI discovery files describe the new public surface', () => {
  for (const text of [rootLlms, aiTxt]) {
    assert.match(text, /https:\/\/radiotedu\.com\/rtai\//);
    assert.match(text, /https:\/\/radiotedu\.com\/technology\//);
    assert.match(text, /Arda Akgül/);
    assert.match(text, /github\.com\/akgularda\/situation-room/);
    assert.match(text, /github\.com\/radiotedu\/rtsas/);
    assert.doesNotMatch(text, /github\.com\/radiotedu\/rtai-jingle/);
  }
  assert.equal(llmsAiTxt, rootLlms);
  for (const text of [rootLlms, aiTxt, rtaiLlms, technologyLlms, teknolojiLlms]) {
    assert.match(text, /RadioTEDU Mobile 1\.3\.1/);
    assert.match(text, /13010/);
    assert.match(text, /Android Auto/);
  }
  const discoveryRule = read('website/iis/radiotedu-llm-discovery-rule.xml');
  assert.match(discoveryRule, /\^llms\\\.txt\$/);
  assert.match(discoveryRule, /radiotedu-llms\.php/);
  assert.match(discoveryRule, /revision=20260901/);
  const discoveryHandler = read('website/root-discovery/radiotedu-llms.php');
  assert.match(discoveryHandler, /Content-Type: text\/plain; charset=utf-8/);
  assert.match(discoveryHandler, /Cache-Control: no-cache, no-store, must-revalidate/);
  assert.match(read('website/iis/technology-server.js'), /'\.pdf': 'application\/pdf'/);
  for (const route of ['rtai', 'technology', 'teknoloji']) {
    assert.equal((sitemap.match(new RegExp(`<loc>https://radiotedu\\.com/${route}/</loc>`, 'g')) || []).length, 1, `${route} sitemap entry must be unique`);
  }
});

test('New standalone pages avoid em dashes and retain progressive enhancement', () => {
  for (const page of [technology, teknoloji, rtai]) assert.doesNotMatch(page, /—/);
  assert.match(read('website/standalone/technology/lab.css'), /prefers-reduced-motion/);
  assert.match(read('website/standalone/rtai/rtai.css'), /prefers-reduced-motion/);
  assert.match(read('website/standalone/technology/lab.js'), /IntersectionObserver/);
  assert.match(read('website/standalone/technology/lab.js'), /querySelector\('\.lab-menu'\)/);
  assert.match(read('website/standalone/technology/lab.js'), /classList\.toggle\('is-open'/);
  assert.match(read('website/standalone/rtai/rtai.js'), /IntersectionObserver/);
});

test('Technology pages use a compact, touch-safe mobile layout', () => {
  const css = read('website/standalone/technology/lab.css');
  const mobile = css.slice(css.indexOf('@media (max-width: 820px)'));

  assert.match(mobile, /h1 \{ font-size: clamp\(2\.55rem,12vw,3\.4rem\); \}/);
  assert.match(mobile, /\.cluster \{ padding-block: 76px; \}/);
  assert.match(mobile, /width: min\(100%, 560px\)/);
  assert.match(mobile, /\.participation-stage__lead \{ width: min\(100%, 460px\)/);
  assert.match(mobile, /max-height: 360px/);
  assert.match(mobile, /\.js \[data-reveal\] \{ opacity: 1; transform: none; transition: none; \}/);
  assert.match(mobile, /@media \(max-width: 560px\)/);
  assert.match(mobile, /object-fit: cover/);
  assert.match(mobile, /min-width: 44px/);
  assert.match(mobile, /min-height: 44px/);
});

test('Technology pages expose ERP, ticketing and ESG-linked Audio Library media', () => {
  const css = read('website/standalone/technology/lab.css');
  const script = read('website/standalone/technology/lab.js');
  for (const page of [technology, teknoloji]) {
    assert.match(page, /class="operations-story"/);
    assert.match(page, /radiotedu-hub-signed-in-safe\.png/);
    assert.match(page, /ERP/);
    assert.match(page, /bilet|ticket/i);
    assert.match(page, /ESG/);
    assert.match(page, /sesli-kutuphane\.png/);
    for (const image of ['sdg-04-quality-education.png', 'sdg-10-reduced-inequalities.png', 'sdg-17-partnerships.png']) {
      assert.match(page, new RegExp(image.replace('.', '\\.')));
    }
  }
  assert.match(css, /\.sdg-logos/);
  assert.match(script, /removeFailedImage/);
  assert.match(script, /media-unavailable/);
});

test('Technology pages version immutable layout assets so mobile fixes reach returning visitors', () => {
    for (const page of [technology, teknoloji]) {
        assert.match(page, /\/technology\/lab\.css\?v=20260901-r2/);
        assert.match(page, /\/technology\/lab\.js\?v=20260901-r2/);
    }
});

test('English menus route Technology to the standalone English page', () => {
    assert.match(themeFunctions, /\$path === 'teknoloji'/);
    assert.match(themeFunctions, /return \$origin \. '\/technology\/'/);
    assert.match(themeFunctions, /\$path === 'technology'/);
});
