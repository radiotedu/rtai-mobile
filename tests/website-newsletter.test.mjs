import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const paths = {
  plugin: new URL('website/wordpress-overlay/wp-content/plugins/radiotedu-newsletter/includes/class-radiotedu-newsletter.php', root),
  cli: new URL('website/wordpress-overlay/wp-content/plugins/radiotedu-newsletter/cli.php', root),
  header: new URL('website/wordpress-overlay/wp-content/themes/radiotedu/header.php', root),
  footer: new URL('website/wordpress-overlay/wp-content/themes/radiotedu/footer.php', root),
  css: new URL('website/wordpress-overlay/wp-content/themes/radiotedu/assets/css/app.css', root),
  js: new URL('website/wordpress-overlay/wp-content/themes/radiotedu/assets/js/app.js', root),
  exporter: new URL('ops/newsletter/export-erp-subscribers.cjs', root),
  runner: new URL('ops/newsletter/run-newsletter.ps1', root),
  pause: new URL('ops/newsletter/pause-newsletter.ps1', root),
  iis: new URL('website/iis/newsletter-preferences-rule.xml', root),
};
const entries = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, url]) => [key, await readFile(url, 'utf8')])));

test('newsletter starts in October, skips September and limits pre-production test mail', () => {
  assert.match(entries.plugin, /production_start' => '2026-10-01 10:00:00'/);
  assert.match(entries.plugin, /test_recipient' => 'arda\.akgul@tedu\.edu\.tr'/);
  assert.match(entries.plugin, /preview_recipient' => 'tuna\.ozsari@tedu\.edu\.tr'/);
  assert.match(entries.plugin, /\$now < \$start->modify\('-2 days'\)/);
  assert.match(entries.plugin, /\$kind === 'issue' && \$now < \$start/);
});

test('every issue is a fixed 30-day podcast snapshot with direct episode presentation', () => {
  assert.match(entries.plugin, /\$windowStart = \$issueDate->modify\('-30 days'\)/);
  assert.match(entries.plugin, /'post_type' => 'rt_podcast_episode'/);
  assert.match(entries.plugin, /episode_ids/);
  assert.match(entries.plugin, /BÖLÜME GİT/);
  assert.match(entries.plugin, /get_the_post_thumbnail_url/);
});

test('manual test mail can explicitly use the safe one-time 90-day fallback', () => {
  assert.match(entries.cli, /in_array\(\$windowDays, \[30, 90\], true\)/);
  assert.match(entries.plugin, /send_test\(string \$recipient, int \$windowDays = 30\)/);
  assert.match(entries.plugin, /\$windowDays === 90 \? 90 : 30/);
  assert.match(entries.plugin, /90 GÜNLÜK TEST SEÇKİSİ/);
  assert.match(entries.plugin, /Manual newsletter tests are restricted to the configured test recipient/);
});

test('consent, encrypted addresses, language choice and unsubscribe are implemented', () => {
  assert.match(entries.plugin, /CONSENT_VERSION/);
  assert.match(entries.plugin, /sodium_crypto_secretbox/);
  assert.match(entries.plugin, /newsletter_operation" value="unsubscribe"/);
  assert.match(entries.plugin, /newsletter_operation" value="language"/);
  assert.match(entries.plugin, /List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
  assert.match(entries.plugin, /source_web = 1 OR source_erp = 1/);
});

test('ERP source is read only and never exports guests, banned users or tokens', () => {
  assert.match(entries.exporter, /BEGIN READ ONLY/);
  assert.match(entries.exporter, /identity\.provider = 'erp'/);
  assert.match(entries.exporter, /last_verified_at IS NOT NULL/);
  assert.doesNotMatch(entries.exporter, /access_token|refresh_token|password_hash/i);
  assert.match(entries.runner, /sync-erp/);
});

test('dedicated pause control cannot disable other mail systems', () => {
  assert.match(entries.pause, /RadioTEDU Monthly Podcast Newsletter/);
  assert.match(entries.pause, /newsletter-paused\.flag/);
  assert.doesNotMatch(entries.pause, /wp-mail-smtp|Disable.*SMTP|Stop-Service/i);
});

test('technology ribbon stays in email while the site exposes an accessible newsletter form', () => {
  assert.doesNotMatch(entries.header, /rt-technology-ribbon/);
  assert.match(entries.plugin, /RadioTEDU’nün teknolojisini keşfet!/);
  assert.match(entries.plugin, /'Discover RadioTEDU technology!'/);
  assert.match(entries.footer, /radiotedu_before_footer/);
  assert.match(entries.plugin, /type="email"/);
  assert.match(entries.plugin, /type="checkbox"[^>]+required/);
  assert.match(entries.js, /data-rt-newsletter-form/);
  assert.match(entries.css, /@media \(max-width: 620px\)/);
});

test('ERP-prefixed preference routes remain functional for non-ERP subscribers', () => {
  assert.match(entries.iis, /\^erp\/newsletter/);
  assert.match(entries.iis, /\^en\/erp\/newsletter/);
  assert.match(entries.iis, /rt_newsletter_manage=1/);
});
