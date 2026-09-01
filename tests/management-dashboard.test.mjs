import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..', 'website', 'standalone', 'management-dashboard');
const read = name => readFileSync(path.join(root, name), 'utf8');

test('entrance dashboard is a read-only ERP display', () => {
  const page = read('index.php');
  const api = read('api.php');
  const client = read('dashboard.js');

  assert.match(page, /class="topbar-logo"/);
  assert.match(page, /https:\/\/radiotedu\.com\/erp\/room\/reservation/);
  assert.doesNotMatch(page, /<form|<input|<textarea|Yükleniyor|yükleniyor/);

  assert.match(api, /REQUEST_METHOD.*!== 'GET'/s);
  assert.match(api, /Allow: GET/);
  assert.doesNotMatch(api, /appointments|REQUEST_METHOD.*POST|Allow: GET, POST/s);

  assert.match(client, /setInterval\(refresh, 30000\)/);
  assert.match(client, /Keep the last confirmed ERP state visible/);
  assert.doesNotMatch(client, /reservation-form|FormData|method:\s*['"]POST['"]|Yükleniyor|yükleniyor/);
});
