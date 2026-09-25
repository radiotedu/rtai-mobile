<?php
declare(strict_types=1);

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function rt_mcp_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

function rt_mcp_error(mixed $id, int $code, string $message, int $status = 200): never
{
    rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'error' => ['code' => $code, 'message' => $message]], $status);
}

function rt_fetch_internal_json(string $url, array $headers = ['Accept: application/json']): ?array
{
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 4,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    $body = curl_exec($handle);
    $httpStatus = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);

    if (!is_string($body) || strlen($body) > 262144 || $httpStatus !== 200) {
        return null;
    }
    try {
        $data = json_decode($body, true, 32, JSON_THROW_ON_ERROR);
        return is_array($data) ? $data : null;
    } catch (JsonException) {
        return null;
    }
}

function rt_erp_hmac_request(string $method, string $laravelPath, array $payload = []): ?array
{
    $secretPath = 'C:\\inetpub\\wwwroot\\erp_app\\storage\\app\\ecosystem-secret';
    if (!is_file($secretPath) || !is_readable($secretPath)) {
        return null;
    }
    $secret = trim((string) file_get_contents($secretPath));
    if ($secret === '') {
        return null;
    }

    $timestamp = (string) time();
    $bodyString = !empty($payload) ? json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : '';
    $bodyHash = hash('sha256', $bodyString);
    $canonical = implode("\n", [$timestamp, strtoupper($method), $laravelPath, $bodyHash]);
    $signature = hash_hmac('sha256', $canonical, $secret);

    $url = 'http://127.0.0.1/erp' . $laravelPath;
    $handle = curl_init($url);
    $headers = [
        'Accept: application/json',
        'X-RT-Timestamp: ' . $timestamp,
        'X-RT-Signature: ' . $signature,
    ];
    if (strtoupper($method) === 'POST') {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($handle, CURLOPT_POSTFIELDS, $bodyString);
    }
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => $headers,
    ]);

    $response = curl_exec($handle);
    $httpCode = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);

    if (!is_string($response) || $response === '') {
        return null;
    }
    try {
        $json = json_decode($response, true, 32, JSON_THROW_ON_ERROR);
        return [
            'http_code' => $httpCode,
            'data' => $json,
        ];
    } catch (JsonException) {
        return null;
    }
}

function rt_mcp_tool_success(mixed $id, mixed $data, string $sourceUrl, string $freshness = 'request-time'): never
{
    $encoded = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    rt_mcp_json([
        'jsonrpc' => '2.0',
        'id' => $id,
        'result' => [
            'content' => [['type' => 'text', 'text' => $encoded]],
            'structuredContent' => $data,
            '_meta' => [
                'retrieved_at' => gmdate('c'),
                'timezone' => 'Europe/Istanbul',
                'source_url' => $sourceUrl,
                'freshness' => $freshness,
                'source_stale' => is_array($data) && array_key_exists('stale', $data) ? (bool) $data['stale'] : null,
            ],
        ],
    ]);
}

function rt_mcp_tool_failure(mixed $id, string $code, string $message): never
{
    rt_mcp_json([
        'jsonrpc' => '2.0',
        'id' => $id,
        'result' => [
            'content' => [['type' => 'text', 'text' => $message]],
            'isError' => true,
            '_meta' => [
                'error_code' => $code,
                'retrieved_at' => gmdate('c'),
                'timezone' => 'Europe/Istanbul',
            ],
        ],
    ]);
}

function rt_mcp_tool_title(string $name): string
{
    return match ($name) {
        'get_station_status' => 'AI station status',
        'get_stations' => 'RadioTEDU stations',
        'get_now_playing' => 'Now playing',
        'get_broadcast_schedule' => 'Broadcast schedule',
        'get_podcasts' => 'RadioTEDU podcasts',
        'search_content' => 'Search RadioTEDU content',
        'get_focus_presets' => 'Focus presets',
        'check_studio_availability' => 'Studio availability',
        'book_studio_slot' => 'Book a studio slot',
        default => $name,
    };
}

function rt_mcp_tool_output_schema(string $name): array
{
    $string = ['type' => 'string'];
    $nullableString = ['type' => ['string', 'null']];
    $integer = ['type' => 'integer'];
    $nullableInteger = ['type' => ['integer', 'null']];
    $boolean = ['type' => 'boolean'];
    $openObject = ['type' => 'object', 'additionalProperties' => true];

    return match ($name) {
        'get_station_status' => [
            'type' => 'object',
            'properties' => [
                'protocol' => $string,
                'station_id' => $string,
                'online' => $boolean,
                'stale' => $boolean,
                'received_at' => $string,
                'snapshot' => $openObject,
                'metrics' => $openObject,
            ],
            'additionalProperties' => true,
        ],
        'get_stations' => [
            'type' => 'array',
            'items' => [
                'type' => 'object',
                'properties' => [
                    'id' => $string,
                    'title' => $string,
                    'description' => $string,
                    'url' => $string,
                    'artwork' => $nullableString,
                    'streams' => $openObject,
                    'online' => $boolean,
                    'featured' => $boolean,
                ],
                'additionalProperties' => true,
            ],
        ],
        'get_now_playing' => [
            'type' => 'object',
            'properties' => [
                'station_id' => $string,
                'online' => $boolean,
                'stale' => $boolean,
                'stream_url' => $nullableString,
                'title' => $nullableString,
                'track' => $nullableString,
                'artist' => $nullableString,
                'track_started_at' => $nullableString,
                'listeners' => $nullableInteger,
                'artwork_url' => $nullableString,
                'checked_at' => $string,
                'received_at' => $string,
                'snapshot' => $openObject,
                'metrics' => $openObject,
            ],
            'additionalProperties' => true,
        ],
        'get_broadcast_schedule' => [
            'type' => 'array',
            'items' => [
                'type' => 'object',
                'properties' => [
                    'id' => $integer,
                    'weekday' => $integer,
                    'start' => $string,
                    'end' => $string,
                    'program' => [
                        'type' => 'object',
                        'properties' => ['id' => $string, 'title' => $string, 'url' => $string, 'presenters' => $string],
                        'additionalProperties' => true,
                    ],
                ],
                'additionalProperties' => true,
            ],
        ],
        'get_podcasts' => [
            'type' => 'array',
            'items' => [
                'type' => 'object',
                'properties' => [
                    'id' => $string,
                    'title' => $string,
                    'description' => $string,
                    'url' => $string,
                    'image' => $nullableString,
                    'hosts' => $string,
                    'spotify_url' => $nullableString,
                    'featured' => $boolean,
                ],
                'additionalProperties' => true,
            ],
        ],
        'search_content' => [
            'type' => 'object',
            'properties' => [
                'items' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'id' => $string,
                            'type' => $string,
                            'title' => $string,
                            'excerpt' => $string,
                            'url' => $string,
                            'image' => $nullableString,
                        ],
                        'additionalProperties' => true,
                    ],
                ],
                'total' => $integer,
                'page' => $integer,
                'per_page' => $integer,
                'total_pages' => $integer,
                'has_more' => $boolean,
                'next_page' => $nullableInteger,
                'applied_filters' => [
                    'type' => 'object',
                    'properties' => ['type' => $nullableString],
                    'additionalProperties' => false,
                ],
            ],
            'additionalProperties' => true,
        ],
        'get_focus_presets' => $openObject,
        'check_studio_availability' => [
            'type' => 'object',
            'properties' => [
                'studios' => ['type' => 'array', 'items' => $openObject],
                'availability' => $openObject,
                'booking_rules' => $openObject,
                'privacy' => $openObject,
            ],
            'additionalProperties' => true,
        ],
        'book_studio_slot' => [
            'type' => 'object',
            'properties' => [
                'status' => ['type' => 'string', 'enum' => ['created']],
                'booking_id' => ['type' => ['string', 'integer', 'null']],
                'studio' => $string,
                'starts_at' => $string,
                'ends_at' => $string,
                'timezone' => ['type' => 'string', 'const' => 'Europe/Istanbul'],
                'idempotent_replay' => $boolean,
                'idempotency_protected' => $boolean,
            ],
            'additionalProperties' => true,
        ],
        default => $openObject,
    };
}

