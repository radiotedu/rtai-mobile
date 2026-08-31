<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__, 3) . '/wp-load.php';

if (!class_exists('RadioTEDU_Newsletter')) {
    fwrite(STDERR, "RadioTEDU newsletter plugin is not active.\n");
    exit(1);
}

$command = $argv[1] ?? 'status';
try {
    if ($command === 'install') {
        RadioTEDU_Newsletter::activate();
        echo "Newsletter schema ready.\n";
    } elseif ($command === 'sync-erp') {
        $rawPayload = (string) stream_get_contents(STDIN);
        $rawPayload = preg_replace('/^\xEF\xBB\xBF/', '', $rawPayload) ?? $rawPayload;
        $payload = json_decode($rawPayload, true, 512, JSON_THROW_ON_ERROR);
        $result = RadioTEDU_Newsletter::sync_erp(is_array($payload) ? $payload : []);
        echo 'ERP sync complete: ' . (int) ($result['seen'] ?? 0) . " verified identities.\n";
    } elseif ($command === 'run') {
        echo wp_json_encode(RadioTEDU_Newsletter::run_scheduled(), JSON_UNESCAPED_SLASHES), "\n";
    } elseif ($command === 'test') {
        $recipient = (string) ($argv[2] ?? '');
        $ok = RadioTEDU_Newsletter::send_test($recipient);
        echo $ok ? "Test message accepted by wp_mail.\n" : "Test message failed.\n";
        exit($ok ? 0 : 1);
    } elseif ($command === 'render-preview') {
        $language = ($argv[2] ?? 'tr') === 'en' ? 'en' : 'tr';
        $directory = 'C:/RadioTEDU/artifacts/newsletter';
        if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
            throw new RuntimeException('Could not create newsletter preview directory.');
        }
        $path = $directory . '/monthly-podcast-preview-' . $language . '.html';
        if (file_put_contents($path, RadioTEDU_Newsletter::render_preview_html($language), LOCK_EX) === false) {
            throw new RuntimeException('Could not write newsletter preview.');
        }
        echo $path, "\n";
    } elseif ($command === 'status') {
        echo wp_json_encode(RadioTEDU_Newsletter::status(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
    } else {
        fwrite(STDERR, "Unknown newsletter command.\n");
        exit(2);
    }
} catch (Throwable $error) {
    fwrite(STDERR, 'Newsletter command failed: ' . preg_replace('/[\r\n]+/', ' ', $error->getMessage()) . "\n");
    exit(1);
}
