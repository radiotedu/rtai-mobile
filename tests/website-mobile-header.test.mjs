import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const css = read('website/wordpress-overlay/wp-content/themes/radiotedu/assets/css/app.css');
const header = read('website/wordpress-overlay/wp-content/themes/radiotedu/header.php');

test('mobile header exposes five quick destinations below the brand row', () => {
  const quick = header.match(/<nav class="rt-header__quick"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.match(quick, />Radyolar|esc_html_e\('Radyolar'/);
  assert.match(quick, />AI<\/a>/);
  assert.match(quick, /listeler/);
  assert.match(quick, /rt_podcast_show/);
  assert.match(quick, /yayin-akisi/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.rt-header__inner \{ height: 104px;[^}]*grid-template-rows: 66px 38px;/);
  assert.match(css, /\.rt-header__quick \{ grid-column: 1 \/ -1; grid-row: 2; display: flex;/);
});

test('mobile account and menu controls are width-bounded', () => {
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.rt-account-link \{[^}]*max-width: 126px;/);
  assert.match(css, /\.rt-nav-toggle \{ min-width: 40px; width: 40px;/);
  assert.match(css, /\.rt-nav \{ top: 104px; height: calc\(100dvh - 104px - var\(--rt-player-height\)\);/);
});

test('station logos use contain so RadioTEDU AI remains complete', () => {
  assert.match(css, /\.rt-station-card__art \{[^}]*background: var\(--rt-gray-100\);/);
  assert.match(css, /\.rt-station-card__art img \{[^}]*object-fit: contain;/);
});