function rt_mcp_focus_presets(): array
{
    return [
        'base_url' => 'https://radiotedu.com/focus/',
        'channels' => [
            ['id' => 'lofi', 'name' => 'Lo-Fi Focus', 'stream_url' => 'https://stream.radiotedu.com/lofi', 'description' => 'Beats to study, code and concentrate.'],
            ['id' => 'jazz', 'name' => 'Smooth Jazz', 'stream_url' => 'https://stream.radiotedu.com/cazz', 'description' => 'Warm instrumental jazz for reading and relaxed flow.'],
            ['id' => 'classical', 'name' => 'Classical Clarity', 'stream_url' => 'https://stream.radiotedu.com/classic', 'description' => 'Timeless orchestral masterpieces for deep academic concentration.'],
        ],
        'ambient_sound_layers' => ['rain', 'fire', 'wind', 'ocean', 'birds', 'thunder', 'crickets'],
        'recommended_presets' => [
            ['id' => 'deep_coding', 'title' => 'Derin Kodlama & Gece Çalışması', 'channel' => 'lofi', 'ambient_mix' => ['rain' => 50, 'fire' => 30], 'pomodoro' => ['work' => 25, 'break' => 5], 'launch_url' => 'https://radiotedu.com/focus/?channel=lofi'],
            ['id' => 'academic_reading', 'title' => 'Akademik Okuma & Makale Yazımı', 'channel' => 'classical', 'ambient_mix' => ['ocean' => 35, 'birds' => 20], 'pomodoro' => ['work' => 45, 'break' => 10], 'launch_url' => 'https://radiotedu.com/focus/?channel=classical'],
            ['id' => 'coffee_break', 'title' => 'Kahve Molası & Yaratıcı Akış', 'channel' => 'jazz', 'ambient_mix' => ['rain' => 40, 'crickets' => 20], 'pomodoro' => ['work' => 20, 'break' => 5], 'launch_url' => 'https://radiotedu.com/focus/?channel=jazz'],
        ],
    ];
}

function rt_mcp_public_studio_summary(array $dashboard): array
{
    $studios = [];
    foreach (is_array($dashboard['studios'] ?? null) ? $dashboard['studios'] : [] as $studio) {
        if (!is_array($studio)) {
            continue;
        }
        $publicStudio = [];
        foreach (['id', 'name', 'capacity', 'is_active', 'active'] as $key) {
            if (isset($studio[$key]) && (is_string($studio[$key]) || is_int($studio[$key]) || is_bool($studio[$key]))) {
                $publicStudio[$key] = $studio[$key];
            }
        }
        if (!isset($publicStudio['name']) && isset($studio['title']) && is_string($studio['title'])) {
            $publicStudio['name'] = $studio['title'];
        }
        if ($publicStudio !== []) {
            $studios[] = $publicStudio;
        }
    }

    $peopleInside = is_array($dashboard['people_inside'] ?? null) ? $dashboard['people_inside'] : [];
    $reservations = is_array($dashboard['reservations'] ?? null) ? $dashboard['reservations'] : [];

    return [
        'studios' => $studios,
        'availability' => [
            'occupied_now' => count($peopleInside) > 0,
            'has_reservations_today' => count($reservations) > 0,
        ],
        'booking_rules' => [
            'identity' => 'Authenticated RadioTEDU ERP account required',
            'email_domain' => '@tedu.edu.tr',
            'days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            'time_windows' => [['start' => '10:00', 'end' => '12:00'], ['start' => '13:00', 'end' => '16:00']],
            'slot_minutes' => 30,
            'maximum_attendees' => 5,
        ],
        'privacy' => [
            'identifying_details_included' => false,
            'omitted' => ['occupant names', 'contact details', 'individual reservation records'],
        ],
    ];
}

function rt_mcp_wp_search(string $query, int $page, int $perPage, ?string $type): ?array
{
    $allowedTypes = ['rt_station', 'rt_program', 'rt_podcast_show', 'rt_podcast_episode', 'post', 'page'];
    if ($type !== null && !in_array($type, $allowedTypes, true)) {
        return null;
    }
    $subtypes = $type ?? implode(',', $allowedTypes);
    $url = 'http://127.0.0.1/wp-json/wp/v2/search?' . http_build_query([
        'search' => $query,
        'page' => $page,
        'per_page' => $perPage,
        'subtype' => $subtypes,
        '_fields' => 'id,title,url,type,subtype',
    ]);
    $responseHeaders = [];
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_HEADERFUNCTION => static function ($curlHandle, string $line) use (&$responseHeaders): int {
            $length = strlen($line);
            $parts = explode(':', $line, 2);
            if (count($parts) === 2) {
                $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
            }
            return $length;
        },
    ]);
    $body = curl_exec($handle);
    $httpStatus = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    if (!is_string($body) || $httpStatus !== 200 || strlen($body) > 262144) {
        return null;
    }
    try {
        $items = json_decode($body, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return null;
    }
    if (!is_array($items)) {
        return null;
    }
    return [
        'items' => $items,
        'total' => max(0, (int) ($responseHeaders['x-wp-total'] ?? 0)),
        'total_pages' => max(0, (int) ($responseHeaders['x-wp-totalpages'] ?? 0)),
    ];
}

function rt_mcp_bearer_token(): ?string
{
    $authorization = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? $_SERVER['Authorization'] ?? '');
    if ($authorization === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp((string) $name, 'Authorization') === 0) {
                $authorization = (string) $value;
                break;
            }
        }
    }
    if (!preg_match('/^Bearer\s+([^\s]+)$/i', trim($authorization), $matches)) {
        return null;
    }
    $token = $matches[1];
    return strlen($token) <= 4096 ? $token : null;
}

