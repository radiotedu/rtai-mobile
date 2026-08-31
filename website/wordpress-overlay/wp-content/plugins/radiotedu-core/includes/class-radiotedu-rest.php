<?php
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class RadioTEDU_REST
{
    private static ?self $instance = null;
    private const NAMESPACE = 'radiotedu/v1';

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
    }

    public function register_routes(): void
    {
        register_rest_route(self::NAMESPACE, '/stations', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'stations'],
            'permission_callback' => '__return_true',
        ]);
        register_rest_route(self::NAMESPACE, '/stations/(?P<id>[a-z0-9-]+)/live', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'station_live'],
            'permission_callback' => '__return_true',
        ]);
        register_rest_route(self::NAMESPACE, '/stations/(?P<id>[a-z0-9-]+)/schedule', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'station_schedule'],
            'permission_callback' => '__return_true',
        ]);
        register_rest_route(self::NAMESPACE, '/stations/(?P<id>[a-z0-9-]+)/history', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'station_history'],
            'permission_callback' => '__return_true',
        ]);
        register_rest_route(self::NAMESPACE, '/podcasts', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'podcasts'],
            'permission_callback' => '__return_true',
        ]);
        register_rest_route(self::NAMESPACE, '/podcasts/(?P<id>[a-zA-Z0-9-]+)/episodes', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'podcast_episodes'],
            'permission_callback' => '__return_true',
        ]);
        register_rest_route(self::NAMESPACE, '/search', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'search'],
            'permission_callback' => '__return_true',
            'args' => ['q' => ['required' => true, 'sanitize_callback' => 'sanitize_text_field']],
        ]);
        register_rest_route(self::NAMESPACE, '/podcasts/sync', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [$this, 'sync_podcasts'],
            'permission_callback' => static fn (): bool => current_user_can('manage_options'),
        ]);
    }

    public function stations(): WP_REST_Response
    {
        $posts = get_posts([
            'post_type' => 'rt_station',
            'post_status' => 'publish',
            'numberposts' => -1,
            'meta_key' => '_rt_station_order',
            'orderby' => ['meta_value_num' => 'ASC', 'title' => 'ASC'],
        ]);
        return rest_ensure_response(array_map([$this, 'station_payload'], $posts));
    }

    public function station_live(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $station = $this->find_by_stable_id('rt_station', (string) $request['id']);
        if (!$station) {
            return new WP_Error('station_not_found', 'Radyo bulunamadı.', ['status' => 404]);
        }

        $includePlayerMetadata = rest_sanitize_boolean($request->get_param('player'));
        $clockOnly = rest_sanitize_boolean($request->get_param('clock'));
        $includeStreamMetadata = $includePlayerMetadata || $clockOnly;
        $stationStableId = (string) get_post_meta($station->ID, '_rt_stable_id', true);
        $stationIdentity = strtolower($stationStableId . ' ' . $station->post_title);
        $isLofi = str_contains($stationIdentity, 'lofi') || str_contains($stationIdentity, 'lo-fi');
        $cacheSuffix = $includePlayerMetadata ? '_player' : ($clockOnly ? '_clock' : '');
        $cacheKey = 'rt_live_' . md5((string) $request['id']) . $cacheSuffix;
        $cached = get_transient($cacheKey);
        if (is_array($cached)) {
            return rest_ensure_response($cached);
        }

        $streamUrl = (string) get_post_meta($station->ID, '_rt_stream_url', true);
        $metadataUrl = (string) get_post_meta($station->ID, '_rt_metadata_url', true);
        $payload = [
            'station_id' => (string) get_post_meta($station->ID, '_rt_stable_id', true),
            'online' => (bool) get_post_meta($station->ID, '_rt_is_online', true),
            'stream_url' => esc_url_raw($streamUrl),
            'title' => $station->post_title,
            'track' => null,
            'artist' => null,
            'track_started_at' => null,
            'listeners' => null,
            'artwork_url' => null,
            'purchase' => ['apple' => null, 'amazon' => null],
            'checked_at' => gmdate(DATE_ATOM),
        ];

        if ($metadataUrl !== '') {
            $response = wp_remote_get($metadataUrl, ['timeout' => 3, 'headers' => ['Accept' => 'application/json']]);
            if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
                $json = json_decode((string) wp_remote_retrieve_body($response), true);
                if (is_array($json)) {
                    $metadata = $this->extract_external_metadata($json, $streamUrl);
                    $payload['online'] = true;
                    $payload['track'] = $metadata['track'];
                    $payload['artist'] = $metadata['artist'];
                    $payload['listeners'] = $metadata['listeners'];
                }
            }
        } elseif ($includeStreamMetadata && !$isLofi && $streamUrl !== '') {
            $metadata = $this->read_icy_metadata($streamUrl);
            if ($metadata !== []) {
                $payload['online'] = true;
                $payload['track'] = $metadata['track'];
                $payload['artist'] = $metadata['artist'];
            }
        }

        if ($includeStreamMetadata && !$isLofi && $payload['track']) {
            if ($includePlayerMetadata) {
                $catalog = $this->lookup_track_catalog((string) ($payload['artist'] ?? ''), (string) $payload['track']);
                $payload['artwork_url'] = $catalog['artwork_url'];
                $payload['purchase'] = $catalog['purchase'];
            }
            $payload['track_started_at'] = $this->track_started_at(
                $stationStableId,
                (string) ($payload['artist'] ?? ''),
                (string) $payload['track']
            );
        }

        $payload = apply_filters('radiotedu_station_live_payload', $payload, $station);
        set_transient($cacheKey, $payload, $clockOnly ? 2 : 5);
        return rest_ensure_response($payload);
    }

    public function station_schedule(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $station = $this->find_by_stable_id('rt_station', (string) $request['id']);
        if (!$station) {
            return new WP_Error('station_not_found', 'Radyo bulunamadı.', ['status' => 404]);
        }
        $weekday = $request->get_param('weekday');
        $slots = RadioTEDU_Schedule::get_slots($station->ID, $weekday === null ? null : absint($weekday));
        return rest_ensure_response(array_map(static function (object $slot): array {
            $programId = (int) $slot->program_id;
            return [
                'id' => (int) $slot->id,
                'weekday' => (int) $slot->weekday,
                'start' => substr((string) $slot->start_time, 0, 5),
                'end' => substr((string) $slot->end_time, 0, 5),
                'program' => [
                    'id' => RadioTEDU_Content::stable_id($programId),
                    'title' => get_the_title($programId),
                    'url' => get_permalink($programId),
                    'presenters' => (string) get_post_meta($programId, '_rt_presenters', true),
                ],
            ];
        }, $slots));
    }

    public function station_history(WP_REST_Request $request): WP_REST_Response
    {
        $stationId = sanitize_key((string) $request['id']);
        $url = home_url('/jukebox/api/v1/radio/history/' . rawurlencode($stationId));
        $response = wp_remote_get($url, ['timeout' => 4, 'headers' => ['Accept' => 'application/json']]);
        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
            return rest_ensure_response([]);
        }
        $body = json_decode((string) wp_remote_retrieve_body($response), true);
        return rest_ensure_response(is_array($body['data'] ?? null) ? $body['data'] : []);
    }

    public function podcasts(): WP_REST_Response
    {
        $posts = get_posts(['post_type' => 'rt_podcast_show', 'post_status' => 'publish', 'numberposts' => -1, 'orderby' => 'date', 'order' => 'DESC']);
        return rest_ensure_response(array_map([$this, 'podcast_payload'], $posts));
    }

    public function podcast_episodes(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $show = $this->find_by_stable_id('rt_podcast_show', (string) $request['id']);
        if (!$show && ctype_digit((string) $request['id'])) {
            $candidate = get_post(absint($request['id']));
            $show = $candidate instanceof WP_Post && $candidate->post_type === 'rt_podcast_show' ? $candidate : null;
        }
        if (!$show) {
            return new WP_Error('podcast_not_found', 'Podcast serisi bulunamadı.', ['status' => 404]);
        }

        $page = max(1, absint($request->get_param('page') ?: 1));
        $query = new WP_Query([
            'post_type' => 'rt_podcast_episode',
            'post_status' => 'publish',
            'posts_per_page' => 20,
            'paged' => $page,
            'meta_key' => '_rt_show_id',
            'meta_value' => $show->ID,
            'orderby' => 'date',
            'order' => 'DESC',
        ]);
        return rest_ensure_response([
            'items' => array_map([$this, 'episode_payload'], $query->posts),
            'page' => $page,
            'pages' => (int) $query->max_num_pages,
            'total' => (int) $query->found_posts,
        ]);
    }

    public function search(WP_REST_Request $request): WP_REST_Response
    {
        $query = new WP_Query([
            's' => (string) $request->get_param('q'),
            'post_type' => ['rt_station', 'rt_podcast_show', 'rt_podcast_episode', 'rt_program', 'post', 'page'],
            'post_status' => 'publish',
            'posts_per_page' => min(30, max(1, absint($request->get_param('per_page') ?: 20))),
        ]);
        $items = array_map(static fn (WP_Post $post): array => [
            'id' => in_array($post->post_type, ['post', 'page'], true) ? (string) $post->ID : RadioTEDU_Content::stable_id($post->ID),
            'type' => $post->post_type,
            'title' => get_the_title($post),
            'excerpt' => wp_trim_words(wp_strip_all_tags(get_the_excerpt($post)), 24),
            'url' => get_permalink($post),
            'image' => get_the_post_thumbnail_url($post, 'medium_large') ?: null,
        ], $query->posts);
        return rest_ensure_response(['items' => $items, 'total' => (int) $query->found_posts]);
    }

    public function sync_podcasts(): WP_REST_Response
    {
        return rest_ensure_response(RadioTEDU_Podcast_Sync::instance()->sync_all());
    }

    private function extract_external_metadata(array $json, string $streamUrl): array
    {
        $candidates = [$json];
        foreach (['data', 'now_playing', 'current'] as $key) {
            if (is_array($json[$key] ?? null)) {
                $candidates[] = $json[$key];
            }
        }

        $sources = $json['icestats']['source'] ?? null;
        if (is_array($sources)) {
            $sources = array_is_list($sources) ? $sources : [$sources];
            $sources = array_values(array_filter($sources, 'is_array'));
            usort($sources, static function (array $left, array $right) use ($streamUrl): int {
                $leftPath = (string) wp_parse_url((string) ($left['listenurl'] ?? ''), PHP_URL_PATH);
                $rightPath = (string) wp_parse_url((string) ($right['listenurl'] ?? ''), PHP_URL_PATH);
                $leftMatches = $leftPath !== '' && str_contains($streamUrl, $leftPath);
                $rightMatches = $rightPath !== '' && str_contains($streamUrl, $rightPath);
                return (int) $rightMatches <=> (int) $leftMatches;
            });
            $candidates = array_merge($sources, $candidates);
        }

        foreach ($candidates as $candidate) {
            if (!is_array($candidate)) {
                continue;
            }
            $artist = $this->normalize_metadata_text((string) ($candidate['artist'] ?? ''));
            $track = $this->normalize_metadata_text((string) ($candidate['track'] ?? $candidate['title'] ?? $candidate['song'] ?? ''));
            if ($track === '') {
                continue;
            }
            $parsed = $artist !== ''
                ? ['artist' => $artist, 'track' => $track]
                : $this->parse_stream_title($track);
            return [
                'track' => $parsed['track'] ?? null,
                'artist' => $parsed['artist'] ?? null,
                'listeners' => isset($candidate['listeners']) ? absint($candidate['listeners']) : (isset($candidate['currentlisteners']) ? absint($candidate['currentlisteners']) : null),
            ];
        }

        return ['track' => null, 'artist' => null, 'listeners' => null];
    }

    private function read_icy_metadata(string $streamUrl): array
    {
        if (!function_exists('curl_init') || !$this->is_allowed_icy_stream_url($streamUrl)) {
            return [];
        }

        $state = [
            'metaint' => 0,
            'buffer' => '',
            'phase' => 'audio',
            'metadata_length' => 0,
            'blocks' => 0,
            'stream_title' => '',
        ];
        $handle = curl_init($streamUrl);
        if ($handle === false) {
            return [];
        }

        curl_setopt_array($handle, [
            CURLOPT_HTTPHEADER => ['Icy-MetaData: 1', 'Accept: audio/aac,audio/mpeg;q=0.9,*/*;q=0.1'],
            CURLOPT_USERAGENT => 'RadioTEDU-NowPlaying/1.0',
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_ENCODING => 'identity',
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_CONNECTTIMEOUT_MS => 1800,
            CURLOPT_TIMEOUT_MS => 5500,
            CURLOPT_NOSIGNAL => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            // The Windows PHP runtime does not inherit the browser/OS trust store.
            // WordPress ships and maintains this CA bundle for outbound HTTPS calls.
            CURLOPT_CAINFO => ABSPATH . WPINC . '/certificates/ca-bundle.crt',
            CURLOPT_HEADERFUNCTION => static function ($curl, string $header) use (&$state): int {
                if (stripos($header, 'icy-metaint:') === 0) {
                    $state['metaint'] = absint(trim(substr($header, strlen('icy-metaint:'))));
                }
                return strlen($header);
            },
            CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$state): int {
                $chunkLength = strlen($chunk);
                if ($state['metaint'] < 1) {
                    return $chunkLength;
                }
                $state['buffer'] .= $chunk;
                while (true) {
                    if ($state['phase'] === 'audio') {
                        if (strlen($state['buffer']) < $state['metaint']) {
                            break;
                        }
                        $state['buffer'] = (string) substr($state['buffer'], $state['metaint']);
                        $state['phase'] = 'length';
                    }
                    if ($state['phase'] === 'length') {
                        if ($state['buffer'] === '') {
                            break;
                        }
                        $state['metadata_length'] = ord($state['buffer'][0]) * 16;
                        $state['buffer'] = (string) substr($state['buffer'], 1);
                        $state['blocks']++;
                        if ($state['metadata_length'] === 0) {
                            $state['phase'] = 'audio';
                            if ($state['blocks'] >= 8) {
                                return 0;
                            }
                            continue;
                        }
                        $state['phase'] = 'metadata';
                    }
                    if ($state['phase'] === 'metadata') {
                        if (strlen($state['buffer']) < $state['metadata_length']) {
                            break;
                        }
                        $metadata = rtrim((string) substr($state['buffer'], 0, $state['metadata_length']), "\0");
                        $state['buffer'] = (string) substr($state['buffer'], $state['metadata_length']);
                        if (preg_match("/StreamTitle='([^']*)'/i", $metadata, $matches) === 1) {
                            $state['stream_title'] = trim(html_entity_decode($matches[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                        }
                        if ($state['stream_title'] !== '' || $state['blocks'] >= 8) {
                            return 0;
                        }
                        // Some Icecast relays start with a non-empty metadata block
                        // that does not yet contain StreamTitle. Scan the next block.
                        $state['metadata_length'] = 0;
                        $state['phase'] = 'audio';
                        continue;
                    }
                }
                return $chunkLength;
            },
        ]);

        curl_exec($handle);
        curl_close($handle);
        return $this->parse_stream_title((string) $state['stream_title']);
    }

    private function is_allowed_icy_stream_url(string $streamUrl): bool
    {
        $scheme = strtolower((string) wp_parse_url($streamUrl, PHP_URL_SCHEME));
        $host = strtolower((string) wp_parse_url($streamUrl, PHP_URL_HOST));
        $allowed = in_array($scheme, ['http', 'https'], true)
            && ($host === 'radiotedu.com' || str_ends_with($host, '.radiotedu.com'));
        return (bool) apply_filters('radiotedu_allowed_icy_stream_url', $allowed, $streamUrl);
    }

    private function parse_stream_title(string $streamTitle): array
    {
        $streamTitle = $this->normalize_metadata_text(html_entity_decode($streamTitle, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $streamTitle = str_replace(['—', '–'], '-', $streamTitle);
        if ($streamTitle === '') {
            return [];
        }
        if (preg_match('/^(.+?)\s+-\s+(.+)$/u', $streamTitle, $matches) === 1) {
            return ['artist' => trim($matches[1]), 'track' => trim($matches[2])];
        }
        return ['artist' => null, 'track' => $streamTitle];
    }

    private function normalize_metadata_text(string $value): string
    {
        $value = trim(str_replace("\0", '', $value));
        if ($value === '') {
            return '';
        }

        if (preg_match('//u', $value) !== 1 && function_exists('iconv')) {
            foreach (['Windows-1254', 'ISO-8859-9', 'Windows-1252', 'ISO-8859-1'] as $sourceEncoding) {
                $converted = @iconv($sourceEncoding, 'UTF-8//IGNORE', $value);
                if (is_string($converted) && $converted !== '' && preg_match('//u', $converted) === 1) {
                    $value = $converted;
                    break;
                }
            }
        }

        $value = strtr($value, [
            "\u{00C3}\u{2021}" => 'Ç', "\u{00C3}\u{2013}" => 'Ö', "\u{00C3}\u{0153}" => 'Ü',
            "\u{00C3}\u{00A7}" => 'ç', "\u{00C3}\u{00B6}" => 'ö', "\u{00C3}\u{00BC}" => 'ü',
            "\u{00C4}\u{00B1}" => 'ı', "\u{00C4}\u{00B0}" => 'İ', "\u{00C4}\u{0178}" => 'ğ', "\u{00C4}\u{017D}" => 'Ğ',
            "\u{00C5}\u{0178}" => 'ş', "\u{00C5}\u{017E}" => 'Ş',
            "\u{00E2}\u{20AC}\u{2122}" => '’', "\u{00E2}\u{20AC}\u{02DC}" => '‘',
            "\u{00E2}\u{20AC}\u{0153}" => '“', "\u{00E2}\u{20AC}\u{009D}" => '”',
        ]);

        return sanitize_text_field(wp_check_invalid_utf8($value, true));
    }

    private function lookup_track_catalog(string $artist, string $track): array
    {
        $empty = ['artwork_url' => null, 'purchase' => ['apple' => null, 'amazon' => null]];
        $artist = trim($artist);
        $track = trim($track);
        if ($track === '') {
            return $empty;
        }

        $cacheKey = 'rt_catalog_v6_' . md5($this->normalize_catalog_term($artist . '|' . $track));
        $cached = get_transient($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        $query = trim($artist . ' ' . $track);
        $amazonUrl = add_query_arg(['k' => $query, 'i' => 'digital-music'], 'https://www.amazon.com/s');
        $trackOnly = trim((string) preg_replace('/\s*[\(\[].*$/u', '', $track));
        $searchTerms = array_values(array_unique(array_filter([$query, $trackOnly])));
        $results = [];
        foreach ($searchTerms as $searchTerm) {
            $url = add_query_arg([
                'term' => $searchTerm,
                'country' => 'TR',
                'media' => 'music',
                'entity' => 'song',
                'limit' => 8,
            ], 'https://itunes.apple.com/search');
            $response = wp_remote_get($url, [
                'timeout' => 4,
                'redirection' => 2,
                'headers' => ['Accept' => 'application/json'],
                'user-agent' => 'RadioTEDU-Catalog/1.1',
            ]);
            if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
                continue;
            }
            $json = json_decode((string) wp_remote_retrieve_body($response), true);
            if (is_array($json['results'] ?? null)) {
                $results = array_merge($results, $json['results']);
            }
        }
        if ($results === []) {
            $empty['purchase']['amazon'] = esc_url_raw($amazonUrl);
            set_transient($cacheKey, $empty, 10 * MINUTE_IN_SECONDS);
            return $empty;
        }

        $targetArtist = $this->normalize_catalog_term($artist);
        $targetTrack = $this->normalize_catalog_term($track);
        $best = null;
        $bestScore = 0;
        $bestTrackScore = 0;
        foreach ($results as $result) {
            if (!is_array($result)) {
                continue;
            }
            $resultArtist = $this->normalize_catalog_term((string) ($result['artistName'] ?? ''));
            $resultTrack = $this->normalize_catalog_term((string) ($result['trackName'] ?? ''));
            $trackScore = $resultTrack === $targetTrack
                ? 60
                : ((str_contains($resultTrack, $targetTrack) || str_contains($targetTrack, $resultTrack))
                    ? 40
                    : $this->catalog_overlap_score($resultTrack, $targetTrack, 40));
            $artistScore = $targetArtist === ''
                ? 20
                : ($resultArtist === $targetArtist
                    ? 40
                    : ((str_contains($resultArtist, $targetArtist) || str_contains($targetArtist, $resultArtist))
                        ? 30
                        : $this->catalog_overlap_score($resultArtist, $targetArtist, 30)));
            $score = $trackScore + $artistScore;
            if ($score > $bestScore) {
                $best = $result;
                $bestScore = $score;
                $bestTrackScore = $trackScore;
            }
        }

        $payload = $empty;
        $payload['purchase']['amazon'] = esc_url_raw($amazonUrl);
        if (is_array($best) && ($bestScore >= ($targetArtist === '' ? 55 : 50) || $bestTrackScore >= 30)) {
            $artwork = (string) ($best['artworkUrl100'] ?? '');
            $payload['artwork_url'] = esc_url_raw(str_replace('100x100bb', '300x300bb', $artwork));
            $payload['purchase']['apple'] = esc_url_raw((string) ($best['trackViewUrl'] ?? '')) ?: null;
        }
        set_transient($cacheKey, $payload, 7 * DAY_IN_SECONDS);
        return $payload;
    }

    private function normalize_catalog_term(string $value): string
    {
        $value = strtolower(remove_accents(str_replace(["'", '’', '‘', '`'], '', $value)));
        $value = (string) preg_replace('/[^a-z0-9]+/u', ' ', $value);
        return trim((string) preg_replace('/\s+/u', ' ', $value));
    }

    private function catalog_overlap_score(string $left, string $right, int $maximum): int
    {
        $ignored = ['and', 'feat', 'featuring', 'ft', 'the', 'version', 'remaster', 'remastered', 'edit', 'mix'];
        $tokens = static function (string $value) use ($ignored): array {
            return array_values(array_unique(array_filter(
                explode(' ', $value),
                static fn (string $token): bool => strlen($token) >= 2 && !in_array($token, $ignored, true)
            )));
        };
        $leftTokens = $tokens($left);
        $rightTokens = $tokens($right);
        if ($leftTokens === [] || $rightTokens === []) {
            return 0;
        }
        $shared = count(array_intersect($leftTokens, $rightTokens));
        if ($shared < 2 && min(count($leftTokens), count($rightTokens)) > 1) {
            return 0;
        }
        return (int) round($maximum * ($shared / min(count($leftTokens), count($rightTokens))));
    }

    private function find_by_stable_id(string $postType, string $stableId): ?WP_Post
    {
        $posts = get_posts([
            'post_type' => $postType,
            'post_status' => 'publish',
            'meta_key' => '_rt_stable_id',
            'meta_value' => sanitize_text_field($stableId),
            'posts_per_page' => 1,
        ]);
        return $posts[0] ?? null;
    }

    private function track_started_at(string $stationId, string $artist, string $track): string
    {
        $cacheKey = 'rt_track_clock_' . md5($stationId);
        $fingerprint = hash('sha256', strtolower(trim($artist) . "\n" . trim($track)));
        $clock = get_transient($cacheKey);

        if (!is_array($clock) || !hash_equals((string) ($clock['fingerprint'] ?? ''), $fingerprint)) {
            $clock = [
                'fingerprint' => $fingerprint,
                // The ICY title is observed after transport and polling latency.
                // A small bounded correction keeps timestamped lyrics closer to
                // the audio listeners actually hear without guessing song length.
                'started_at' => max(0, time() - 2),
            ];
            set_transient($cacheKey, $clock, 12 * HOUR_IN_SECONDS);
        }

        return gmdate(DATE_ATOM, (int) $clock['started_at']);
    }

    private function station_payload(WP_Post $post): array
    {
        return [
            'id' => RadioTEDU_Content::stable_id($post->ID),
            'title' => get_the_title($post),
            'description' => wp_strip_all_tags(get_the_excerpt($post)),
            'url' => get_permalink($post),
            'artwork' => get_the_post_thumbnail_url($post, 'radiotedu-square') ?: get_theme_file_uri('/assets/images/radiotedu-logo.png'),
            'streams' => [
                'default' => esc_url_raw((string) get_post_meta($post->ID, '_rt_stream_url', true)),
                'low' => esc_url_raw((string) get_post_meta($post->ID, '_rt_stream_low', true)),
                'medium' => esc_url_raw((string) get_post_meta($post->ID, '_rt_stream_medium', true)),
                'high' => esc_url_raw((string) get_post_meta($post->ID, '_rt_stream_high', true)),
                'lossless' => esc_url_raw((string) get_post_meta($post->ID, '_rt_stream_lossless', true)),
            ],
            'online' => (bool) get_post_meta($post->ID, '_rt_is_online', true),
            'featured' => (bool) get_post_meta($post->ID, '_rt_is_featured', true),
        ];
    }

    private function podcast_payload(WP_Post $post): array
    {
        return [
            'id' => RadioTEDU_Content::stable_id($post->ID),
            'title' => get_the_title($post),
            'description' => wp_strip_all_tags(get_the_excerpt($post)),
            'url' => get_permalink($post),
            'image' => get_the_post_thumbnail_url($post, 'radiotedu-square') ?: null,
            'hosts' => (string) get_post_meta($post->ID, '_rt_hosts', true),
            'spotify_url' => esc_url_raw((string) get_post_meta($post->ID, '_rt_spotify_url', true)),
            'featured' => (bool) get_post_meta($post->ID, '_rt_is_featured', true),
        ];
    }

    private function episode_payload(WP_Post $post): array
    {
        return [
            'id' => RadioTEDU_Content::stable_id($post->ID),
            'title' => get_the_title($post),
            'excerpt' => wp_strip_all_tags(get_the_excerpt($post)),
            'url' => get_permalink($post),
            'image' => get_the_post_thumbnail_url($post, 'radiotedu-square') ?: null,
            'audio_url' => esc_url_raw((string) get_post_meta($post->ID, '_rt_audio_url', true)),
            'external_url' => esc_url_raw((string) get_post_meta($post->ID, '_rt_external_url', true)),
            'duration' => absint(get_post_meta($post->ID, '_rt_duration', true)),
            'published_at' => get_the_date(DATE_ATOM, $post),
        ];
    }
}
