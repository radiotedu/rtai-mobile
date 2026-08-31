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
const rootLlms = read('website/root-discovery/llms.txt');
const aiTxt = read('website/root-discovery/ai.txt');
const llmsAiTxt = read('website/root-discovery/llms-ai.txt');
const sitemap = read('website/root-discovery/sitemap-radiotedu-products.xml');

test('Technology pages retain every ecosystem cluster', () => {
  const required = [
    'OnAir', 'RTSAS', 'Focus', 'AI Radio', 'RTAI Jingle', 'Situation Room',
    'Voting', 'Juke Local', 'Gold', 'tickets', 'Hub', 'Social', 'Android Auto',
    'Google Cast', 'Android TV', 'Wear OS', 'Offline podcasts', 'Sesli Kütüphane'
  ];
  for (const token of required) assert.ok(technology.includes(token), `missing ${token}`);
  const turkishRequired = ['OnAir', 'RTSAS', 'Focus', 'AI Radio', 'RTAI Jingle', 'Situation Room', 'Voting', 'Juke Local', 'Gold', 'Bilet', 'Hub', 'Social', 'Android Auto', 'Google Cast', 'Android TV', 'Wear OS', 'Sesli Kütüphane'];
  for (const token of turkishRequired) assert.ok(teknoloji.includes(token), `Turkish page missing ${token}`);
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
  assert.ok(references.length >= 10);
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
  }
  assert.equal(llmsAiTxt, rootLlms);
  assert.match(read('website/iis/radiotedu-llm-discovery-rule.xml'), /\^llms\\\.txt\$/);
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
