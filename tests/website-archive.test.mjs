import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../website/standalone/archive/', import.meta.url);
const [php, js, css, webConfig, readme] = await Promise.all([
  readFile(new URL('index.php', root), 'utf8'),
  readFile(new URL('archive.js', root), 'utf8'),
  readFile(new URL('archive.css', root), 'utf8'),
  readFile(new URL('web.config', root), 'utf8'),
  readFile(new URL('README.md', root), 'utf8'),
]);

test('archive media stays outside the repository and uses a strict allowlist', () => {
  assert.match(php, /C:\/RadioTEDU\/archive-media/);
  assert.match(php, /ARCHIVE_EXTENSIONS/);
  assert.match(php, /realpath\(\$file->getPathname\(\)\)/);
  assert.match(php, /strncmp\(\$resolved, \$prefix/);
  assert.match(readme, /Medya dosyaları Git deposuna veya WordPress yüklemelerine girmez/);
});

test('audio source is assigned only inside an explicit click handler', () => {
  assert.doesNotMatch(php, /<audio[^>]+src=/i);
  assert.match(js, /addEventListener\('click'/);
  assert.match(js, /player\.src = source/);
  assert.match(js, /audio\.preload = 'none'/);
  assert.ok(js.indexOf("addEventListener('click'") < js.indexOf('player.src = source'));
});

test('archive cache and directory listing are disabled without touching the main site', () => {
  assert.match(php, /Cache-Control: no-store, no-cache/);
  assert.match(webConfig, /<caching enabled="false" enableKernelCache="false"/);
  assert.match(webConfig, /cacheControlMode="DisableCache"/);
  assert.match(webConfig, /<directoryBrowse enabled="false"/);
});

test('catalogue is paginated and responsive', () => {
  assert.match(php, /ARCHIVE_PAGE_SIZE = 100/);
  assert.match(php, /array_slice\(\$allItems/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /grid-template-columns: 36px minmax\(0, 1fr\) auto/);
});
