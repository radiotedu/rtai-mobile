import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const theme = join(root, 'website', 'wordpress-overlay', 'wp-content', 'themes', 'radiotedu');
const plugin = join(root, 'website', 'wordpress-overlay', 'wp-content', 'plugins', 'radiotedu-core', 'includes', 'class-radiotedu-rest.php');
const metadataClock = join(root, 'ops', 'website', 'live-metadata-clock.ps1');
const read = (path) => readFileSync(path, 'utf8');

test('live player exposes larger manually scrollable lyrics without an API key', () => {
    const script = read(join(theme, 'assets', 'js', 'app.js'));
    const player = read(join(theme, 'template-parts', 'player.php'));
    const styles = read(join(theme, 'assets', 'css', 'app.css'));
    const rest = read(plugin);

    assert.match(script, /https:\/\/lrclib\.net\/api\/search/);
    assert.match(script, /parseLyrics/);
    assert.match(script, /lyricsLookupIdentity/);
    assert.match(script, /lyricsSearchRequests/);
    assert.match(script, /searchLyrics/);
    assert.match(script, /track_name: request\.track/);
    assert.match(script, /candidate\.plainLyrics \|\| candidate\.syncedLyrics/);
    assert.match(script, /replaceChildren\(fragment\)/);
    assert.doesNotMatch(script, /setInterval\(renderLyrics/);
    assert.doesNotMatch(script, /recalibrateLyricsClock|estimatedLivePlaybackLag|sampledLyricsClock/);
    assert.match(script, /lyricsDismissedTrackKey/);
    assert.match(script, /isLofiStation\(\)/);
    assert.match(player, /data-rt-player-lyrics hidden/);
    assert.match(player, /data-rt-lyrics-lines tabindex="0" role="region"/);
    assert.match(player, /data-rt-lyrics-close/);
    assert.match(player, /https:\/\/lrclib\.net/);
    assert.match(styles, /width: min\(780px, calc\(100vw - 32px\)\)/);
    assert.match(styles, /overflow-y: auto/);
    assert.match(styles, /overscroll-behavior: contain/);
    assert.match(styles, /max-height: min\(50dvh, 360px\)/);
    assert.match(rest, /'track_started_at' => null/);
    assert.match(rest, /rt_track_clock_/);
    assert.match(rest, /time\(\) - 2/);
    assert.match(rest, /get_param\('clock'\)/);
    assert.match(rest, /\$clockOnly \? 2 : 5/);
    assert.match(rest, /normalize_metadata_text/);
    assert.match(rest, /Windows-1254/);
    assert.match(read(metadataClock), /live\?clock=1/);
    assert.match(read(metadataClock), /radiotedu-spark/);
});

test('playlists route contains every non-empty public RadioTEDU playlist', () => {
    const page = read(join(theme, 'page-listeler.php'));
    const functions = read(join(theme, 'functions.php'));
    const header = read(join(theme, 'header.php'));
    const ids = [...page.matchAll(/\['id' => '([A-Za-z0-9]+)'/g)].map((match) => match[1]);

    assert.equal(ids.length, 23);
    assert.equal(new Set(ids).size, 23);
    assert.ok(!ids.includes('662HYAxPWv3BDwtt0gCTc9'), 'empty Classical playlist must stay excluded');
    assert.equal((page.match(/'tr' =>/g) || []).length, 23);
    assert.equal((page.match(/'en' =>/g) || []).length, 23);
    assert.match(page, /open\.spotify\.com\/embed\/playlist/);
    assert.match(page, /loading="lazy"/);
    assert.match(functions, /\['listeler', 'en\/playlists'\]/);
    assert.match(functions, /page-listeler\.php/);
    assert.match(header, /home_url\('\/listeler\/'\)/);
    assert.match(header, /Listeler/);
});

test('playlists copy and English site chrome are localized', () => {
    const page = read(join(theme, 'page-listeler.php'));
    const functions = read(join(theme, 'functions.php'));
    const player = read(join(theme, 'template-parts', 'player.php'));

    assert.match(page, /Kolejin ritminden gece kampüs koridorlarına; RadioTEDU seçkileri anlar, mevsimler ve hikâyeler için hazırlandı\./);
    assert.match(page, /From the rhythm of Kolej to late-night campus corridors, RadioTEDU selections are curated for moments, seasons, and stories\./);
    assert.match(functions, /'Radyolar' => 'Stations'/);
    assert.match(functions, /'Menü' => 'Menu'/);
    assert.match(functions, /'Şarkıyı satın al' => 'Buy this track'/);
    assert.match(player, /RadioTEDU oynatıcı/);
    assert.match(player, /Bir kanal seç ve dinlemeye başla/);
    assert.doesNotMatch(player, /Ä|Å|â(?:€™|ˆ|€)/);
});
