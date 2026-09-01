<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only.\n");
    exit(2);
}

$options = getopt('', ['root:', 'email:']);
$root = isset($options['root']) ? rtrim((string) $options['root'], "\\/") : '';
$email = isset($options['email']) ? trim((string) $options['email']) : '';
$loader = $root !== '' ? $root . DIRECTORY_SEPARATOR . 'wp-load.php' : '';

if ($loader === '' || !is_file($loader) || $email === '') {
    fwrite(STDERR, json_encode(['error' => '--root and --email are required'], JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}

define('WP_USE_THEMES', false);
require_once $loader;

$user = get_user_by('email', $email);
$report = [
    'mode' => 'read-only',
    'email' => $email,
    'matches' => $user ? 1 : 0,
    'roles' => $user ? array_values((array) $user->roles) : [],
    'canManageOptions' => $user ? user_can($user, 'manage_options') : false,
];

echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
