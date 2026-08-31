<?php
declare(strict_types=1);

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

const ARCHIVE_PAGE_SIZE = 100;
const ARCHIVE_EXTENSIONS = [
    'mp3' => 'audio/mpeg',
    'm4a' => 'audio/mp4',
    'aac' => 'audio/aac',
    'ogg' => 'audio/ogg',
    'opus' => 'audio/ogg',
    'flac' => 'audio/flac',
    'wav' => 'audio/wav',
    'mp4' => 'video/mp4',
];

function archive_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function archive_url(string $relativePath): string
{
    $segments = preg_split('~[\\\\/]+~', $relativePath) ?: [];
    return '/archive/media/' . implode('/', array_map('rawurlencode', $segments));
}

function archive_human_size(int $bytes): string
{
    if ($bytes < 1024) {
        return $bytes . ' B';
    }

    $units = ['KB', 'MB', 'GB'];
    $value = $bytes / 1024;
    foreach ($units as $unit) {
        if ($value < 1024 || $unit === 'GB') {
            return number_format($value, $value >= 10 ? 0 : 1, ',', '.') . ' ' . $unit;
        }
        $value /= 1024;
    }

    return number_format($value, 1, ',', '.') . ' GB';
}

function archive_title(string $filename): string
{
    $title = pathinfo($filename, PATHINFO_FILENAME);
    $title = preg_replace('/[_]+/u', ' ', $title) ?? $title;
    $title = preg_replace('/\s+/u', ' ', $title) ?? $title;
    return trim($title);
}

function archive_files(string $configuredRoot): array
{
    $root = realpath($configuredRoot);
    if ($root === false || !is_dir($root)) {
        return [];
    }

    $root = rtrim(str_replace('\\', '/', $root), '/');
    $prefix = $root . '/';
    $items = [];

    try {
        $directory = new RecursiveDirectoryIterator(
            $root,
            FilesystemIterator::SKIP_DOTS | FilesystemIterator::CURRENT_AS_FILEINFO
        );
        $iterator = new RecursiveIteratorIterator($directory, RecursiveIteratorIterator::LEAVES_ONLY);

        foreach ($iterator as $file) {
            if (!$file instanceof SplFileInfo || !$file->isFile() || $file->isLink()) {
                continue;
            }

            $extension = strtolower($file->getExtension());
            if (!isset(ARCHIVE_EXTENSIONS[$extension])) {
                continue;
            }

            $resolved = realpath($file->getPathname());
            if ($resolved === false) {
                continue;
            }

            $resolved = str_replace('\\', '/', $resolved);
            if (strncmp($resolved, $prefix, strlen($prefix)) !== 0) {
                continue;
            }

            $relative = substr($resolved, strlen($prefix));
            $directoryName = str_replace('\\', '/', dirname($relative));
            $items[] = [
                'title' => archive_title($file->getFilename()),
                'collection' => $directoryName === '.' ? 'Genel Arşiv' : str_replace('/', ' / ', $directoryName),
                'relative' => $relative,
                'url' => archive_url($relative),
                'mime' => ARCHIVE_EXTENSIONS[$extension],
                'size' => max(0, (int) $file->getSize()),
                'modified' => max(0, (int) $file->getMTime()),
            ];
        }
    } catch (UnexpectedValueException $exception) {
        error_log('RadioTEDU archive scan failed: ' . $exception->getMessage());
        return [];
    }

    usort($items, static function (array $left, array $right): int {
        return ($right['modified'] <=> $left['modified'])
            ?: strnatcasecmp($left['title'], $right['title']);
    });

    return $items;
}

$mediaRoot = getenv('RADIOTEDU_ARCHIVE_MEDIA_ROOT') ?: 'C:/RadioTEDU/archive-media';
$query = trim((string) ($_GET['q'] ?? ''));
$query = substr($query, 0, 120);
$requestedPage = filter_input(INPUT_GET, 'page', FILTER_VALIDATE_INT, [
    'options' => ['default' => 1, 'min_range' => 1],
]);
$page = is_int($requestedPage) ? $requestedPage : 1;
$allItems = archive_files($mediaRoot);

if ($query !== '') {
    $allItems = array_values(array_filter($allItems, static function (array $item) use ($query): bool {
        return stripos($item['title'] . ' ' . $item['collection'], $query) !== false;
    }));
}

$total = count($allItems);
$pageCount = max(1, (int) ceil($total / ARCHIVE_PAGE_SIZE));
$page = min($page, $pageCount);
$items = array_slice($allItems, ($page - 1) * ARCHIVE_PAGE_SIZE, ARCHIVE_PAGE_SIZE);

function archive_page_href(int $page, string $query): string
{
    $parameters = ['page' => $page];
    if ($query !== '') {
        $parameters['q'] = $query;
    }
    return '/archive/?' . http_build_query($parameters);
}
?>
<!doctype html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Yayın Arşivi | RadioTEDU</title>
    <meta name="description" content="RadioTEDU geçmiş yayın arşivi. Kayıtlar yalnızca dinlemek istediğinizde yüklenir.">
    <meta name="theme-color" content="#f4f1ea">
    <link rel="canonical" href="https://radiotedu.com/archive/">
    <link rel="stylesheet" href="/archive/archive.css">
