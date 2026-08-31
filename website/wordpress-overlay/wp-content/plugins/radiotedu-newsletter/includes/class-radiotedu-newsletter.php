<?php
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class RadioTEDU_Newsletter
{
    private const CONSENT_VERSION = 'newsletter-2026-08-31';
    private const MAX_BATCH = 5;

    private static array $config = [];

    public static function boot(): void
    {
        self::$config = self::load_config();
        add_action('rest_api_init', [self::class, 'register_routes']);
        add_action('admin_post_nopriv_radiotedu_newsletter_subscribe', [self::class, 'handle_form']);
        add_action('admin_post_radiotedu_newsletter_subscribe', [self::class, 'handle_form']);
        add_action('radiotedu_before_footer', [self::class, 'render_signup']);
        add_action('init', [self::class, 'register_rewrites']);
        add_filter('query_vars', [self::class, 'query_vars']);
        add_action('template_redirect', [self::class, 'render_preferences']);
    }

    public static function activate(): void
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset = $wpdb->get_charset_collate();
        $subscribers = self::subscribers_table();
        $issues = self::issues_table();
        $deliveries = self::deliveries_table();

        dbDelta("CREATE TABLE {$subscribers} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            email_hash char(64) NOT NULL,
            email_ciphertext longtext NOT NULL,
            management_token_hash char(64) NOT NULL,
            external_user_id varchar(64) NULL,
            language char(2) NOT NULL DEFAULT 'tr',
            language_locked tinyint(1) NOT NULL DEFAULT 0,
            status varchar(16) NOT NULL DEFAULT 'active',
            source_web tinyint(1) NOT NULL DEFAULT 0,
            source_erp tinyint(1) NOT NULL DEFAULT 0,
            consent_version varchar(64) NULL,
            consent_at datetime NULL,
            subscribed_at datetime NOT NULL,
            unsubscribed_at datetime NULL,
            last_erp_seen_at datetime NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY email_hash (email_hash),
            UNIQUE KEY management_token_hash (management_token_hash),
            KEY delivery_eligibility (status,source_web,source_erp)
        ) {$charset};");

        dbDelta("CREATE TABLE {$issues} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            issue_key char(10) NOT NULL,
            window_start datetime NOT NULL,
            window_end datetime NOT NULL,
            episode_ids longtext NOT NULL,
            status varchar(20) NOT NULL DEFAULT 'draft',
            created_at datetime NOT NULL,
            queued_at datetime NULL,
            completed_at datetime NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY issue_key (issue_key),
            KEY status (status)
        ) {$charset};");

        dbDelta("CREATE TABLE {$deliveries} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            issue_key char(10) NOT NULL,
            subscriber_id bigint(20) unsigned NOT NULL DEFAULT 0,
            recipient_hash char(64) NOT NULL,
            kind varchar(16) NOT NULL,
            language char(2) NOT NULL,
            status varchar(16) NOT NULL DEFAULT 'queued',
            attempt_count smallint(5) unsigned NOT NULL DEFAULT 0,
            scheduled_at datetime NOT NULL,
            sent_at datetime NULL,
            last_error varchar(190) NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY unique_delivery (issue_key,kind,recipient_hash),
            KEY queue (status,scheduled_at)
        ) {$charset};");

        update_option('radiotedu_newsletter_schema_version', RADIOTEDU_NEWSLETTER_VERSION, false);
        self::register_rewrites();
        flush_rewrite_rules(false);
    }

    public static function register_routes(): void
    {
        register_rest_route('radiotedu/v1', '/newsletter/subscribe', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [self::class, 'rest_subscribe'],
            'permission_callback' => '__return_true',
        ]);
        register_rest_route('radiotedu/v1', '/newsletter/unsubscribe', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [self::class, 'rest_unsubscribe'],
            'permission_callback' => '__return_true',
        ]);
    }

    public static function register_rewrites(): void
    {
        add_rewrite_rule('^bulten/tercihler/?$', 'index.php?rt_newsletter_manage=1&rt_lang=tr', 'top');
        add_rewrite_rule('^en/newsletter/preferences/?$', 'index.php?rt_newsletter_manage=1&rt_lang=en', 'top');
    }

    public static function query_vars(array $vars): array
    {
        $vars[] = 'rt_newsletter_manage';
        return $vars;
    }

    public static function render_signup(): void
    {
        $english = function_exists('radiotedu_current_language') && radiotedu_current_language() === 'en';
        $status = sanitize_key((string) ($_GET['newsletter'] ?? ''));
        ?>
        <section class="rt-newsletter" aria-labelledby="rt-newsletter-title" data-rt-newsletter>
            <div class="rt-newsletter__index" aria-hidden="true">MONTHLY / 01</div>
            <div class="rt-newsletter__copy">
                <p class="rt-kicker"><?php echo esc_html($english ? 'RadioTEDU monthly' : 'RadioTEDU aylık'); ?></p>
                <h2 id="rt-newsletter-title"><?php echo esc_html($english ? 'The month in podcasts.' : 'Podcastlerle geçen ay.'); ?></h2>
                <p><?php echo esc_html($english ? 'Receive only the podcast episodes published during the latest 30-day period. No daily mail and no unrelated announcements.' : 'Yalnızca son 30 günlük dönemde yayınlanan podcast bölümlerini al. Günlük posta ve ilgisiz duyuru yok.'); ?></p>
            </div>
            <form class="rt-newsletter__form" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" method="post" data-rt-newsletter-form>
                <input type="hidden" name="action" value="radiotedu_newsletter_subscribe">
                <input type="hidden" name="language" value="<?php echo esc_attr($english ? 'en' : 'tr'); ?>">
                <div class="rt-newsletter__trap" aria-hidden="true"><label>Website<input type="text" name="website" value="" tabindex="-1" autocomplete="off"></label></div>
                <?php wp_nonce_field('radiotedu_newsletter_subscribe', 'newsletter_nonce'); ?>
                <label for="rt-newsletter-email"><?php echo esc_html($english ? 'Email address' : 'E-posta adresi'); ?></label>
                <div class="rt-newsletter__field">
                    <input id="rt-newsletter-email" type="email" name="email" maxlength="254" autocomplete="email" inputmode="email" placeholder="name@example.com" required data-rt-newsletter-email>
                    <button type="submit"><?php echo esc_html($english ? 'Subscribe monthly' : 'Aylık abone ol'); ?></button>
                </div>
                <label class="rt-newsletter__consent">
                    <input type="checkbox" name="consent" value="1" required>
                    <span><?php echo esc_html($english ? 'I consent to receiving the monthly RadioTEDU podcast newsletter. I can unsubscribe at any time.' : 'Aylık RadioTEDU podcast bültenini almayı kabul ediyorum. İstediğim zaman abonelikten çıkabilirim.'); ?></span>
                </label>
                <p class="rt-newsletter__status" role="status" aria-live="polite" data-rt-newsletter-status><?php
                    if ($status === 'subscribed') {
                        echo esc_html($english ? 'Your monthly subscription is active.' : 'Aylık aboneliğin etkinleştirildi.');
                    } elseif ($status === 'invalid') {
                        echo esc_html($english ? 'Check your email address and consent, then try again.' : 'E-posta adresini ve onayını kontrol edip tekrar dene.');
                    }
                ?></p>
            </form>
        </section>
        <?php
    }

    public static function rest_subscribe(WP_REST_Request $request): WP_REST_Response
    {
        if (!self::origin_allowed($request)) {
            return new WP_REST_Response(['ok' => false, 'message' => 'Request origin is not allowed.'], 403);
        }
        $result = self::subscribe((array) $request->get_params());
        return new WP_REST_Response($result, $result['ok'] ? 200 : 400);
    }

    public static function handle_form(): void
    {
        $referer = wp_get_referer() ?: home_url('/');
        if (!isset($_POST['newsletter_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['newsletter_nonce'])), 'radiotedu_newsletter_subscribe')) {
            wp_safe_redirect(add_query_arg('newsletter', 'invalid', $referer));
            exit;
        }
        $result = self::subscribe(wp_unslash($_POST));
        wp_safe_redirect(add_query_arg('newsletter', $result['ok'] ? 'subscribed' : 'invalid', $referer) . '#rt-newsletter-title');
        exit;
    }

    private static function subscribe(array $input): array
    {
        if (!empty($input['website'])) {
            return ['ok' => true, 'message' => 'Subscription received.'];
        }
        if (!self::rate_limit('subscribe', 5, HOUR_IN_SECONDS)) {
            return ['ok' => false, 'message' => 'Please wait before trying again.'];
        }

        $email = strtolower(sanitize_email((string) ($input['email'] ?? '')));
        $language = self::language((string) ($input['language'] ?? 'tr'));
        $consent = (string) ($input['consent'] ?? '') === '1';
        if (!$consent || !is_email($email) || strlen($email) > 254) {
            return ['ok' => false, 'message' => $language === 'en' ? 'Check your email address and consent.' : 'E-posta adresini ve onayını kontrol et.'];
        }

        self::upsert_web_subscriber($email, $language);
        return ['ok' => true, 'message' => $language === 'en' ? 'Your monthly subscription is active.' : 'Aylık aboneliğin etkinleştirildi.'];
    }

    public static function rest_unsubscribe(WP_REST_Request $request): WP_REST_Response
    {
        $token = self::token((string) $request->get_param('token'));
        if ($token === '' || !self::unsubscribe($token)) {
            return new WP_REST_Response(['ok' => false], 400);
        }
        return new WP_REST_Response(['ok' => true], 200);
    }

    public static function render_preferences(): void
    {
        if ((string) get_query_var('rt_newsletter_manage') !== '1') {
            return;
        }

        status_header(200);
        nocache_headers();
        $token = self::token((string) ($_REQUEST['token'] ?? ''));
        $subscriber = $token !== '' ? self::subscriber_by_token($token) : null;
        $currentLanguage = self::language((string) ($_REQUEST['lang'] ?? get_query_var('rt_lang') ?? 'tr'));
        if (is_array($subscriber)) {
            $currentLanguage = self::language((string) $subscriber['language']);
        }
        $message = '';

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && is_array($subscriber)) {
            $nonce = sanitize_text_field(wp_unslash((string) ($_POST['newsletter_manage_nonce'] ?? '')));
            if (wp_verify_nonce($nonce, 'radiotedu_newsletter_manage_' . $token)) {
                $operation = sanitize_key((string) ($_POST['newsletter_operation'] ?? ''));
                if ($operation === 'unsubscribe') {
                    self::unsubscribe($token);
                    $subscriber['status'] = 'unsubscribed';
                    $message = $currentLanguage === 'en' ? 'Your monthly podcast newsletter has been stopped.' : 'Aylık podcast bültenin durduruldu.';
                } elseif ($operation === 'language') {
                    $currentLanguage = self::language((string) ($_POST['language'] ?? 'tr'));
                    self::update_language($token, $currentLanguage);
                    $subscriber['language'] = $currentLanguage;
                    $message = $currentLanguage === 'en' ? 'Your email language is now English.' : 'E-posta dilin artık Türkçe.';
                }
            }
        }

        $english = $currentLanguage === 'en';
        get_header();
        ?>
        <section class="rt-newsletter-manage">
            <p class="rt-kicker">RADIOTEDU / <?php echo esc_html($english ? 'EMAIL PREFERENCES' : 'E-POSTA TERCİHLERİ'); ?></p>
            <h1><?php echo esc_html($english ? 'Your monthly listening, your choice.' : 'Aylık dinleme özeti, senin seçimin.'); ?></h1>
            <?php if ($message !== ''): ?><p class="rt-newsletter-manage__notice" role="status"><?php echo esc_html($message); ?></p><?php endif; ?>
            <?php if (!is_array($subscriber)): ?>
                <p><?php echo esc_html($english ? 'This preference link is invalid or incomplete. Open the latest RadioTEDU email and use its footer link.' : 'Bu tercih bağlantısı geçersiz veya eksik. Son RadioTEDU e-postasının altındaki bağlantıyı kullan.'); ?></p>
            <?php else: ?>
                <div class="rt-newsletter-manage__grid">
                    <form method="post">
                        <?php wp_nonce_field('radiotedu_newsletter_manage_' . $token, 'newsletter_manage_nonce'); ?>
                        <input type="hidden" name="token" value="<?php echo esc_attr($token); ?>">
                        <input type="hidden" name="newsletter_operation" value="language">
                        <h2><?php echo esc_html($english ? 'Email language' : 'E-posta dili'); ?></h2>
                        <p><?php echo esc_html($english ? 'Choose the language used for future monthly issues.' : 'Gelecek aylık bültenlerin dilini seç.'); ?></p>
                        <div class="rt-newsletter-manage__languages">
                            <button type="submit" name="language" value="tr" aria-pressed="<?php echo $currentLanguage === 'tr' ? 'true' : 'false'; ?>">Türkçe</button>
                            <button type="submit" name="language" value="en" aria-pressed="<?php echo $currentLanguage === 'en' ? 'true' : 'false'; ?>">English</button>
                        </div>
                    </form>
                    <form method="post">
                        <?php wp_nonce_field('radiotedu_newsletter_manage_' . $token, 'newsletter_manage_nonce'); ?>
                        <input type="hidden" name="token" value="<?php echo esc_attr($token); ?>">
                        <input type="hidden" name="newsletter_operation" value="unsubscribe">
                        <h2><?php echo esc_html($english ? 'Stop this newsletter' : 'Bu bülteni durdur'); ?></h2>
                        <p><?php echo esc_html($english ? 'This affects only the monthly podcast newsletter. Account and service emails are unchanged.' : 'Bu işlem yalnızca aylık podcast bültenini etkiler. Hesap ve hizmet e-postaları değişmez.'); ?></p>
                        <button class="rt-button rt-button--ghost" type="submit" <?php disabled($subscriber['status'], 'unsubscribed'); ?>><?php echo esc_html($english ? 'Unsubscribe' : 'Abonelikten çık'); ?></button>
                    </form>
                </div>
                <a class="rt-newsletter-manage__account" href="<?php echo esc_url(home_url($english ? '/en/login/' : '/giris/')); ?>"><?php echo esc_html($english ? 'Continue to RadioTEDU ERP sign-in' : 'RadioTEDU ERP girişine devam et'); ?></a>
            <?php endif; ?>
        </section>
        <?php
        get_footer();
        exit;
    }

    public static function sync_erp(array $members): array
    {
        global $wpdb;
        $now = gmdate('Y-m-d H:i:s');
        $seen = 0;
        foreach (array_slice($members, 0, 10000) as $member) {
            if (!is_array($member)) {
                continue;
            }
            $email = strtolower(sanitize_email((string) ($member['email'] ?? '')));
            $externalId = sanitize_text_field((string) ($member['id'] ?? ''));
            if (!is_email($email) || $externalId === '') {
                continue;
            }
            $language = self::language((string) ($member['preferred_language'] ?? 'tr'));
            $existing = self::subscriber_by_email($email);
            if (is_array($existing)) {
                $data = [
                    'email_ciphertext' => self::encrypt_email($email),
                    'external_user_id' => substr($externalId, 0, 64),
                    'source_erp' => 1,
                    'last_erp_seen_at' => $now,
                    'updated_at' => $now,
                ];
                if ((int) $existing['language_locked'] !== 1) {
                    $data['language'] = $language;
                }
                if ($existing['status'] === 'inactive') {
                    $data['status'] = 'active';
                }
                $wpdb->update(self::subscribers_table(), $data, ['id' => (int) $existing['id']]);
            } else {
                self::insert_subscriber($email, $language, false, true, $externalId, $now);
            }
            $seen++;
        }

        $wpdb->query($wpdb->prepare(
            "UPDATE " . self::subscribers_table() . " SET source_erp = 0, status = CASE WHEN source_web = 1 OR status = 'unsubscribed' THEN status ELSE 'inactive' END, updated_at = %s WHERE source_erp = 1 AND (last_erp_seen_at IS NULL OR last_erp_seen_at < %s)",
            $now,
            $now
        ));
        return ['seen' => $seen];
    }

    public static function run_scheduled(?DateTimeImmutable $clock = null): array
    {
        $timezone = new DateTimeZone('Europe/Istanbul');
        $now = ($clock ?: new DateTimeImmutable('now', $timezone))->setTimezone($timezone);
        if (self::is_paused()) {
            return ['paused' => true, 'queued' => 0, 'sent' => 0];
        }

        $start = new DateTimeImmutable((string) self::$config['production_start'], $timezone);
        $firstThisMonth = $now->modify('first day of this month')->setTime((int) self::$config['send_hour'], 0);
        $nextIssue = $firstThisMonth > $now ? $firstThisMonth : $firstThisMonth->modify('first day of next month');
        if ($nextIssue < $start) {
            $nextIssue = $start;
        }

        $previewAt = $nextIssue->modify('-2 days');
        if ($now >= $previewAt && $now < $nextIssue && $now->format('Y-m-d') === $previewAt->format('Y-m-d')) {
            self::send_preview($nextIssue);
        }

        $queued = 0;
        $currentIssue = $firstThisMonth;
        if ($currentIssue >= $start && $now >= $currentIssue && $now < $currentIssue->modify('+36 hours')) {
            $queued = self::ensure_issue_queue($currentIssue);
        }

        $sent = self::process_queue($now);
        return ['paused' => false, 'queued' => $queued, 'sent' => $sent];
    }

    public static function send_test(string $recipient): bool
    {
        global $wpdb;
        $recipient = strtolower(sanitize_email($recipient));
        if (!hash_equals(strtolower((string) self::$config['test_recipient']), $recipient)) {
            throw new RuntimeException('Manual newsletter tests are restricted to the configured test recipient.');
        }
        $now = new DateTimeImmutable('now', new DateTimeZone('Europe/Istanbul'));
        $issueDate = $now->setTime((int) self::$config['send_hour'], 0);
        $issueKey = $issueDate->format('Y-m-d');
        $recipientHash = self::email_hash($recipient);
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM " . self::deliveries_table() . " WHERE issue_key = %s AND kind = 'test' AND recipient_hash = %s AND status = 'sent'",
            $issueKey,
            $recipientHash
        ));
        if ($existing) {
            return true;
        }
        $episodes = self::episode_snapshot($issueDate->modify('-30 days'), $issueDate);
        $ok = self::send_message($recipient, 'tr', $issueDate, $episodes, 'test', 'TEST / ');
        $wpdb->query($wpdb->prepare(
            "INSERT INTO " . self::deliveries_table() . " (issue_key,subscriber_id,recipient_hash,kind,language,status,attempt_count,scheduled_at,sent_at,last_error) VALUES (%s,0,%s,'test','tr',%s,1,%s,%s,%s) ON DUPLICATE KEY UPDATE status=VALUES(status),attempt_count=attempt_count+1,sent_at=VALUES(sent_at),last_error=VALUES(last_error)",
            $issueKey,
            $recipientHash,
            $ok ? 'sent' : 'failed',
            gmdate('Y-m-d H:i:s'),
            $ok ? gmdate('Y-m-d H:i:s') : null,
            $ok ? null : 'wp_mail returned false.'
        ));
        return $ok;
    }

    public static function render_preview_html(string $language): string
    {
        $language = self::language($language);
        $now = new DateTimeImmutable('now', new DateTimeZone('Europe/Istanbul'));
        $episodes = self::episode_snapshot($now->modify('-30 days'), $now);
        $manageUrl = self::manage_url(str_repeat('0', 64), $language);
        return self::email_html($language, $now, $episodes, $manageUrl, 'preview');
    }

    public static function status(): array
    {
        global $wpdb;
        return [
            'paused' => self::is_paused(),
            'production_start' => (string) self::$config['production_start'],
            'active_subscribers' => (int) $wpdb->get_var("SELECT COUNT(*) FROM " . self::subscribers_table() . " WHERE status = 'active' AND (source_web = 1 OR source_erp = 1)"),
            'queued_deliveries' => (int) $wpdb->get_var("SELECT COUNT(*) FROM " . self::deliveries_table() . " WHERE status = 'queued'"),
        ];
    }

    private static function ensure_issue_queue(DateTimeImmutable $issueDate): int
    {
        global $wpdb;
        $issueKey = $issueDate->format('Y-m-d');
        $issue = $wpdb->get_row($wpdb->prepare("SELECT * FROM " . self::issues_table() . " WHERE issue_key = %s", $issueKey), ARRAY_A);
        if (!is_array($issue)) {
            $windowStart = $issueDate->modify('-30 days');
            $episodes = self::episode_snapshot($windowStart, $issueDate);
            $status = $episodes === [] ? 'no_content' : 'queued';
            $wpdb->insert(self::issues_table(), [
                'issue_key' => $issueKey,
                'window_start' => $windowStart->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
                'window_end' => $issueDate->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
                'episode_ids' => wp_json_encode(array_column($episodes, 'id')),
                'status' => $status,
                'created_at' => gmdate('Y-m-d H:i:s'),
                'queued_at' => $status === 'queued' ? gmdate('Y-m-d H:i:s') : null,
            ]);
            $issue = $wpdb->get_row($wpdb->prepare("SELECT * FROM " . self::issues_table() . " WHERE issue_key = %s", $issueKey), ARRAY_A);
        }
        if (!is_array($issue) || $issue['status'] === 'no_content') {
            return 0;
        }

        $eligible = $wpdb->get_results("SELECT id, email_hash, language FROM " . self::subscribers_table() . " WHERE status = 'active' AND (source_web = 1 OR source_erp = 1)", ARRAY_A);
        $queued = 0;
        foreach ($eligible as $subscriber) {
            $inserted = $wpdb->query($wpdb->prepare(
                "INSERT IGNORE INTO " . self::deliveries_table() . " (issue_key,subscriber_id,recipient_hash,kind,language,status,scheduled_at) VALUES (%s,%d,%s,'issue',%s,'queued',%s)",
                $issueKey,
                (int) $subscriber['id'],
                (string) $subscriber['email_hash'],
                self::language((string) $subscriber['language']),
                gmdate('Y-m-d H:i:s')
            ));
            if ($inserted === 1) {
                $queued++;
            }
        }
        return $queued;
    }

    private static function process_queue(DateTimeImmutable $now): int
    {
        global $wpdb;
        $limit = min(self::MAX_BATCH, max(1, (int) self::$config['batch_size']));
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT d.*, s.email_ciphertext, s.management_token_hash, s.status AS subscriber_status, s.source_web, s.source_erp, i.episode_ids FROM " . self::deliveries_table() . " d JOIN " . self::subscribers_table() . " s ON s.id = d.subscriber_id JOIN " . self::issues_table() . " i ON i.issue_key = d.issue_key WHERE d.status = 'queued' AND d.kind = 'issue' AND d.scheduled_at <= %s ORDER BY d.id ASC LIMIT %d",
            gmdate('Y-m-d H:i:s'),
            $limit
        ), ARRAY_A);
        $sent = 0;
        foreach ($rows as $row) {
            if (self::is_paused()) {
                break;
            }
            if ($row['subscriber_status'] !== 'active' || ((int) $row['source_web'] !== 1 && (int) $row['source_erp'] !== 1)) {
                $wpdb->update(self::deliveries_table(), ['status' => 'skipped', 'last_error' => 'Subscriber is not eligible.'], ['id' => (int) $row['id']]);
                continue;
            }
            $email = self::decrypt_email((string) $row['email_ciphertext']);
            $issueDate = new DateTimeImmutable((string) $row['issue_key'] . ' ' . (int) self::$config['send_hour'] . ':00:00', new DateTimeZone('Europe/Istanbul'));
            $ids = json_decode((string) $row['episode_ids'], true);
            $episodes = self::episodes_by_ids(is_array($ids) ? array_map('absint', $ids) : []);
            $ok = self::send_message($email, self::language((string) $row['language']), $issueDate, $episodes, 'issue');
            $wpdb->update(self::deliveries_table(), [
                'status' => $ok ? 'sent' : 'failed',
                'attempt_count' => (int) $row['attempt_count'] + 1,
                'sent_at' => $ok ? gmdate('Y-m-d H:i:s') : null,
                'last_error' => $ok ? null : 'wp_mail returned false.',
            ], ['id' => (int) $row['id']]);
            if ($ok) {
                $sent++;
            }
            if ((int) self::$config['delay_seconds'] > 0) {
                sleep(min(15, (int) self::$config['delay_seconds']));
            }
        }
        return $sent;
    }

    private static function send_preview(DateTimeImmutable $issueDate): bool
    {
        global $wpdb;
        $recipient = strtolower(sanitize_email((string) self::$config['preview_recipient']));
        $issueKey = $issueDate->format('Y-m-d');
        $recipientHash = self::email_hash($recipient);
        $existing = $wpdb->get_var($wpdb->prepare("SELECT id FROM " . self::deliveries_table() . " WHERE issue_key = %s AND kind = 'preview' AND recipient_hash = %s AND status = 'sent'", $issueKey, $recipientHash));
        if ($existing) {
            return true;
        }
        $previewEnd = new DateTimeImmutable('now', new DateTimeZone('Europe/Istanbul'));
        $episodes = self::episode_snapshot($previewEnd->modify('-30 days'), $previewEnd);
        $ok = self::send_message($recipient, 'tr', $issueDate, $episodes, 'preview', 'ÖNİZLEME / ');
        $wpdb->query($wpdb->prepare(
            "INSERT INTO " . self::deliveries_table() . " (issue_key,subscriber_id,recipient_hash,kind,language,status,attempt_count,scheduled_at,sent_at,last_error) VALUES (%s,0,%s,'preview','tr',%s,1,%s,%s,%s) ON DUPLICATE KEY UPDATE status=VALUES(status),attempt_count=attempt_count+1,sent_at=VALUES(sent_at),last_error=VALUES(last_error)",
            $issueKey,
            $recipientHash,
            $ok ? 'sent' : 'failed',
            gmdate('Y-m-d H:i:s'),
            $ok ? gmdate('Y-m-d H:i:s') : null,
            $ok ? null : 'wp_mail returned false.'
        ));
        return $ok;
    }

    private static function send_message(string $recipient, string $language, DateTimeImmutable $issueDate, array $episodes, string $kind, string $subjectPrefix = ''): bool
    {
        $recipient = strtolower(sanitize_email($recipient));
        if (!is_email($recipient)) {
            return false;
        }
        $now = new DateTimeImmutable('now', new DateTimeZone('Europe/Istanbul'));
        $start = new DateTimeImmutable((string) self::$config['production_start'], new DateTimeZone('Europe/Istanbul'));
        if ($kind === 'test' && !hash_equals(strtolower((string) self::$config['test_recipient']), $recipient)) {
            return false;
        }
        if ($kind === 'preview' && (!hash_equals(strtolower((string) self::$config['preview_recipient']), $recipient) || $now < $start->modify('-2 days'))) {
            return false;
        }
        if ($kind === 'issue' && $now < $start) {
            return false;
        }

        $subscriber = self::subscriber_by_email($recipient);
        $token = is_array($subscriber) ? self::ensure_management_token((int) $subscriber['id']) : self::temporary_token($recipient);
        $manageUrl = self::manage_url($token, $language);
        $unsubscribeApi = add_query_arg('token', rawurlencode($token), rest_url('radiotedu/v1/newsletter/unsubscribe'));
        $subject = $subjectPrefix . ($language === 'en'
            ? 'RadioTEDU Monthly Podcasts · ' . $issueDate->format('F Y')
            : 'RadioTEDU Aylık Podcastler · ' . wp_date('F Y', $issueDate->getTimestamp(), new DateTimeZone('Europe/Istanbul')));
        $html = self::email_html($language, $issueDate, $episodes, $manageUrl, $kind);
        $headers = [
            'Content-Type: text/html; charset=UTF-8',
            'List-Unsubscribe: <' . esc_url_raw($unsubscribeApi) . '>',
            'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
        ];
        return wp_mail($recipient, $subject, $html, $headers);
    }

    private static function email_html(string $language, DateTimeImmutable $issueDate, array $episodes, string $manageUrl, string $kind): string
    {
        $english = $language === 'en';
        $technologyUrl = home_url($english ? '/technology/' : '/teknoloji/');
        $logo = get_theme_file_uri('/assets/images/radiotedu-logo.png');
        $windowEnd = $kind === 'preview' ? new DateTimeImmutable('now', new DateTimeZone('Europe/Istanbul')) : $issueDate;
        $windowStart = $windowEnd->modify('-30 days');
        $title = $english ? 'The latest 30 days in podcasts.' : 'Podcastlerle son 30 gün.';
        $period = $windowStart->format('d.m.Y') . ' · ' . $windowEnd->format('d.m.Y');

        ob_start();
        ?>
        <!doctype html><html lang="<?php echo esc_attr($language); ?>"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title><?php echo esc_html($title); ?></title></head>
        <body style="margin:0;background:#f2efe8;color:#11100f;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f2efe8;"><tr><td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#fffdf8;">
                <tr><td style="background:#ed1c24;padding:12px 20px;color:#ffffff;font-size:14px;font-weight:700;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
                        <td><?php echo esc_html($english ? 'Discover RadioTEDU technology!' : 'RadioTEDU’nün teknolojisini keşfet!'); ?></td>
                        <td align="right"><a href="<?php echo esc_url($technologyUrl); ?>" style="display:inline-block;border:1px solid #ffffff;padding:8px 12px;color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;"><?php echo esc_html($english ? 'TECHNOLOGY' : 'TEKNOLOJİ'); ?></a></td>
                    </tr></table>
                </td></tr>
                <tr><td style="padding:36px 36px 18px;border-bottom:1px solid #11100f;"><img src="<?php echo esc_url($logo); ?>" width="220" alt="RadioTEDU" style="display:block;max-width:220px;width:100%;height:auto;"></td></tr>
                <tr><td style="padding:38px 36px 32px;">
                    <p style="margin:0 0 10px;color:#ed1c24;font-size:12px;font-weight:700;letter-spacing:1.5px;"><?php echo esc_html($kind === 'preview' ? ($english ? 'EDITORIAL PREVIEW' : 'EDİTORYAL ÖNİZLEME') : ($english ? 'MONTHLY PODCAST LETTER' : 'AYLIK PODCAST MEKTUBU')); ?></p>
                    <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:42px;line-height:1.02;font-weight:400;letter-spacing:-1.5px;"><?php echo esc_html($title); ?></h1>
                    <p style="margin:0;color:#66615a;font-size:15px;"><?php echo esc_html($period); ?> · <?php echo esc_html($english ? count($episodes) . ' episodes' : count($episodes) . ' bölüm'); ?></p>
                </td></tr>
                <?php if ($episodes === []): ?>
                    <tr><td style="padding:22px 36px 44px;border-top:1px solid #d4cec4;"><h2 style="font-family:Georgia,'Times New Roman',serif;font-size:27px;font-weight:400;margin:0 0 10px;"><?php echo esc_html($english ? 'No new episode in this period.' : 'Bu dönemde yeni bölüm yok.'); ?></h2><p style="margin:0;color:#66615a;"><?php echo esc_html($english ? 'The final issue is refreshed at its publication cutoff.' : 'Nihai bülten, yayın kesim tarihinde yeniden güncellenir.'); ?></p></td></tr>
                <?php else: ?>
                    <?php foreach ($episodes as $index => $episode): ?>
                        <tr><td style="padding:26px 36px;border-top:1px solid #d4cec4;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
                                <td width="150" valign="top" style="padding-right:24px;"><a href="<?php echo esc_url($episode['url']); ?>"><img src="<?php echo esc_url($episode['image']); ?>" width="150" height="150" alt="" style="display:block;width:150px;height:150px;object-fit:cover;background:#11100f;"></a></td>
                                <td valign="top">
                                    <p style="margin:0 0 7px;color:#ed1c24;font-size:11px;font-weight:700;letter-spacing:1px;"><?php echo esc_html(str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT) . ' / ' . $episode['show']); ?></p>
                                    <h2 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1.08;font-weight:400;"><a href="<?php echo esc_url($episode['url']); ?>" style="color:#11100f;text-decoration:none;"><?php echo esc_html($episode['title']); ?></a></h2>
                                    <p style="margin:0 0 12px;color:#66615a;font-size:13px;line-height:1.45;"><?php echo esc_html($episode['date']); ?><?php if ($episode['excerpt'] !== ''): ?> · <?php echo esc_html($episode['excerpt']); ?><?php endif; ?></p>
                                    <a href="<?php echo esc_url($episode['url']); ?>" style="display:inline-block;background:#11100f;color:#ffffff;text-decoration:none;padding:10px 14px;font-size:12px;font-weight:700;"><?php echo esc_html($english ? 'OPEN EPISODE' : 'BÖLÜME GİT'); ?></a>
                                </td>
                            </tr></table>
                        </td></tr>
                    <?php endforeach; ?>
                <?php endif; ?>
                <tr><td style="padding:30px 36px;background:#11100f;color:#ffffff;font-size:12px;line-height:1.6;">
                    <p style="margin:0 0 14px;"><strong>RadioTEDU Ankara <?php echo esc_html($english ? 'Studios' : 'Stüdyoları'); ?></strong><br>TED Üniversitesi, Ziya Gökalp Cad. No:48, Kolej, Çankaya, Ankara</p>
                    <p style="margin:0 0 8px;"><a href="<?php echo esc_url(add_query_arg('mode', 'unsubscribe', $manageUrl)); ?>" style="color:#ffffff;"><?php echo esc_html($english ? 'Unsubscribe' : 'Abonelikten çık'); ?></a> · <a href="<?php echo esc_url(add_query_arg('mode', 'language', $manageUrl)); ?>" style="color:#ffffff;"><?php echo esc_html($english ? 'Change language' : 'Dili değiştir'); ?></a></p>
                    <p style="margin:0;color:#bdb7ae;"><a href="<?php echo esc_url(add_query_arg(['mode' => 'language', 'lang' => 'tr'], $manageUrl)); ?>" style="color:#bdb7ae;">Türkçe</a> · <a href="<?php echo esc_url(add_query_arg(['mode' => 'language', 'lang' => 'en'], $manageUrl)); ?>" style="color:#bdb7ae;">English</a></p>
                </td></tr>
            </table>
        </td></tr></table></body></html>
        <?php
        return (string) ob_get_clean();
    }

    private static function episode_snapshot(DateTimeImmutable $start, DateTimeImmutable $end): array
    {
        $posts = get_posts([
            'post_type' => 'rt_podcast_episode',
            'post_status' => 'publish',
            'numberposts' => 100,
            'orderby' => 'date',
            'order' => 'DESC',
            'date_query' => [[
                'column' => 'post_date_gmt',
                'after' => $start->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
                'before' => $end->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
                'inclusive' => false,
            ]],
        ]);
        return array_map([self::class, 'episode_payload'], $posts);
    }

    private static function episodes_by_ids(array $ids): array
    {
        if ($ids === []) {
            return [];
        }
        $posts = get_posts(['post_type' => 'rt_podcast_episode', 'post_status' => 'publish', 'post__in' => $ids, 'orderby' => 'post__in', 'numberposts' => count($ids)]);
        return array_map([self::class, 'episode_payload'], $posts);
    }

    private static function episode_payload(WP_Post $episode): array
    {
        $showId = absint(get_post_meta($episode->ID, '_rt_show_id', true));
        $image = get_the_post_thumbnail_url($episode, 'medium');
        if (!$image && $showId > 0) {
            $image = get_the_post_thumbnail_url($showId, 'medium');
        }
        return [
            'id' => $episode->ID,
            'title' => get_the_title($episode),
            'show' => $showId > 0 ? get_the_title($showId) : 'RadioTEDU Podcast',
            'excerpt' => wp_trim_words(wp_strip_all_tags(get_the_excerpt($episode)), 24),
            'url' => (string) get_permalink($episode),
            'image' => $image ?: get_theme_file_uri('/assets/images/radiotedu-program-cover.png'),
            'date' => wp_date('d.m.Y', get_post_timestamp($episode), new DateTimeZone('Europe/Istanbul')),
        ];
    }

    private static function upsert_web_subscriber(string $email, string $language): void
    {
        global $wpdb;
        $existing = self::subscriber_by_email($email);
        $now = gmdate('Y-m-d H:i:s');
        if (is_array($existing)) {
            $wpdb->update(self::subscribers_table(), [
                'email_ciphertext' => self::encrypt_email($email),
                'language' => $language,
                'language_locked' => 1,
                'status' => 'active',
                'source_web' => 1,
                'consent_version' => self::CONSENT_VERSION,
                'consent_at' => $now,
                'unsubscribed_at' => null,
                'updated_at' => $now,
            ], ['id' => (int) $existing['id']]);
            return;
        }
        self::insert_subscriber($email, $language, true, false, null, $now);
    }

    private static function insert_subscriber(string $email, string $language, bool $web, bool $erp, ?string $externalId, string $now): void
    {
        global $wpdb;
        $wpdb->insert(self::subscribers_table(), [
            'email_hash' => self::email_hash($email),
            'email_ciphertext' => self::encrypt_email($email),
            'management_token_hash' => hash('sha256', bin2hex(random_bytes(32))),
            'external_user_id' => $externalId ? substr($externalId, 0, 64) : null,
            'language' => $language,
            'language_locked' => $web ? 1 : 0,
            'status' => 'active',
            'source_web' => $web ? 1 : 0,
            'source_erp' => $erp ? 1 : 0,
            'consent_version' => $web ? self::CONSENT_VERSION : null,
            'consent_at' => $web ? $now : null,
            'subscribed_at' => $now,
            'last_erp_seen_at' => $erp ? $now : null,
            'updated_at' => $now,
        ]);
        self::ensure_management_token((int) $wpdb->insert_id);
    }

    private static function ensure_management_token(int $subscriberId): string
    {
        global $wpdb;
        $emailHash = (string) $wpdb->get_var($wpdb->prepare("SELECT email_hash FROM " . self::subscribers_table() . " WHERE id = %d", $subscriberId));
        if ($emailHash === '') {
            throw new RuntimeException('Newsletter subscriber does not exist.');
        }
        $token = hash_hmac('sha256', $subscriberId . '|' . $emailHash, wp_salt('secure_auth'));
        $wpdb->update(self::subscribers_table(), ['management_token_hash' => hash('sha256', $token), 'updated_at' => gmdate('Y-m-d H:i:s')], ['id' => $subscriberId]);
        return $token;
    }

    private static function temporary_token(string $recipient): string
    {
        $existing = self::subscriber_by_email($recipient);
        if (is_array($existing)) {
            return self::ensure_management_token((int) $existing['id']);
        }
        self::insert_subscriber($recipient, 'tr', false, false, null, gmdate('Y-m-d H:i:s'));
        $created = self::subscriber_by_email($recipient);
        return is_array($created) ? self::ensure_management_token((int) $created['id']) : '';
    }

    private static function unsubscribe(string $token): bool
    {
        global $wpdb;
        $subscriber = self::subscriber_by_token($token);
        if (!is_array($subscriber)) {
            return false;
        }
        $wpdb->update(self::subscribers_table(), ['status' => 'unsubscribed', 'unsubscribed_at' => gmdate('Y-m-d H:i:s'), 'updated_at' => gmdate('Y-m-d H:i:s')], ['id' => (int) $subscriber['id']]);
        return true;
    }

    private static function update_language(string $token, string $language): bool
    {
        global $wpdb;
        $subscriber = self::subscriber_by_token($token);
        if (!is_array($subscriber)) {
            return false;
        }
        return $wpdb->update(self::subscribers_table(), ['language' => $language, 'language_locked' => 1, 'updated_at' => gmdate('Y-m-d H:i:s')], ['id' => (int) $subscriber['id']]) !== false;
    }

    private static function subscriber_by_email(string $email): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM " . self::subscribers_table() . " WHERE email_hash = %s", self::email_hash($email)), ARRAY_A);
        return is_array($row) ? $row : null;
    }

    private static function subscriber_by_token(string $token): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM " . self::subscribers_table() . " WHERE management_token_hash = %s", hash('sha256', $token)), ARRAY_A);
        return is_array($row) ? $row : null;
    }

    private static function manage_url(string $token, string $language): string
    {
        $path = $language === 'en' ? '/en/erp/newsletter/' : '/erp/newsletter/';
        return add_query_arg(['token' => $token, 'lang' => $language], home_url($path));
    }

    private static function encrypt_email(string $email): string
    {
        if (!function_exists('sodium_crypto_secretbox')) {
            throw new RuntimeException('Sodium is required for newsletter email encryption.');
        }
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $cipher = sodium_crypto_secretbox($email, $nonce, self::encryption_key());
        return base64_encode($nonce . $cipher);
    }

    private static function decrypt_email(string $ciphertext): string
    {
        $decoded = base64_decode($ciphertext, true);
        if (!is_string($decoded) || strlen($decoded) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
            throw new RuntimeException('Stored newsletter address cannot be decrypted.');
        }
        $nonce = substr($decoded, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $plain = sodium_crypto_secretbox_open(substr($decoded, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), $nonce, self::encryption_key());
        if (!is_string($plain) || !is_email($plain)) {
            throw new RuntimeException('Stored newsletter address is invalid.');
        }
        return $plain;
    }

    private static function encryption_key(): string
    {
        return hash('sha256', wp_salt('auth') . '|radiotedu-newsletter-email', true);
    }

    private static function email_hash(string $email): string
    {
        return hash_hmac('sha256', strtolower(trim($email)), wp_salt('nonce'));
    }

    private static function token(string $value): string
    {
        $value = strtolower(trim($value));
        return preg_match('/^[a-f0-9]{64}$/', $value) ? $value : '';
    }

    private static function language(string $value): string
    {
        return strtolower(trim($value)) === 'en' ? 'en' : 'tr';
    }

    private static function rate_limit(string $operation, int $limit, int $ttl): bool
    {
        $ip = sanitize_text_field((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
        $key = 'rt_nl_rate_' . hash_hmac('sha256', $operation . '|' . $ip, wp_salt('nonce'));
        $count = (int) get_transient($key);
        if ($count >= $limit) {
            return false;
        }
        set_transient($key, $count + 1, $ttl);
        return true;
    }

    private static function origin_allowed(WP_REST_Request $request): bool
    {
        $origin = (string) $request->get_header('origin');
        if ($origin === '') {
            return true;
        }
        $host = wp_parse_url($origin, PHP_URL_HOST);
        $siteHost = wp_parse_url(home_url('/'), PHP_URL_HOST);
        return is_string($host) && is_string($siteHost) && hash_equals(strtolower($siteHost), strtolower($host));
    }

    private static function is_paused(): bool
    {
        return is_file((string) self::$config['pause_file']);
    }

    private static function load_config(): array
    {
        $defaults = [
            'production_start' => '2026-10-01 10:00:00',
            'send_hour' => 10,
            'preview_recipient' => 'tuna.ozsari@tedu.edu.tr',
            'test_recipient' => 'arda.akgul@tedu.edu.tr',
            'batch_size' => 5,
            'delay_seconds' => 8,
            'pause_file' => 'C:/RadioTEDU/state/newsletter-paused.flag',
        ];
        $path = 'C:/RadioTEDU/config/newsletter.php';
        $custom = is_file($path) ? require $path : [];
        return array_merge($defaults, is_array($custom) ? $custom : []);
    }

    private static function subscribers_table(): string
    {
        global $wpdb;
        return $wpdb->prefix . 'rt_newsletter_subscribers';
    }

    private static function issues_table(): string
    {
        global $wpdb;
        return $wpdb->prefix . 'rt_newsletter_issues';
    }

    private static function deliveries_table(): string
    {
        global $wpdb;
        return $wpdb->prefix . 'rt_newsletter_deliveries';
    }
}
