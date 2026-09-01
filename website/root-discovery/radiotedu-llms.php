<?php

declare(strict_types=1);

$source = __DIR__ . DIRECTORY_SEPARATOR . 'llms-ai.txt';
if (!is_file($source) || !is_readable($source)) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo "RadioTEDU discovery brief is temporarily unavailable.\n";
    exit;
}

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
readfile($source);