function rt_mcp_erp_profile(string $bearerToken): ?array
{
    $profile = rt_fetch_internal_json('http://127.0.0.1/erp/api/sso/v1/me', [
        'Accept: application/json',
        'Authorization: Bearer ' . $bearerToken,
    ]);
    if (is_array($profile['data'] ?? null)) {
        $profile = $profile['data'];
    }
    if (!is_array($profile)
        || !is_string($profile['sub'] ?? null)
        || !is_string($profile['name'] ?? null)
        || !is_string($profile['email'] ?? null)) {
        return null;
    }
    $subject = trim($profile['sub']);
    $name = trim($profile['name']);
    $email = strtolower(trim($profile['email']));
    if ($subject === '' || strlen($subject) > 191 || $name === '' || strlen($name) > 255
        || !filter_var($email, FILTER_VALIDATE_EMAIL)
        || !str_ends_with($email, '@tedu.edu.tr') || $email === '@tedu.edu.tr') {
        return null;
    }
    return ['sub' => $subject, 'name' => $name, 'email' => $email];
}

function rt_mcp_parse_studio_datetime(string $value): ?DateTimeImmutable
{
    if (strlen($value) > 64 || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})?$/', $value)) {
        return null;
    }
    $timezone = new DateTimeZone('Europe/Istanbul');
    try {
        if (preg_match('/(?:Z|[+-]\d{2}:\d{2})$/', $value)) {
            return (new DateTimeImmutable($value))->setTimezone($timezone);
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s', $value, $timezone);
        $errors = DateTimeImmutable::getLastErrors();
        return $date !== false && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0)) ? $date : null;
    } catch (Throwable) {
        return null;
    }
}

function rt_mcp_idempotency_cleanup(string $directory): void
{
    $cleanupHandle = @fopen($directory . DIRECTORY_SEPARATOR . '.cleanup.lock', 'c+b');
    if (!is_resource($cleanupHandle) || !flock($cleanupHandle, LOCK_EX)) {
        if (is_resource($cleanupHandle)) {
            fclose($cleanupHandle);
        }
        return;
    }
    $now = time();
    foreach (glob($directory . DIRECTORY_SEPARATOR . '*.json') ?: [] as $path) {
        $handle = @fopen($path, 'c+b');
        if (!is_resource($handle) || !flock($handle, LOCK_EX | LOCK_NB)) {
            if (is_resource($handle)) {
                fclose($handle);
            }
            continue;
        }
        rewind($handle);
        $stored = stream_get_contents($handle);
        $record = is_string($stored) && $stored !== '' ? json_decode($stored, true) : null;
        $expired = !is_array($record) || (int) ($record['expires_at'] ?? 0) <= $now;
        flock($handle, LOCK_UN);
        fclose($handle);
        if ($expired) {
            @unlink($path);
        }
    }
    flock($cleanupHandle, LOCK_UN);
    fclose($cleanupHandle);
}

function rt_mcp_idempotency_begin(string $key, string $fingerprint): array
{
    $directory = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'radiotedu-mcp-idempotency';
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        return ['state' => 'unavailable'];
    }
    if (!is_writable($directory)) {
        return ['state' => 'unavailable'];
    }
    rt_mcp_idempotency_cleanup($directory);
    $path = $directory . DIRECTORY_SEPARATOR . hash('sha256', $key) . '.json';
    $handle = @fopen($path, 'c+b');
    if (!is_resource($handle)) {
        return ['state' => 'unavailable'];
    }
    if (!flock($handle, LOCK_EX | LOCK_NB)) {
        fclose($handle);
        return ['state' => 'in_progress'];
    }
    rewind($handle);
    $stored = stream_get_contents($handle);
    $record = is_string($stored) && $stored !== '' ? json_decode($stored, true) : null;
    if (is_array($record) && (int) ($record['expires_at'] ?? 0) > time()) {
        if (!hash_equals((string) ($record['fingerprint'] ?? ''), $fingerprint)) {
            flock($handle, LOCK_UN);
            fclose($handle);
            return ['state' => 'conflict'];
        }
        if (($record['state'] ?? '') === 'complete' && is_array($record['response'] ?? null)) {
            flock($handle, LOCK_UN);
            fclose($handle);
            return ['state' => 'replay', 'response' => $record['response']];
        }
        flock($handle, LOCK_UN);
        fclose($handle);
        return ['state' => 'in_progress'];
    }
    $pending = ['state' => 'processing', 'fingerprint' => $fingerprint, 'expires_at' => time() + 900];
    $encoded = json_encode($pending, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    rewind($handle);
    if (!ftruncate($handle, 0) || fwrite($handle, $encoded) === false || !fflush($handle)) {
        flock($handle, LOCK_UN);
        fclose($handle);
        @unlink($path);
        return ['state' => 'unavailable'];
    }
    return ['state' => 'new', 'path' => $path, 'handle' => $handle, 'fingerprint' => $fingerprint];
}