</head>
<body>
    <header class="site-header">
        <a class="wordmark" href="/" aria-label="RadioTEDU ana sayfa">
            <span>RADIO</span><strong>TEDU</strong>
        </a>
        <div class="header-rule" aria-hidden="true"></div>
        <span class="section-name">YAYIN ARŞİVİ</span>
        <a class="home-link" href="/">Ana site</a>
    </header>

    <main>
        <section class="archive-intro" aria-labelledby="archive-title">
            <p class="eyebrow">RADYONUN HAFIZASI</p>
            <h1 id="archive-title">Geçmiş yayınlar,<br>istediğin anda.</h1>
            <p class="intro-copy">RadioTEDU'nun eski programları ve özel yayınları burada yaşayacak. Hiçbir kayıt otomatik başlamaz veya sayfa açılırken indirilmez.</p>
            <dl class="archive-principles">
                <div><dt>YÜKLEME</dt><dd>Yalnızca oynat düğmesiyle</dd></div>
                <div><dt>SAKLAMA</dt><dd>Ana siteden bağımsız</dd></div>
                <div><dt>ÖNBELLEK</dt><dd>Kapalı</dd></div>
            </dl>
        </section>

        <section class="archive-catalogue" aria-labelledby="catalogue-title">
            <div class="catalogue-heading">
                <div>
                    <p class="section-index">01 / ARŞİV</p>
                    <h2 id="catalogue-title">Yayın kayıtları</h2>
                </div>
                <?php if ($total > 0 || $query !== ''): ?>
                    <form class="archive-search" method="get" action="/archive/" role="search">
                        <label for="archive-query">Arşivde ara</label>
                        <div class="search-row">
                            <input id="archive-query" name="q" type="search" maxlength="120" value="<?= archive_escape($query) ?>" placeholder="Program veya seri adı">
                            <button type="submit">Ara</button>
                        </div>
                    </form>
                <?php endif; ?>
            </div>

            <div id="archive-player" class="archive-player" hidden aria-live="polite">
                <div>
                    <span class="player-label">ŞİMDİ DİNLENİYOR</span>
                    <strong id="archive-player-title"></strong>
                </div>
                <div id="archive-audio-slot"></div>
            </div>

            <?php if ($total === 0 && $query === ''): ?>
                <div class="empty-state">
                    <span class="empty-number" aria-hidden="true">00</span>
                    <div>
                        <h3>Arşiv rafı hazırlanıyor.</h3>
                        <p>Eski yayınlar yüklendiğinde klasörlerine göre burada otomatik olarak listelenecek.</p>
                    </div>
                </div>
            <?php elseif ($total === 0): ?>
                <div class="empty-state">
                    <span class="empty-number" aria-hidden="true">0</span>
                    <div>
                        <h3>Bu aramayla eşleşen kayıt yok.</h3>
                        <p><a href="/archive/">Tüm yayın kayıtlarına dön.</a></p>
                    </div>
                </div>
            <?php else: ?>
                <p class="result-count"><?= number_format($total, 0, ',', '.') ?> kayıt</p>
                <ol class="archive-list" start="<?= (($page - 1) * ARCHIVE_PAGE_SIZE) + 1 ?>">
                    <?php foreach ($items as $item): ?>
                        <li class="archive-entry">
                            <span class="entry-number" aria-hidden="true"><?= str_pad((string) ((($page - 1) * ARCHIVE_PAGE_SIZE) + array_search($item, $items, true) + 1), 2, '0', STR_PAD_LEFT) ?></span>
                            <div class="entry-copy">
                                <h3><?= archive_escape($item['title']) ?></h3>
                                <p><?= archive_escape($item['collection']) ?></p>
                            </div>
                            <time datetime="<?= date('c', $item['modified']) ?>"><?= date('d.m.Y', $item['modified']) ?></time>
                            <span class="entry-size"><?= archive_escape(archive_human_size($item['size'])) ?></span>
                            <button class="archive-play" type="button" data-archive-src="<?= archive_escape($item['url']) ?>" data-archive-mime="<?= archive_escape($item['mime']) ?>" data-archive-title="<?= archive_escape($item['title']) ?>" aria-label="<?= archive_escape($item['title']) ?> kaydını oynat">
                                Oynat
                            </button>
                        </li>
                    <?php endforeach; ?>
                </ol>

                <?php if ($pageCount > 1): ?>
                    <nav class="pagination" aria-label="Arşiv sayfaları">
                        <?php if ($page > 1): ?><a href="<?= archive_escape(archive_page_href($page - 1, $query)) ?>">Önceki</a><?php endif; ?>
                        <span><?= $page ?> / <?= $pageCount ?></span>
                        <?php if ($page < $pageCount): ?><a href="<?= archive_escape(archive_page_href($page + 1, $query)) ?>">Sonraki</a><?php endif; ?>
                    </nav>
                <?php endif; ?>
            <?php endif; ?>
        </section>
    </main>

    <footer>
        <p><strong>RadioTEDU Ankara Stüdyoları</strong><br>Ziya Gökalp Caddesi No:48, 06420 Kolej, Çankaya, Ankara</p>
        <p>TED Üniversitesi'nin öğrenci radyosu.</p>
    </footer>
    <script src="/archive/archive.js" defer></script>
</body>
</html>
