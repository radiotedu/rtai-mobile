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

function rt_fetch_internal_json(string $url): ?array
{
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 4,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
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
                'capabilities' => ['tools' => ['listChanged' => false]],
                'serverInfo' => ['name' => 'radiotedu-public-radio', 'version' => '1.2.0'],
                'instructions' => 'Public read-only and authorized student tools for RadioTEDU: live broadcast stations, now-playing metadata, Pomodoro focus presets, podcasts, and studio reservation booking.',
            ],
        ]);

    case 'tools/list':
        rt_mcp_json([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => ['tools' => [
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
                    'description' => 'Search RadioTEDU programs, stations, and podcast episodes by keyword.',
                    'inputSchema' => [
                        'type' => 'object',
                        'properties' => [
                            'query' => [
                                'type' => 'string',
                                'description' => 'Search query string.',
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
                    'description' => 'Check RadioTEDU broadcast and podcast recording studios availability, current occupants, and booking rules from Hub ERP.',
                    'inputSchema' => [
                        'type' => 'object',
                        'properties' => (object) [],
                        'additionalProperties' => false,
                    ],
                    'annotations' => ['readOnlyHint' => true],
                ],
                [
                    'name' => 'book_studio_slot',
                    'description' => 'Authorized Action: Book a studio recording or podcast slot at RadioTEDU Hub ERP for a TED University member. Requires valid @tedu.edu.tr email.',
                    'inputSchema' => [
                        'type' => 'object',
                        'properties' => [
                            'name' => [
                                'type' => 'string',
                                'description' => 'Full name of the student or staff member.',
                            ],
                            'email' => [
                                'type' => 'string',
                                'description' => 'TED University email address ending with @tedu.edu.tr.',
                            ],
                            'phone' => [
                                'type' => 'string',
                                'description' => 'Contact phone number (optional).',
                            ],
                            'starts_at' => [
                                'type' => 'string',
                                'description' => 'Start date and time (ISO 8601, e.g. 2026-09-28T10:00:00). Must be weekdays, 10:00-12:00 or 13:00-16:00, 30-min aligned.',
                            ],
                            'ends_at' => [
                                'type' => 'string',
                                'description' => 'End date and time (ISO 8601, e.g. 2026-09-28T11:00:00). Same day as starts_at.',
                            ],
                            'attendee_count' => [
                                'type' => 'integer',
                                'minimum' => 1,
                                'maximum' => 5,
                                'description' => 'Number of attendees (1 for recording studio, 2-5 for main studio).',
                            ],
                            'purpose' => [
                                'type' => 'string',
                                'description' => 'Purpose of the reservation (e.g. Podcast recording, DJ rehearsal, Project work).',
                            ],
                        ],
                        'required' => ['name', 'email', 'starts_at', 'ends_at', 'attendee_count', 'purpose'],
                        'additionalProperties' => false,
                    ],
                ],
            ]],
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
                    rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                        'content' => [['type' => 'text', 'text' => 'Station status is currently unavailable.']],
                        'isError' => true,
                    ]]);
                }
                rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                    'content' => [['type' => 'text', 'text' => json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]],
                    'structuredContent' => $data,
                ]]);

            case 'get_stations':
                $data = rt_fetch_internal_json('http://127.0.0.1/wp-json/radiotedu/v1/stations');
                if ($data === null) {
                    rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                        'content' => [['type' => 'text', 'text' => 'Station list is currently unavailable.']],
                        'isError' => true,
                    ]]);
                }
                rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                    'content' => [['type' => 'text', 'text' => json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]],
                    'structuredContent' => $data,
                ]]);

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
                    rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                        'content' => [['type' => 'text', 'text' => 'Now-playing information is currently unavailable.']],
                        'isError' => true,
                    ]]);
                }
                rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                    'content' => [['type' => 'text', 'text' => json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]],
                    'structuredContent' => $data,
                ]]);

            case 'get_broadcast_schedule':
                $stationId = (string) ($arguments['station_id'] ?? 'radiotedu-main');
                $safeId = preg_replace('/[^a-z0-9_-]/i', '', $stationId) ?: 'radiotedu-main';
                $data = rt_fetch_internal_json('http://127.0.0.1/wp-json/radiotedu/v1/stations/' . $safeId . '/schedule');
                if ($data === null) {
                    rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                        'content' => [['type' => 'text', 'text' => 'Broadcast schedule is currently unavailable.']],
                        'isError' => true,
                    ]]);
                }
                rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                    'content' => [['type' => 'text', 'text' => json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]],
                    'structuredContent' => $data,
                ]]);

            case 'get_podcasts':
                $data = rt_fetch_internal_json('http://127.0.0.1/wp-json/radiotedu/v1/podcasts');
                if ($data === null) {
                    rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                        'content' => [['type' => 'text', 'text' => 'Podcast list is currently unavailable.']],
                        'isError' => true,
                    ]]);
                }
                rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                    'content' => [['type' => 'text', 'text' => json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]],
                    'structuredContent' => $data,
                ]]);

            case 'search_content':
                $query = (string) ($arguments['query'] ?? '');
                if (trim($query) === '') {
                    rt_mcp_error($id, -32602, 'Invalid tool arguments: query cannot be empty');
                }
                $data = rt_fetch_internal_json('http://127.0.0.1/wp-json/radiotedu/v1/search?q=' . urlencode($query));
                if ($data === null) {
                    rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                        'content' => [['type' => 'text', 'text' => 'Search results are currently unavailable.']],
                        'isError' => true,
                    ]]);
                }
                rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                    'content' => [['type' => 'text', 'text' => json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]],
                    'structuredContent' => $data,
                ]]);

            case 'get_focus_presets':
                $focusData = [
                    'base_url' => 'https://radiotedu.com/focus/',
                    'channels' => [
                        [
                            'id' => 'lofi',
                            'name' => 'Lo-Fi Focus',
                            'stream_url' => 'https://stream.radiotedu.com/lofi',
                            'description' => 'Beats to study, code and concentrate.',
                        ],
                        [
                            'id' => 'jazz',
                            'name' => 'Smooth Jazz',
                            'stream_url' => 'https://stream.radiotedu.com/cazz',
                            'description' => 'Warm instrumental jazz for reading and relaxed flow.',
                        ],
                        [
                            'id' => 'classical',
                            'name' => 'Classical Clarity',
                            'stream_url' => 'https://stream.radiotedu.com/classic',
                            'description' => 'Timeless orchestral masterpieces for deep academic concentration.',
                        ],
                    ],
                    'ambient_sound_layers' => [
                        'rain', 'fire', 'wind', 'ocean', 'birds', 'thunder', 'crickets'
                    ],
                    'recommended_presets' => [
                        [
                            'id' => 'deep_coding',
                            'title' => 'Derin Kodlama & Gece Çalışması',
                            'channel' => 'lofi',
                            'ambient_mix' => ['rain' => 50, 'fire' => 30],
                            'pomodoro' => ['work' => 25, 'break' => 5],
                            'launch_url' => 'https://radiotedu.com/focus/?channel=lofi',
                        ],
                        [
                            'id' => 'academic_reading',
                            'title' => 'Akademik Okuma & Makale Yazımı',
                            'channel' => 'classical',
                            'ambient_mix' => ['ocean' => 35, 'birds' => 20],
                            'pomodoro' => ['work' => 45, 'break' => 10],
                            'launch_url' => 'https://radiotedu.com/focus/?channel=classical',
                        ],
                        [
                            'id' => 'coffee_break',
                            'title' => 'Kahve Molası & Yaratıcı Akış',
                            'channel' => 'jazz',
                            'ambient_mix' => ['rain' => 40, 'crickets' => 20],
                            'pomodoro' => ['work' => 20, 'break' => 5],
                            'launch_url' => 'https://radiotedu.com/focus/?channel=jazz',
                        ],
                    ],
                ];
                rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                    'content' => [['type' => 'text', 'text' => json_encode($focusData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]],
                    'structuredContent' => $focusData,
                ]]);

            case 'check_studio_availability':
                $erpResult = rt_erp_hmac_request('GET', '/api/ecosystem/v1/dashboard');
                if ($erpResult === null || $erpResult['http_code'] !== 200 || !isset($erpResult['data']['data'])) {
                    rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                        'content' => [['type' => 'text', 'text' => 'Studio booking system is currently unreachable.']],
                        'isError' => true,
                    ]]);
                }
                $dashboard = $erpResult['data']['data'];
                $summary = [
                    'studios' => $dashboard['studios'] ?? [],
                    'current_occupants' => $dashboard['people_inside'] ?? [],
                    'today_reservations' => $dashboard['reservations'] ?? [],
                    'booking_rules' => $dashboard['appointment_rules'] ?? [],
                    'guidance' => 'Reservations require an @tedu.edu.tr email, weekdays between 10:00-12:00 or 13:00-16:00, aligned to 30-minute intervals. Max 5 attendees.',
                ];
                rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                    'content' => [['type' => 'text', 'text' => json_encode($summary, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]],
                    'structuredContent' => $summary,
                ]]);

            case 'book_studio_slot':
                $email = strtolower(trim((string) ($arguments['email'] ?? '')));
                if (!str_ends_with($email, '@tedu.edu.tr') || $email === '@tedu.edu.tr') {
                    rt_mcp_error($id, -32602, 'Email address must end with @tedu.edu.tr');
                }
                $payload = [
                    'name' => (string) ($arguments['name'] ?? ''),
                    'email' => $email,
                    'phone' => (string) ($arguments['phone'] ?? ''),
                    'starts_at' => (string) ($arguments['starts_at'] ?? ''),
                    'ends_at' => (string) ($arguments['ends_at'] ?? ''),
                    'attendee_count' => (int) ($arguments['attendee_count'] ?? 1),
                    'purpose' => (string) ($arguments['purpose'] ?? 'AI Agent Assisted Studio Booking'),
                ];
                $erpResult = rt_erp_hmac_request('POST', '/api/ecosystem/v1/appointments', $payload);
                if ($erpResult === null) {
                    rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                        'content' => [['type' => 'text', 'text' => 'Failed to reach Hub ERP reservation service.']],
                        'isError' => true,
                    ]]);
                }
                if ($erpResult['http_code'] !== 201) {
                    $errorMsg = 'Reservation failed';
                    if (isset($erpResult['data']['message'])) {
                        $errorMsg = $erpResult['data']['message'];
                    } elseif (isset($erpResult['data']['errors'])) {
                        $errorMsg = implode('; ', array_map(fn($v) => is_array($v) ? implode(', ', $v) : $v, $erpResult['data']['errors']));
                    }
                    rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                        'content' => [['type' => 'text', 'text' => $errorMsg]],
                        'isError' => true,
                        'structuredContent' => $erpResult['data'],
                    ]]);
                }
                $bookingData = $erpResult['data']['data'] ?? $erpResult['data'];
                rt_mcp_json(['jsonrpc' => '2.0', 'id' => $id, 'result' => [
                    'content' => [['type' => 'text', 'text' => 'Studio reservation successfully created! ID: ' . ($bookingData['id'] ?? 'N/A') . ', Studio: ' . ($bookingData['studio'] ?? 'Studio') . ', Time: ' . ($bookingData['starts_at'] ?? '') . ' - ' . ($bookingData['ends_at'] ?? '')]],
                    'structuredContent' => $bookingData,
                ]]);

            default:
                rt_mcp_error($id, -32601, 'Tool not found: ' . (string) $toolName);
        }

    default:
        rt_mcp_error($id, -32601, 'Method not found: ' . (string) $method);
}
