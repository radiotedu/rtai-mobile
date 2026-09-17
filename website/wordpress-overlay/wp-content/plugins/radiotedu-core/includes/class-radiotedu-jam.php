<?php
/**
 * RadioTEDU Campus Jam (Spotify Jam) REST API & Ephemeral Room Management.
 *
 * Coordinates real-time group listening sessions between mobile app (Android/iOS)
 * and RadioTEDU live streams. Uses WordPress Transient API exclusively with 0 persistent
 * database tables or schema modifications.
 *
 * @package RadioTEDU_Core
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class RadioTEDU_Jam
{
    private static ?self $instance = null;
    private const NAMESPACE = 'radiotedu/v1';
    private const ROOM_TTL = 7200; // 2 hours
    private const RX_TTL = 300;    // 5 minutes storage TTL
    private const RX_WINDOW = 60;  // 60 seconds display window
    private const MAX_REACTIONS = 20;
    private const CHAT_TTL = 300;     // 5 minutes storage TTL
    private const CHAT_WINDOW = 120;  // 120 seconds display window
    private const MAX_CHAT_MESSAGES = 20;
    private const CHAT_COOLDOWN = 3;  // 3 seconds rate limit

    public static function instance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct()
    {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_filter('rest_pre_serve_request', [$this, 'handle_preflight_and_cors'], 10, 4);
    }

    /**
     * Register REST API routes for Campus Jam under /wp-json/radiotedu/v1/jam
     */
    public function register_routes(): void
    {
        // 1. Oda Oluşturma: POST /wp-json/radiotedu/v1/jam/create
        register_rest_route(self::NAMESPACE, '/jam/create', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [$this, 'create_room'],
            'permission_callback' => '__return_true',
        ]);

        // 2. Herkese Açık Odaları Listeleme: GET /wp-json/radiotedu/v1/jam/public-rooms
        register_rest_route(self::NAMESPACE, '/jam/public-rooms', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'get_public_rooms'],
            'permission_callback' => '__return_true',
        ]);

        // 3. Özel/Belirli Oda Sorgulama: GET /wp-json/radiotedu/v1/jam/rooms/(?P<code>[0-9]{6})
        register_rest_route(self::NAMESPACE, '/jam/rooms/(?P<code>[0-9]{6})', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'get_room'],
            'permission_callback' => '__return_true',
        ]);

        // 4. Odaya Katılma: POST /wp-json/radiotedu/v1/jam/rooms/(?P<code>[0-9]{6})/join
        register_rest_route(self::NAMESPACE, '/jam/rooms/(?P<code>[0-9]{6})/join', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [$this, 'join_room'],
            'permission_callback' => '__return_true',
        ]);

        // 5. Canlı Reaksiyon Gönderme: POST /wp-json/radiotedu/v1/jam/rooms/(?P<code>[0-9]{6})/react
        register_rest_route(self::NAMESPACE, '/jam/rooms/(?P<code>[0-9]{6})/react', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [$this, 'react_room'],
            'permission_callback' => '__return_true',
        ]);

        // 6. Canlı Ephemeral Chat Mesajı: POST /wp-json/radiotedu/v1/jam/rooms/(?P<code>[0-9]{6})/chat
        register_rest_route(self::NAMESPACE, '/jam/rooms/(?P<code>[0-9]{6})/chat', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [$this, 'send_chat_message'],
            'permission_callback' => '__return_true',
        ]);

        // 7. Canlı Durum Polling: GET /wp-json/radiotedu/v1/jam/rooms/(?P<code>[0-9]{6})/state
        register_rest_route(self::NAMESPACE, '/jam/rooms/(?P<code>[0-9]{6})/state', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'state_room'],
            'permission_callback' => '__return_true',
        ]);

        // 8. Odadan Ayrılma: POST /wp-json/radiotedu/v1/jam/rooms/(?P<code>[0-9]{6})/leave
        register_rest_route(self::NAMESPACE, '/jam/rooms/(?P<code>[0-9]{6})/leave', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [$this, 'leave_room'],
            'permission_callback' => '__return_true',
        ]);
    }

    /**
     * Intercept preflight OPTIONS requests and enforce CORS headers on all Jam endpoints
     */
    public function handle_preflight_and_cors(bool $served, $result, WP_REST_Request $request, WP_REST_Server $server): bool
    {
        $route = (string) $request->get_route();
        if (str_contains($route, '/radiotedu/v1/jam')) {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
            header('Access-Control-Max-Age: 86400');

            if ($request->get_method() === 'OPTIONS') {
                status_header(200);
                exit;
            }
        }
        return $served;
    }

    /**
     * Attach CORS headers directly to WP_REST_Response
     */
    private function respond_with_cors(WP_REST_Response $response): WP_REST_Response
    {
        $response->header('Access-Control-Allow-Origin', '*');
        $response->header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        $response->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        return $response;
    }

    /**
     * Normalize strings according to RadioTEDU branding guidelines
     */
    private function normalize_brand_text(string $text): string
    {
        // Strictly prevent 'RADİOTEDU' error in Turkish locale
        return str_replace(['RADİOTEDU', 'radiotedu'], ['RADIOTEDU', 'RadioTEDU'], $text);
    }

    /**
     * Generate a unique 6-digit room code with collision prevention
     */
    private function generate_unique_code(): string
    {
        for ($i = 0; $i < 20; $i++) {
            $code = (string) wp_rand(100000, 999999);
            if (get_transient('rt_jam_room_' . $code) === false) {
                return $code;
            }
        }
        // Fallback guaranteed 6-digit code
        return str_pad((string) (time() % 900000 + 100000), 6, '0', STR_PAD_LEFT);
    }

    /**
     * Maintain list of active room codes in transient
     */
    private function add_to_active_index(string $code): void
    {
        $index = get_transient('rt_jam_active_index');
        if (!is_array($index)) {
            $index = [];
        }
        // Purge expired rooms during addition
        $cleaned = [];
        foreach ($index as $existingCode) {
            $c = (string) $existingCode;
            if ($c !== $code && get_transient('rt_jam_room_' . $c) !== false) {
                $cleaned[] = $c;
            }
        }
        $cleaned[] = $code;
        set_transient('rt_jam_active_index', array_values(array_unique($cleaned)), self::ROOM_TTL);
    }

    /**
     * Remove room code from active transient index
     */
    private function remove_from_active_index(string $code): void
    {
        $index = get_transient('rt_jam_active_index');
        if (is_array($index)) {
            $index = array_values(array_filter($index, static fn($c): bool => (string) $c !== $code));
            set_transient('rt_jam_active_index', $index, self::ROOM_TTL);
        }
    }

    /**
     * 1. CREATE ROOM
     * POST /wp-json/radiotedu/v1/jam/create
     */
    public function create_room(WP_REST_Request $request): WP_REST_Response
    {
        $channelId = sanitize_text_field((string) ($request->get_param('channel_id') ?: 'radiotedu'));
        $rawChannelName = (string) ($request->get_param('channel_name') ?: 'RadioTEDU');
        $channelName = $this->normalize_brand_text(sanitize_text_field($rawChannelName));
        $rawHostName = (string) ($request->get_param('host_name') ?: 'TEDÜ Dinleyicisi');
        $hostName = $this->normalize_brand_text(sanitize_text_field($rawHostName));

        $rawIsPublic = $request->get_param('is_public');
        $isPublic = ($rawIsPublic === null || $rawIsPublic === '' || rest_sanitize_boolean($rawIsPublic));

        $now = time();
        $code = $this->generate_unique_code();
        $hostId = sanitize_text_field((string) ($request->get_param('host_id') ?: ('listener-host-' . $now)));

        $hostListener = [
            'id' => $hostId,
            'name' => $hostName,
            'is_host' => true,
            'joined_at' => $now,
        ];

        $room = [
            'code' => $code,
            'channel_id' => $channelId,
            'channel_name' => $channelName,
            'host_name' => $hostName,
            'host_id' => $hostId,
            'is_public' => $isPublic,
            'created_at' => $now,
            'expires_at' => $now + self::ROOM_TTL,
            'listeners_count' => 1,
            'listeners' => [$hostListener],
        ];

        set_transient('rt_jam_room_' . $code, $room, self::ROOM_TTL);
        $this->add_to_active_index($code);

        $payload = array_merge(['success' => true], $room);
        unset($payload['host_id']); // Internal reference only

        $response = new WP_REST_Response($payload, 201);
        return $this->respond_with_cors($response);
    }

    /**
     * 2. LIST PUBLIC ACTIVE ROOMS
     * GET /wp-json/radiotedu/v1/jam/public-rooms
     */
    public function get_public_rooms(WP_REST_Request $request): WP_REST_Response
    {
        $index = get_transient('rt_jam_active_index');
        $publicRooms = [];
        $validCodes = [];

        if (is_array($index)) {
            foreach ($index as $code) {
                $codeStr = (string) $code;
                $room = get_transient('rt_jam_room_' . $codeStr);
                if (is_array($room)) {
                    $validCodes[] = $codeStr;
                    // Filter: public rooms only
                    if (!isset($room['is_public']) || !empty($room['is_public'])) {
                        $listeners = is_array($room['listeners'] ?? null) ? array_values($room['listeners']) : [];
                        $publicRooms[] = [
                            'code' => $codeStr,
                            'channel_id' => (string) ($room['channel_id'] ?? 'radiotedu'),
                            'channel_name' => (string) ($room['channel_name'] ?? 'RadioTEDU'),
                            'host_name' => (string) ($room['host_name'] ?? 'TEDÜ Dinleyicisi'),
                            'listeners_count' => count($listeners),
                            'created_at' => (int) ($room['created_at'] ?? time()),
                        ];
                    }
                }
            }

            // Prune expired rooms from active index
            if (count($validCodes) !== count($index)) {
                set_transient('rt_jam_active_index', $validCodes, self::ROOM_TTL);
            }
        }

        // Sort by listener count DESC, then created_at DESC
        usort($publicRooms, static function ($a, $b) {
            if ($b['listeners_count'] !== $a['listeners_count']) {
                return $b['listeners_count'] <=> $a['listeners_count'];
            }
            return $b['created_at'] <=> $a['created_at'];
        });

        $payload = [
            'success' => true,
            'rooms_count' => count($publicRooms),
            'rooms' => $publicRooms,
        ];

        return $this->respond_with_cors(new WP_REST_Response($payload, 200));
    }

    /**
     * 3. GET ROOM DETAILS
     * GET /wp-json/radiotedu/v1/jam/rooms/{code}
     */
    public function get_room(WP_REST_Request $request): WP_REST_Response
    {
        $code = (string) $request['code'];
        $room = get_transient('rt_jam_room_' . $code);

        if (!is_array($room)) {
            $response = new WP_REST_Response([
                'code' => 'room_not_found',
                'message' => 'Oda bulunamadı veya süresi doldu.',
                'data' => ['status' => 404],
            ], 404);
            return $this->respond_with_cors($response);
        }

        $listeners = is_array($room['listeners'] ?? null) ? array_values($room['listeners']) : [];

        $payload = [
            'success' => true,
            'code' => (string) $room['code'],
            'channel_id' => (string) ($room['channel_id'] ?? 'radiotedu'),
            'channel_name' => (string) ($room['channel_name'] ?? 'RadioTEDU'),
            'host_name' => (string) ($room['host_name'] ?? 'TEDÜ Dinleyicisi'),
            'is_public' => !empty($room['is_public']),
            'created_at' => (int) ($room['created_at'] ?? time()),
            'listeners_count' => count($listeners),
            'listeners' => $listeners,
        ];

        return $this->respond_with_cors(new WP_REST_Response($payload, 200));
    }

    /**
     * 3. JOIN ROOM
     * POST /wp-json/radiotedu/v1/jam/rooms/{code}/join
     */
    public function join_room(WP_REST_Request $request): WP_REST_Response
    {
        $code = (string) $request['code'];
        $room = get_transient('rt_jam_room_' . $code);

        if (!is_array($room)) {
            $response = new WP_REST_Response([
                'code' => 'room_not_found',
                'message' => 'Oda bulunamadı veya süresi doldu.',
                'data' => ['status' => 404],
            ], 404);
            return $this->respond_with_cors($response);
        }

        $now = time();
        $listenerId = sanitize_text_field((string) ($request->get_param('listener_id') ?: ('listener-' . $now . '-' . wp_rand(100, 999))));
        $rawName = (string) ($request->get_param('listener_name') ?: 'TEDÜ Dinleyicisi');
        $listenerName = $this->normalize_brand_text(sanitize_text_field($rawName));

        if (!isset($room['listeners']) || !is_array($room['listeners'])) {
            $room['listeners'] = [];
        }

        $found = false;
        foreach ($room['listeners'] as &$listener) {
            if (($listener['id'] ?? '') === $listenerId) {
                $listener['name'] = $listenerName;
                $listener['last_active'] = $now;
                $found = true;
                break;
            }
        }
        unset($listener);

        if (!$found) {
            $room['listeners'][] = [
                'id' => $listenerId,
                'name' => $listenerName,
                'is_host' => false,
                'joined_at' => $now,
            ];
        }

        $room['listeners_count'] = count($room['listeners']);
        set_transient('rt_jam_room_' . $code, $room, self::ROOM_TTL);

        $payload = [
            'success' => true,
            'code' => (string) $room['code'],
            'channel_id' => (string) ($room['channel_id'] ?? 'radiotedu'),
            'channel_name' => (string) ($room['channel_name'] ?? 'RadioTEDU'),
            'host_name' => (string) ($room['host_name'] ?? 'TEDÜ Dinleyicisi'),
            'listeners_count' => (int) $room['listeners_count'],
        ];

        return $this->respond_with_cors(new WP_REST_Response($payload, 200));
    }

    /**
     * 4. LIVE EMOJI REACTION
     * POST /wp-json/radiotedu/v1/jam/rooms/{code}/react
     */
    public function react_room(WP_REST_Request $request): WP_REST_Response
    {
        $code = (string) $request['code'];
        $room = get_transient('rt_jam_room_' . $code);

        if (!is_array($room)) {
            $response = new WP_REST_Response([
                'code' => 'room_not_found',
                'message' => 'Oda bulunamadı veya süresi doldu.',
                'data' => ['status' => 404],
            ], 404);
            return $this->respond_with_cors($response);
        }

        $now = time();
        $rawEmoji = trim((string) $request->get_param('emoji'));
        $emoji = $rawEmoji !== '' ? mb_substr(strip_tags($rawEmoji), 0, 8) : '🔥';
        $rawSender = (string) ($request->get_param('sender_name') ?: 'TEDÜ Dinleyicisi');
        $senderName = $this->normalize_brand_text(sanitize_text_field($rawSender));

        $reactionId = 'rx-' . $now . '-' . substr(bin2hex(random_bytes(2)), 0, 4);
        $reaction = [
            'id' => $reactionId,
            'emoji' => $emoji,
            'sender_name' => $senderName,
            'timestamp' => $now,
        ];

        // Store reaction in sliding transient queue
        $rxKey = 'rt_jam_rx_' . $code;
        $existing = get_transient($rxKey);
        if (!is_array($existing)) {
            $existing = [];
        }

        // Retain only reactions from the last 60 seconds
        $validReactions = [];
        foreach ($existing as $item) {
            if (isset($item['timestamp']) && ($now - (int) $item['timestamp'] <= self::RX_WINDOW)) {
                $validReactions[] = $item;
            }
        }
        $validReactions[] = $reaction;

        // Cap at MAX_REACTIONS (20)
        if (count($validReactions) > self::MAX_REACTIONS) {
            $validReactions = array_slice($validReactions, -self::MAX_REACTIONS);
        }

        set_transient($rxKey, $validReactions, self::RX_TTL);

        $payload = [
            'success' => true,
            'reaction' => $reaction,
        ];

        return $this->respond_with_cors(new WP_REST_Response($payload, 200));
    }

    /**
     * 6. LIVE EPHEMERAL CHAT MESSAGE (Anti-mIRC, acoustic live overlay)
     * POST /wp-json/radiotedu/v1/jam/rooms/{code}/chat
     */
    public function send_chat_message(WP_REST_Request $request): WP_REST_Response
    {
        $code = (string) $request['code'];
        $room = get_transient('rt_jam_room_' . $code);

        if (!is_array($room)) {
            $response = new WP_REST_Response([
                'code' => 'room_not_found',
                'message' => 'Oda bulunamadı veya süresi doldu.',
                'data' => ['status' => 404],
            ], 404);
            return $this->respond_with_cors($response);
        }

        $now = time();
        $senderId = sanitize_text_field((string) ($request->get_param('sender_id') ?: ('listener-' . $now)));

        // Cooldown rate limit (3 seconds per sender)
        $rateKey = 'rt_jam_rate_' . $code . '_' . md5($senderId);
        if (get_transient($rateKey) !== false) {
            $response = new WP_REST_Response([
                'code' => 'rate_limited',
                'message' => 'Lütfen yeni mesaj göndermek için birkaç saniye bekleyin.',
                'data' => ['status' => 429],
            ], 429);
            return $this->respond_with_cors($response);
        }

        $rawText = (string) $request->get_param('message');
        $cleanText = trim(strip_tags($rawText));
        // Remove excessive spaces/newlines and strip URLs
        $cleanText = preg_replace('/\s+/', ' ', $cleanText);
        $cleanText = preg_replace('/https?:\/\/\S+/i', '[link kaldırıldı]', $cleanText);
        $cleanText = mb_substr($cleanText, 0, 100);

        if ($cleanText === '') {
            $response = new WP_REST_Response([
                'code' => 'empty_message',
                'message' => 'Boş mesaj gönderilemez.',
                'data' => ['status' => 400],
            ], 400);
            return $this->respond_with_cors($response);
        }

        $cleanText = $this->normalize_brand_text($cleanText);
        $rawSender = (string) ($request->get_param('sender_name') ?: 'TEDÜ Dinleyicisi');
        $senderName = $this->normalize_brand_text(sanitize_text_field($rawSender));

        $msgId = 'msg-' . $now . '-' . substr(bin2hex(random_bytes(2)), 0, 4);
        $message = [
            'id' => $msgId,
            'sender_id' => $senderId,
            'sender_name' => $senderName,
            'text' => $cleanText,
            'timestamp' => $now,
        ];

        $chatKey = 'rt_jam_chat_' . $code;
        $existing = get_transient($chatKey);
        if (!is_array($existing)) {
            $existing = [];
        }

        $validChat = [];
        foreach ($existing as $item) {
            if (isset($item['timestamp']) && ($now - (int) $item['timestamp'] <= self::CHAT_WINDOW)) {
                $validChat[] = $item;
            }
        }
        $validChat[] = $message;

        if (count($validChat) > self::MAX_CHAT_MESSAGES) {
            $validChat = array_slice($validChat, -self::MAX_CHAT_MESSAGES);
        }

        set_transient($chatKey, $validChat, self::CHAT_TTL);
        set_transient($rateKey, 1, self::CHAT_COOLDOWN);

        $payload = [
            'success' => true,
            'message' => $message,
        ];

        return $this->respond_with_cors(new WP_REST_Response($payload, 200));
    }

    /**
     * 7. LIGHTWEIGHT STATE POLLING
     * GET /wp-json/radiotedu/v1/jam/rooms/{code}/state
     */
    public function state_room(WP_REST_Request $request): WP_REST_Response
    {
        $code = (string) $request['code'];
        $room = get_transient('rt_jam_room_' . $code);

        if (!is_array($room)) {
            $response = new WP_REST_Response([
                'code' => 'room_not_found',
                'message' => 'Oda bulunamadı veya süresi doldu.',
                'data' => ['status' => 404],
            ], 404);
            return $this->respond_with_cors($response);
        }

        $now = time();
        $rxKey = 'rt_jam_rx_' . $code;
        $existingRx = get_transient($rxKey);
        $recentReactions = [];
        if (is_array($existingRx)) {
            foreach ($existingRx as $item) {
                if (isset($item['timestamp']) && ($now - (int) $item['timestamp'] <= self::RX_WINDOW)) {
                    $recentReactions[] = $item;
                }
            }
        }

        // Ephemeral chat messages in sliding window
        $chatKey = 'rt_jam_chat_' . $code;
        $existingChat = get_transient($chatKey);
        $recentMessages = [];
        if (is_array($existingChat)) {
            foreach ($existingChat as $item) {
                if (isset($item['timestamp']) && ($now - (int) $item['timestamp'] <= self::CHAT_WINDOW)) {
                    $recentMessages[] = $item;
                }
            }
        }

        $listeners = is_array($room['listeners'] ?? null) ? array_values($room['listeners']) : [];

        $payload = [
            'code' => (string) $room['code'],
            'channel_id' => (string) ($room['channel_id'] ?? 'radiotedu'),
            'channel_name' => (string) ($room['channel_name'] ?? 'RadioTEDU'),
            'host_name' => (string) ($room['host_name'] ?? 'TEDÜ Dinleyicisi'),
            'is_public' => !empty($room['is_public']),
            'listeners_count' => count($listeners),
            'listeners' => $listeners,
            'recent_reactions' => array_values($recentReactions),
            'recent_messages' => array_values($recentMessages),
        ];

        return $this->respond_with_cors(new WP_REST_Response($payload, 200));
    }

    /**
     * 8. LEAVE ROOM / AUTO-CLOSE CLEANUP
     * POST /wp-json/radiotedu/v1/jam/rooms/{code}/leave
     */
    public function leave_room(WP_REST_Request $request): WP_REST_Response
    {
        $code = (string) $request['code'];
        $room = get_transient('rt_jam_room_' . $code);

        if (!is_array($room)) {
            $payload = [
                'success' => true,
                'message' => 'Oda zaten kapatılmış veya süresi dolmuş.',
                'room_closed' => true,
            ];
            return $this->respond_with_cors(new WP_REST_Response($payload, 200));
        }

        $listenerId = sanitize_text_field((string) $request->get_param('listener_id'));
        $listeners = is_array($room['listeners'] ?? null) ? $room['listeners'] : [];

        $isHostLeaving = false;
        $remainingListeners = [];

        foreach ($listeners as $listener) {
            $currentId = (string) ($listener['id'] ?? '');
            if ($currentId === $listenerId) {
                if (!empty($listener['is_host']) || $listenerId === ($room['host_id'] ?? '')) {
                    $isHostLeaving = true;
                }
            } else {
                $remainingListeners[] = $listener;
            }
        }

        // If host left or 0 listeners remain, close and delete the ephemeral room
        if ($isHostLeaving || empty($remainingListeners)) {
            delete_transient('rt_jam_room_' . $code);
            delete_transient('rt_jam_rx_' . $code);
            delete_transient('rt_jam_chat_' . $code);
            $this->remove_from_active_index($code);

            $payload = [
                'success' => true,
                'message' => 'Oda kapatıldı.',
                'room_closed' => true,
            ];
        } else {
            $room['listeners'] = array_values($remainingListeners);
            $room['listeners_count'] = count($room['listeners']);
            set_transient('rt_jam_room_' . $code, $room, self::ROOM_TTL);

            $payload = [
                'success' => true,
                'message' => 'Odadan ayrılındı.',
                'room_closed' => false,
                'listeners_count' => $room['listeners_count'],
            ];
        }

        return $this->respond_with_cors(new WP_REST_Response($payload, 200));
    }
}

/**
 * Procedural fallback wrappers matching legacy/standalone hook registrations
 */
function radiotedu_jam_create_room(WP_REST_Request $request): WP_REST_Response
{
    return RadioTEDU_Jam::instance()->create_room($request);
}

function radiotedu_jam_get_room(WP_REST_Request $request): WP_REST_Response
{
    return RadioTEDU_Jam::instance()->get_room($request);
}

function radiotedu_jam_join_room(WP_REST_Request $request): WP_REST_Response
{
    return RadioTEDU_Jam::instance()->join_room($request);
}

function radiotedu_jam_react_room(WP_REST_Request $request): WP_REST_Response
{
    return RadioTEDU_Jam::instance()->react_room($request);
}

function radiotedu_jam_state_room(WP_REST_Request $request): WP_REST_Response
{
    return RadioTEDU_Jam::instance()->state_room($request);
}

function radiotedu_jam_leave_room(WP_REST_Request $request): WP_REST_Response
{
    return RadioTEDU_Jam::instance()->leave_room($request);
}