function rt_mcp_idempotency_complete(array $guard, array $response): bool
{
    if (!is_resource($guard['handle'] ?? null)) {
        return false;
    }
    $encoded = json_encode([
        'state' => 'complete',
        'fingerprint' => (string) ($guard['fingerprint'] ?? ''),
        'expires_at' => time() + 900,
        'response' => $response,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $handle = $guard['handle'];
    rewind($handle);
    $written = is_string($encoded) && ftruncate($handle, 0) && fwrite($handle, $encoded) !== false && fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return (bool) $written;
}

function rt_mcp_idempotency_abort(array $guard): void
{
    if (is_resource($guard['handle'] ?? null)) {
        $handle = $guard['handle'];
        $path = (string) ($guard['path'] ?? '');
        ftruncate($handle, 0);
        fflush($handle);
        flock($handle, LOCK_UN);
        fclose($handle);
        if ($path !== '') {
            @unlink($path);
        }
    }
}

$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '' && $origin !== 'https://radiotedu.com') {
    http_response_code(403);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    exit;
}
if (!str_contains((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) {
    http_response_code(415);
    exit;
}
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 16384) {
    http_response_code(413);
    exit;
}
$raw = file_get_contents('php://input', false, null, 0, 16385);
if (!is_string($raw) || strlen($raw) > 16384) {
    http_response_code(413);
    exit;
}
try {
    $request = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    rt_mcp_error(null, -32700, 'Parse error', 400);
}
if (!is_array($request) || array_is_list($request) || ($request['jsonrpc'] ?? null) !== '2.0') {
    rt_mcp_error(null, -32600, 'Invalid Request', 400);
}
$id = $request['id'] ?? null;
if ($id !== null && !is_int($id) && !is_string($id)) {
    rt_mcp_error(null, -32600, 'Invalid request id', 400);
}
$method = $request['method'] ?? null;
if (!is_string($method)) {
    rt_mcp_error($id, -32600, 'Invalid method', 400);
}
if ($id === null) {
    if ($method === 'notifications/initialized') {
        http_response_code(202);
        exit;
    }
    rt_mcp_error(null, -32600, 'Unsupported notification', 400);
}

switch ($method) {
    case 'initialize':
        rt_mcp_json([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => [
                'protocolVersion' => '2025-06-18',
                'capabilities' => [
                    'tools' => ['listChanged' => false],
                    'resources' => ['subscribe' => false, 'listChanged' => false],
                    'prompts' => ['listChanged' => false],
                ],
                'serverInfo' => ['name' => 'radiotedu-public-radio', 'version' => '1.3.0'],
                'instructions' => 'RadioTEDU public radio and editorial information is available without an account. Studio availability responses omit occupant identities and individual reservation details. Studio booking is state-changing: it requires an ERP-issued bearer token, a valid authorized TED University account, a reusable idempotency key, and explicit user confirmation. Booking responses never include the requester name or contact details. Search queries may be written in Turkish, English, or French; results include canonical source links and page metadata.',
            ],
        ]);

    case 'tools/list':
        $tools = [
                [
                    'name' => 'get_station_status',
                    'description' => 'Get the current public status of a RadioTEDU English or French AI station.',
                    'inputSchema' => [
                        'type' => 'object',
                        'properties' => ['station' => ['type' => 'string', 'enum' => ['radiotedu-en', 'radiotedu-fr']]],
                        'required' => ['station'],
                        'additionalProperties' => false,
                    ],
                    'annotations' => ['readOnlyHint' => true],
                ],
                [
                    'name' => 'get_stations',
                    'description' => 'List all active RadioTEDU radio stations (Main Turkish radio, AI stations, Lo-Fi, Jazz, Classic, Rock, Energize, Main Character) with streams and metadata.',
                    'inputSchema' => [
                        'type' => 'object',
                        'properties' => (object) [],
                        'additionalProperties' => false,
                    ],
                    'annotations' => ['readOnlyHint' => true],
                ],
                [
                    'name' => 'get_now_playing',
                    'description' => 'Get current live now-playing track, artist, artwork, and playback metadata for a RadioTEDU station.',
                    'inputSchema' => [
                        'type' => 'object',
                        'properties' => [
                            'station_id' => [
                                'type' => 'string',
                                'description' => 'Station ID (e.g. radiotedu-main, radiotedu-lofi, radiotedu-jazz, radiotedu-classic, radiotedu-rock, radiotedu-spark, radiotedu-ai-en, radiotedu-ai-fr). Defaults to radiotedu-main.',
                                'default' => 'radiotedu-main',
                            ],
                        ],
                        'additionalProperties' => false,
                    ],
                    'annotations' => ['readOnlyHint' => true],
                ],
                [
                    'name' => 'get_broadcast_schedule',
                    'description' => 'Get the live broadcast program schedule and student DJ shows for RadioTEDU.',
                    'inputSchema' => [
                        'type' => 'object',
                        'properties' => [
                            'station_id' => [
                                'type' => 'string',
                                'description' => 'Station ID (defaults to radiotedu-main).',
                                'default' => 'radiotedu-main',
                            ],
                        ],
                        'additionalProperties' => false,
                    ],
                    'annotations' => ['readOnlyHint' => true],
                ],
                [
                    'name' => 'get_podcasts',
                    'description' => 'List public podcast series produced by RadioTEDU and TED University.',
                    'inputSchema' => [
                        'type' => 'object',
                        'properties' => (object) [],
                        'additionalProperties' => false,
                    ],
                    'annotations' => ['readOnlyHint' => true],
                ],
                [
                    'name' => 'search_content',
                    'description' => 'Search published RadioTEDU stations, programs, podcasts, posts, and pages. Enter the query in Turkish, English, or French. Results include canonical links, an optional content-type filter, and page metadata.',
                    'inputSchema' => [
                        'type' => 'object',
                        'properties' => [
                            'query' => [
                                'type' => 'string',
                                'minLength' => 1,
                                'maxLength' => 200,
                                'description' => 'Search query in Turkish, English, or French.',
                            ],
                            'type' => [
                                'type' => 'string',
                                'enum' => ['rt_station', 'rt_program', 'rt_podcast_show', 'rt_podcast_episode', 'post', 'page'],
                                'description' => 'Optional WordPress content subtype filter.',
                            ],
                            'page' => [
                                'type' => 'integer',
                                'minimum' => 1,
                                'maximum' => 1000,
                                'default' => 1,
                                'description' => 'One-based result page.',
                            ],
                            'per_page' => [
                                'type' => 'integer',
                                'minimum' => 1,
                                'maximum' => 50,
                                'default' => 20,
                                'description' => 'Maximum results to return on this page.',
                            ],
                        ],
                        'required' => ['query'],
                        'additionalProperties' => false,
                    ],
                    'annotations' => ['readOnlyHint' => true],
                ],
                [
                    'name' => 'get_focus_presets',
                    'description' => 'Get RadioTEDU Focus channels (Lo-Fi, Jazz, Classical), ambient nature sound options (rain, fire, ocean, etc.), and curated Pomodoro study presets.',
                    'inputSchema' => [
                        'type' => 'object',
                        'properties' => (object) [],
                        'additionalProperties' => false,
                    ],
                    'annotations' => ['readOnlyHint' => true],
                ],
                [
                    'name' => 'check_studio_availability',
                    'description' => 'Check RadioTEDU studio availability and booking rules. Public results include room metadata and aggregate status only; occupant identities, contact details, and individual reservation records are never returned.',
                    'inputSchema' => [
                        'type' => 'object',
                        'properties' => (object) [],
                        'additionalProperties' => false,
                    ],
                    'annotations' => ['readOnlyHint' => true],
                ],
                [
                    'name' => 'book_studio_slot',
                    'description' => 'State-changing action: create a RadioTEDU studio reservation. Requires an ERP-issued Bearer token with active application access, an explicit user confirmation, and an idempotency key reused for retries. The authenticated ERP profile supplies the requester identity; do not provide names, emails, or phone numbers in tool arguments.',
                    'inputSchema' => [
                        'type' => 'object',
                        'properties' => [
                            'starts_at' => [
                                'type' => 'string',
                                'description' => 'Start date and time as ISO 8601. Naive date-times are interpreted in Europe/Istanbul. Must follow the published weekday booking windows and 30-minute slots.',
                            ],
                            'ends_at' => [
                                'type' => 'string',
                                'description' => 'End date and time as ISO 8601, on the same Europe/Istanbul date as starts_at.',
                            ],
                            'attendee_count' => [
                                'type' => 'integer',
                                'minimum' => 1,
                                'maximum' => 5,
                                'description' => 'Number of attendees (1-5).',
                            ],
                            'purpose' => [
                                'type' => 'string',
                                'minLength' => 1,
                                'maxLength' => 200,
                                'description' => 'Short booking purpose. Do not include sensitive or unnecessary personal information.',
                            ],
                            'confirmed' => [
                                'type' => 'boolean',
                                'const' => true,
                                'description' => 'Set true only after the user has reviewed and explicitly confirmed the exact date, time, and attendee count.',
                            ],
                            'idempotency_key' => [
                                'type' => 'string',
                                'minLength' => 16,
                                'maxLength' => 128,
                                'pattern' => '^[A-Za-z0-9_-]+$',
                                'description' => 'Random unique key for this booking attempt. Reuse it for retries of the same booking; generate a new key for a new booking.',
                            ],
                        ],
                        'required' => ['starts_at', 'ends_at', 'attendee_count', 'purpose', 'confirmed', 'idempotency_key'],
                        'additionalProperties' => false,
                    ],
                    'annotations' => [
                        'readOnlyHint' => false,
                        'destructiveHint' => false,
                        'idempotentHint' => false,
                        'openWorldHint' => true,
                    ],
                ],
        ];
        foreach ($tools as &$tool) {
            $tool['title'] = rt_mcp_tool_title($tool['name']);
            $tool['outputSchema'] = rt_mcp_tool_output_schema($tool['name']);
        }
        unset($tool);
        rt_mcp_json([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => ['tools' => $tools],
        ]);

    case 'resources/list':
        rt_mcp_json([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => ['resources' => [
                ['uri' => 'radiotedu://stations', 'name' => 'stations', 'title' => 'RadioTEDU stations', 'description' => 'Public station catalog and stream links.', 'mimeType' => 'application/json'],
                ['uri' => 'radiotedu://now-playing/radiotedu-main', 'name' => 'now-playing-main', 'title' => 'Main station now playing', 'description' => 'Current public playback metadata for the main RadioTEDU station.', 'mimeType' => 'application/json'],
                ['uri' => 'radiotedu://schedule/radiotedu-main', 'name' => 'schedule-main', 'title' => 'Main station schedule', 'description' => 'Published public program schedule for the main RadioTEDU station.', 'mimeType' => 'application/json'],
                ['uri' => 'radiotedu://podcasts', 'name' => 'podcasts', 'title' => 'RadioTEDU podcasts', 'description' => 'Public RadioTEDU podcast series catalog.', 'mimeType' => 'application/json'],
                ['uri' => 'radiotedu://focus-presets', 'name' => 'focus-presets', 'title' => 'Focus presets', 'description' => 'Public focus channels and study presets.', 'mimeType' => 'application/json'],
                ['uri' => 'radiotedu://studio-availability', 'name' => 'studio-availability', 'title' => 'Studio availability summary', 'description' => 'Public room metadata and aggregate availability only; no occupant identities or individual reservation details.', 'mimeType' => 'application/json'],
            ]],
        ]);

    case 'resources/templates/list':
        rt_mcp_json([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => ['resourceTemplates' => [
                ['uriTemplate' => 'radiotedu://now-playing/{station_id}', 'name' => 'now-playing', 'title' => 'Station now playing', 'description' => 'Current public playback metadata for a RadioTEDU station.', 'mimeType' => 'application/json'],
                ['uriTemplate' => 'radiotedu://schedule/{station_id}', 'name' => 'schedule', 'title' => 'Station schedule', 'description' => 'Published program schedule for a RadioTEDU station.', 'mimeType' => 'application/json'],
                ['uriTemplate' => 'radiotedu://station-status/{station}', 'name' => 'station-status', 'title' => 'AI station status', 'description' => 'Current public status snapshot for radiotedu-en or radiotedu-fr.', 'mimeType' => 'application/json'],
            ]],
        ]);

    case 'resources/read':
        $resourceUri = is_array($request['params'] ?? null) ? (string) ($request['params']['uri'] ?? '') : '';
        $resourceData = null;
        $resourceSource = 'https://radiotedu.com/agents.html';
        if ($resourceUri === 'radiotedu://stations') {
            $resourceData = rt_fetch_internal_json('http://127.0.0.1/wp-json/radiotedu/v1/stations');
            $resourceSource = 'https://radiotedu.com/wp-json/radiotedu/v1/stations';
        } elseif ($resourceUri === 'radiotedu://podcasts') {
            $resourceData = rt_fetch_internal_json('http://127.0.0.1/wp-json/radiotedu/v1/podcasts');
            $resourceSource = 'https://radiotedu.com/wp-json/radiotedu/v1/podcasts';
        } elseif ($resourceUri === 'radiotedu://focus-presets') {
            $resourceData = rt_mcp_focus_presets();
            $resourceSource = 'https://radiotedu.com/focus/';
        } elseif ($resourceUri === 'radiotedu://studio-availability') {
            $erpResult = rt_erp_hmac_request('GET', '/api/ecosystem/v1/dashboard');
            if ($erpResult !== null && $erpResult['http_code'] === 200 && is_array($erpResult['data']['data'] ?? null)) {
                $resourceData = rt_mcp_public_studio_summary($erpResult['data']['data']);
                $resourceSource = 'https://radiotedu.com/agents.html';
            }
        } elseif (preg_match('#^radiotedu://now-playing/([a-z0-9_-]+)$#i', $resourceUri, $match)) {
            $stationId = strtolower($match[1]);
            if (in_array($stationId, ['radiotedu-ai-en', 'radiotedu-en'], true)) {
                $resourceData = rt_fetch_internal_json('http://127.0.0.1:18083/v1/radio/stations/radiotedu-en/status');
            } elseif (in_array($stationId, ['radiotedu-ai-fr', 'radiotedu-fr'], true)) {
                $resourceData = rt_fetch_internal_json('http://127.0.0.1:18083/v1/radio/stations/radiotedu-fr/status');
            } elseif (in_array($stationId, ['radiotedu-main', 'radiotedu-lofi', 'radiotedu-jazz', 'radiotedu-classic', 'radiotedu-rock', 'radiotedu-spark'], true)) {
                $resourceData = rt_fetch_internal_json('http://127.0.0.1/wp-json/radiotedu/v1/stations/' . $stationId . '/live?player=1');
            } else {
                rt_mcp_error($id, -32602, 'Invalid station resource URI');
            }
            $resourceSource = 'https://radiotedu.com/';
        } elseif (preg_match('#^radiotedu://schedule/([a-z0-9_-]+)$#i', $resourceUri, $match)) {
            $stationId = strtolower($match[1]);
            if (!in_array($stationId, ['radiotedu-main', 'radiotedu-lofi', 'radiotedu-jazz', 'radiotedu-classic', 'radiotedu-rock', 'radiotedu-spark', 'radiotedu-ai-en', 'radiotedu-ai-fr'], true)) {
                rt_mcp_error($id, -32602, 'Invalid station resource URI');
            }
            $resourceData = rt_fetch_internal_json('http://127.0.0.1/wp-json/radiotedu/v1/stations/' . $stationId . '/schedule');
            $resourceSource = 'https://radiotedu.com/wp-json/radiotedu/v1/stations/' . $stationId . '/schedule';
        } elseif (preg_match('#^radiotedu://station-status/(radiotedu-en|radiotedu-fr)$#i', $resourceUri, $match)) {
            $stationId = strtolower($match[1]);
            $resourceData = rt_fetch_internal_json('http://127.0.0.1:18083/v1/radio/stations/' . $stationId . '/status');
            $resourceSource = 'https://radiotedu.com/';
        } else {
            rt_mcp_error($id, -32602, 'Unknown resource URI');
        }
        if ($resourceData === null) {
            rt_mcp_error($id, -32002, 'Resource is currently unavailable');
        }
        rt_mcp_json([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => [
                'contents' => [[
                    'uri' => $resourceUri,
                    'mimeType' => 'application/json',
                    'text' => json_encode($resourceData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                ]],
                '_meta' => ['retrieved_at' => gmdate('c'), 'timezone' => 'Europe/Istanbul', 'source_url' => $resourceSource],
            ],
        ]);

    case 'prompts/list':
        rt_mcp_json([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => ['prompts' => [
                ['name' => 'discover_radio_content', 'title' => 'Discover RadioTEDU content', 'description' => 'Find relevant public RadioTEDU programs, stations, or podcasts and cite their canonical links.', 'arguments' => [
                    ['name' => 'query', 'description' => 'Topic or listening interest in Turkish, English, or French.', 'required' => true],
                ]],
                ['name' => 'what_is_on_air', 'title' => 'What is on air?', 'description' => 'Summarize current public playback and the published schedule with timestamps.', 'arguments' => []],
                ['name' => 'build_focus_session', 'title' => 'Build a focus session', 'description' => 'Recommend a RadioTEDU focus channel and Pomodoro preset for the requested task.', 'arguments' => [
                    ['name' => 'task', 'description' => 'Study or work activity.', 'required' => true],
                    ['name' => 'work_minutes', 'description' => 'Preferred focus interval in minutes.', 'required' => false],
                ]],
                ['name' => 'prepare_studio_booking', 'title' => 'Prepare a studio booking', 'description' => 'Guide a user through availability, explicit confirmation, and authenticated booking without requesting personal identifiers in chat.', 'arguments' => [
                    ['name' => 'requested_time', 'description' => 'Requested date and time in Europe/Istanbul.', 'required' => false],
                ]],
            ]],
        ]);

    case 'prompts/get':
        $promptParams = is_array($request['params'] ?? null) ? $request['params'] : [];
        $promptName = is_string($promptParams['name'] ?? null) ? $promptParams['name'] : '';
        $promptArguments = is_array($promptParams['arguments'] ?? null) ? $promptParams['arguments'] : [];
        $promptDescription = '';
        $promptText = '';
        if ($promptName === 'discover_radio_content') {
            $queryText = trim((string) ($promptArguments['query'] ?? ''));
            if ($queryText === '' || strlen($queryText) > 200) {
                rt_mcp_error($id, -32602, 'Prompt argument query is required and must be at most 200 characters');
            }
            $promptDescription = 'Discover and cite public RadioTEDU content.';
            $promptText = 'Search RadioTEDU public content for: ' . $queryText . '. Use search_content with pagination where useful. Cite the canonical URL for every result, distinguish current information from published archives, and do not invent details.';
        } elseif ($promptName === 'what_is_on_air') {
            $promptDescription = 'Summarize public current playback and schedule information.';
            $promptText = 'Use get_now_playing and get_broadcast_schedule for radiotedu-main. State the retrieval time and Europe/Istanbul timezone. Link the relevant RadioTEDU source and distinguish live metadata from the published schedule.';
        } elseif ($promptName === 'build_focus_session') {
            $task = trim((string) ($promptArguments['task'] ?? ''));
            if ($task === '' || strlen($task) > 200) {
                rt_mcp_error($id, -32602, 'Prompt argument task is required and must be at most 200 characters');
            }
            $workMinutes = filter_var($promptArguments['work_minutes'] ?? 25, FILTER_VALIDATE_INT);
            $workMinutes = $workMinutes !== false ? max(10, min(90, $workMinutes)) : 25;
            $promptDescription = 'Recommend a public focus preset for a task.';
            $promptText = 'Recommend a RadioTEDU focus channel for this task: ' . $task . '. Use get_focus_presets. Prefer the closest available Pomodoro preset to ' . $workMinutes . ' minutes, and return its launch URL.';
        } elseif ($promptName === 'prepare_studio_booking') {
            $requestedTime = trim((string) ($promptArguments['requested_time'] ?? ''));
            if (strlen($requestedTime) > 64) {
                rt_mcp_error($id, -32602, 'Prompt argument requested_time is too long');
            }
            $promptDescription = 'Prepare a privacy-preserving authenticated studio booking.';
            $promptText = 'If the user asks to book a studio, first call check_studio_availability and summarize only room availability and published rules. Ask for an explicit confirmation of the exact slot and attendee count before any state-changing call. Do not ask for or repeat the user’s name, email, or phone in chat; book_studio_slot obtains the identity from an ERP-issued Bearer token. Reuse one random idempotency_key for retries of the same booking. Requested time: ' . ($requestedTime !== '' ? $requestedTime : 'ask the user for a date and time in Europe/Istanbul') . '.';
        } else {
            rt_mcp_error($id, -32602, 'Unknown prompt');
        }
        rt_mcp_json([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => [
                'description' => $promptDescription,
                'messages' => [['role' => 'user', 'content' => ['type' => 'text', 'text' => $promptText]]],
            ],
        ]);

    case 'tools/call':
        $params = $request['params'] ?? null;
        $toolName = is_array($params) ? ($params['name'] ?? null) : null;
        $arguments = is_array($params) && isset($params['arguments']) && is_array($params['arguments']) ? $params['arguments'] : [];

        switch ($toolName) {
            case 'get_station_status':
                $station = (string) ($arguments['station'] ?? '');
                if (!in_array($station, ['radiotedu-en', 'radiotedu-fr'], true)) {
                    rt_mcp_error($id, -32602, 'Invalid tool arguments: station must be radiotedu-en or radiotedu-fr');
                }
                $data = rt_fetch_internal_json('http://127.0.0.1:18083/v1/radio/stations/' . $station . '/status');
                if ($data === null) {
                    rt_mcp_tool_failure($id, 'station_status_unavailable', 'Station status is currently unavailable.');
                }
                rt_mcp_tool_success($id, $data, 'https://radiotedu.com/');

            case 'get_stations':
                $data = rt_fetch_internal_json('http://127.0.0.1/wp-json/radiotedu/v1/stations');
                if ($data === null) {
                    rt_mcp_tool_failure($id, 'stations_unavailable', 'Station list is currently unavailable.');
                }
                rt_mcp_tool_success($id, $data, 'https://radiotedu.com/wp-json/radiotedu/v1/stations');

            case 'get_now_playing':
                $stationId = (string) ($arguments['station_id'] ?? 'radiotedu-main');
                if ($stationId === 'radiotedu-ai-en' || $stationId === 'radiotedu-en') {
                    $data = rt_fetch_internal_json('http://127.0.0.1:18083/v1/radio/stations/radiotedu-en/status');
                } elseif ($stationId === 'radiotedu-ai-fr' || $stationId === 'radiotedu-fr') {
                    $data = rt_fetch_internal_json('http://127.0.0.1:18083/v1/radio/stations/radiotedu-fr/status');
                } else {
                    $safeId = preg_replace('/[^a-z0-9_-]/i', '', $stationId) ?: 'radiotedu-main';
                    $data = rt_fetch_internal_json('http://127.0.0.1/wp-json/radiotedu/v1/stations/' . $safeId . '/live?player=1');
                }
                if ($data === null) {
                    rt_mcp_tool_failure($id, 'now_playing_unavailable', 'Now-playing information is currently unavailable.');
                }
                rt_mcp_tool_success($id, $data, 'https://radiotedu.com/');

            case 'get_broadcast_schedule':
                $stationId = (string) ($arguments['station_id'] ?? 'radiotedu-main');
                $safeId = preg_replace('/[^a-z0-9_-]/i', '', $stationId) ?: 'radiotedu-main';
                $data = rt_fetch_internal_json('http://127.0.0.1/wp-json/radiotedu/v1/stations/' . $safeId . '/schedule');
                if ($data === null) {
                    rt_mcp_tool_failure($id, 'schedule_unavailable', 'Broadcast schedule is currently unavailable.');
                }
                rt_mcp_tool_success($id, $data, 'https://radiotedu.com/wp-json/radiotedu/v1/stations/' . $safeId . '/schedule');

            case 'get_podcasts':
                $data = rt_fetch_internal_json('http://127.0.0.1/wp-json/radiotedu/v1/podcasts');
                if ($data === null) {
                    rt_mcp_tool_failure($id, 'podcasts_unavailable', 'Podcast list is currently unavailable.');
                }
                rt_mcp_tool_success($id, $data, 'https://radiotedu.com/wp-json/radiotedu/v1/podcasts');

            case 'search_content':
                $query = trim((string) ($arguments['query'] ?? ''));
                $queryLength = function_exists('mb_strlen') ? mb_strlen($query, 'UTF-8') : strlen($query);
                if ($query === '' || $queryLength > 200) {
                    rt_mcp_error($id, -32602, 'Invalid tool arguments: query must be 1-200 characters');
                }
                $page = $arguments['page'] ?? 1;
                $perPage = $arguments['per_page'] ?? 20;
                if (!is_int($page) || $page < 1 || $page > 1000 || !is_int($perPage) || $perPage < 1 || $perPage > 50) {
                    rt_mcp_error($id, -32602, 'Invalid tool arguments: page must be 1-1000 and per_page must be 1-50');
                }
                $allowedTypes = ['rt_station', 'rt_program', 'rt_podcast_show', 'rt_podcast_episode', 'post', 'page'];
                $type = $arguments['type'] ?? null;
                if ($type !== null && (!is_string($type) || !in_array($type, $allowedTypes, true))) {
                    rt_mcp_error($id, -32602, 'Invalid tool arguments: unsupported content type');
                }
                $searchResult = rt_mcp_wp_search($query, $page, $perPage, $type);
                if ($searchResult === null) {
                    rt_mcp_tool_failure($id, 'search_unavailable', 'Search results are currently unavailable.');
                }

                $legacyItemsByUrl = [];
                if ($page === 1) {
                    $legacy = rt_fetch_internal_json('http://127.0.0.1/wp-json/radiotedu/v1/search?' . http_build_query(['q' => $query, 'per_page' => min(30, $perPage)]));
                    foreach (is_array($legacy['items'] ?? null) ? $legacy['items'] : [] as $legacyItem) {
                        if (is_array($legacyItem) && is_string($legacyItem['url'] ?? null)) {
                            $legacyItemsByUrl[$legacyItem['url']] = $legacyItem;
                        }
                    }
                }

                $items = [];
                foreach ($searchResult['items'] as $item) {
                    if (!is_array($item)) {
                        continue;
                    }
                    $url = (string) ($item['url'] ?? '');
                    $host = strtolower((string) parse_url($url, PHP_URL_HOST));
                    if (!in_array($host, ['radiotedu.com', 'www.radiotedu.com'], true)) {
                        continue;
                    }
                    $legacyItem = $legacyItemsByUrl[$url] ?? [];
                    $items[] = [
                        'id' => (string) ($item['id'] ?? ''),
                        'type' => (string) ($item['subtype'] ?? $item['type'] ?? 'content'),
                        'title' => (string) ($item['title'] ?? ''),
                        'excerpt' => is_string($legacyItem['excerpt'] ?? null) ? $legacyItem['excerpt'] : '',
                        'url' => $url,
                        'image' => is_string($legacyItem['image'] ?? null) ? $legacyItem['image'] : null,
                    ];
                }
                $totalPages = (int) $searchResult['total_pages'];
                $hasMore = $page < $totalPages;
                $result = [
                    'items' => $items,
                    'total' => (int) $searchResult['total'],
                    'page' => $page,
                    'per_page' => $perPage,
                    'total_pages' => $totalPages,
                    'has_more' => $hasMore,
                    'next_page' => $hasMore ? $page + 1 : null,
                    'applied_filters' => ['type' => $type],
                ];
                rt_mcp_tool_success($id, $result, 'https://radiotedu.com/wp-json/wp/v2/search');

            case 'get_focus_presets':
                rt_mcp_tool_success($id, rt_mcp_focus_presets(), 'https://radiotedu.com/focus/');

            case 'check_studio_availability':
                $erpResult = rt_erp_hmac_request('GET', '/api/ecosystem/v1/dashboard');
                if ($erpResult === null || $erpResult['http_code'] !== 200 || !isset($erpResult['data']['data'])) {
                    rt_mcp_tool_failure($id, 'studio_availability_unavailable', 'Studio availability is currently unavailable.');
                }
                $summary = rt_mcp_public_studio_summary($erpResult['data']['data']);
                rt_mcp_tool_success($id, $summary, 'https://radiotedu.com/agents.html#studio-booking');

            case 'book_studio_slot':
                $allowedArguments = ['starts_at', 'ends_at', 'attendee_count', 'purpose', 'confirmed', 'idempotency_key'];
                if (array_diff(array_keys($arguments), $allowedArguments) !== []) {
                    rt_mcp_error($id, -32602, 'Invalid tool arguments: unsupported fields');
                }
                if (($arguments['confirmed'] ?? null) !== true) {
                    rt_mcp_tool_failure($id, 'confirmation_required', 'The user must confirm the exact reservation details before booking.');
                }
                $startsRaw = $arguments['starts_at'] ?? null;
                $endsRaw = $arguments['ends_at'] ?? null;
                $attendeeCount = $arguments['attendee_count'] ?? null;
                $purposeValue = $arguments['purpose'] ?? null;
                $idempotencyKey = $arguments['idempotency_key'] ?? null;
                if (!is_string($purposeValue) || !is_string($idempotencyKey)) {
                    rt_mcp_error($id, -32602, 'Invalid tool arguments: purpose and idempotency_key must be strings');
                }
                $purpose = trim($purposeValue);
                $purposeLength = function_exists('mb_strlen') ? mb_strlen($purpose, 'UTF-8') : strlen($purpose);
                if (!is_string($startsRaw) || !is_string($endsRaw)
                    || !is_int($attendeeCount) || $attendeeCount < 1 || $attendeeCount > 5
                    || $purpose === '' || $purposeLength > 200 || preg_match('/[\x00-\x1F\x7F]/', $purpose)
                    || !preg_match('/^[A-Za-z0-9_-]{16,128}$/', $idempotencyKey)) {
                    rt_mcp_error($id, -32602, 'Invalid tool arguments: provide valid dates, 1-5 attendees, a short purpose, and a 16-128 character idempotency key');
                }
                $starts = rt_mcp_parse_studio_datetime($startsRaw);
                $ends = rt_mcp_parse_studio_datetime($endsRaw);
                $timezone = new DateTimeZone('Europe/Istanbul');
                $now = new DateTimeImmutable('now', $timezone);
                if ($starts === null || $ends === null || $starts <= $now || $ends <= $starts
                    || $starts->format('Y-m-d') !== $ends->format('Y-m-d')
                    || $starts->format('s') !== '00' || $ends->format('s') !== '00'
                    || $starts->format('N') > 5
                    || (int) $starts->format('i') % 30 !== 0
                    || (int) $ends->format('i') % 30 !== 0
                    || ($ends->getTimestamp() - $starts->getTimestamp()) % 1800 !== 0) {
                    rt_mcp_error($id, -32602, 'Invalid tool arguments: choose a future weekday date and a whole 30-minute slot in Europe/Istanbul time');
                }
                $startMinute = ((int) $starts->format('H') * 60) + (int) $starts->format('i');
                $endMinute = ((int) $ends->format('H') * 60) + (int) $ends->format('i');
                $withinMorning = $startMinute >= 600 && $endMinute <= 720;
                $withinAfternoon = $startMinute >= 780 && $endMinute <= 960;
                if (!$withinMorning && !$withinAfternoon) {
                    rt_mcp_error($id, -32602, 'Invalid tool arguments: studio hours are weekdays 10:00-12:00 and 13:00-16:00');
                }

                $bearerToken = rt_mcp_bearer_token();
                if ($bearerToken === null) {
                    rt_mcp_tool_failure($id, 'authentication_required', 'Sign in with an authorized RadioTEDU ERP account before booking.');
                }
                $profile = rt_mcp_erp_profile($bearerToken);
                unset($bearerToken);
                if ($profile === null) {
                    rt_mcp_tool_failure($id, 'authentication_required', 'An active TED University account with RadioTEDU ERP access is required.');
                }
                $canonicalStarts = $starts->format('Y-m-d\TH:i:sP');
                $canonicalEnds = $ends->format('Y-m-d\TH:i:sP');
                $payload = [
                    'name' => $profile['name'],
                    'email' => $profile['email'],
                    'starts_at' => $canonicalStarts,
                    'ends_at' => $canonicalEnds,
                    'attendee_count' => $attendeeCount,
                    'purpose' => $purpose,
                ];
                $fingerprintSource = json_encode([
                    'sub' => $profile['sub'],
                    'starts_at' => $canonicalStarts,
                    'ends_at' => $canonicalEnds,
                    'attendee_count' => $attendeeCount,
                    'purpose' => $purpose,
                ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
                $guard = rt_mcp_idempotency_begin($profile['sub'] . "\0" . $idempotencyKey, hash('sha256', $fingerprintSource));
                unset($fingerprintSource, $profile);
                if (($guard['state'] ?? '') === 'replay') {
                    $replay = $guard['response'];
                    $replay['idempotent_replay'] = true;
                    rt_mcp_tool_success($id, $replay, 'https://radiotedu.com/agents.html#studio-booking');
                }
                if (($guard['state'] ?? '') !== 'new') {
                    $code = match ($guard['state'] ?? '') {
                        'conflict' => 'idempotency_conflict',
                        'in_progress' => 'booking_in_progress',
                        default => 'idempotency_unavailable',
                    };
                    $message = match ($code) {
                        'idempotency_conflict' => 'This idempotency key was already used for different reservation details.',
                        'booking_in_progress' => 'A reservation attempt with this idempotency key is already in progress.',
                        default => 'The booking safety check is unavailable. Please try again later.',
                    };
                    rt_mcp_tool_failure($id, $code, $message);
                }
                $erpResult = rt_erp_hmac_request('POST', '/api/ecosystem/v1/appointments', $payload);
                unset($payload);
                if ($erpResult === null || $erpResult['http_code'] !== 201) {
                    rt_mcp_idempotency_abort($guard);
                    rt_mcp_tool_failure($id, 'reservation_rejected', 'The studio reservation could not be completed. Check availability and reservation rules, then try again.');
                }
                $bookingData = is_array($erpResult['data']['data'] ?? null)
                    ? $erpResult['data']['data']
                    : (is_array($erpResult['data']) ? $erpResult['data'] : []);
                $bookingStudio = is_string($bookingData['studio'] ?? null)
                    ? $bookingData['studio']
                    : (is_array($bookingData['studio'] ?? null) && is_string($bookingData['studio']['name'] ?? null) ? $bookingData['studio']['name'] : 'Studio');
                $bookingId = is_int($bookingData['id'] ?? null) || is_string($bookingData['id'] ?? null) ? $bookingData['id'] : null;
                unset($bookingData, $erpResult);
                $result = [
                    'status' => 'created',
                    'booking_id' => $bookingId,
                    'studio' => substr($bookingStudio, 0, 100),
                    'starts_at' => $canonicalStarts,
                    'ends_at' => $canonicalEnds,
                    'timezone' => 'Europe/Istanbul',
                    'idempotent_replay' => false,
                    'idempotency_protected' => true,
                ];
                if (!rt_mcp_idempotency_complete($guard, $result)) {
                    $result['idempotency_protected'] = false;
                }
                rt_mcp_tool_success($id, $result, 'https://radiotedu.com/agents.html#studio-booking');

            default:
                rt_mcp_error($id, -32601, 'Tool not found: ' . (string) $toolName);
        }

    default:
        rt_mcp_error($id, -32601, 'Method not found: ' . (string) $method);
}
