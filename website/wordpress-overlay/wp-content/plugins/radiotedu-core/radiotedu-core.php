<?php
/**
 * Plugin Name: RadioTEDU Core
 * Description: RadioTEDU stations, podcasts, schedules, migrations and public REST APIs.
 * Version: 1.1.0
 * Author: RadioTEDU
 * Text Domain: radiotedu
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

define('RADIOTEDU_CORE_VERSION', '1.1.0');
define('RADIOTEDU_CORE_FILE', __FILE__);
define('RADIOTEDU_CORE_DIR', plugin_dir_path(__FILE__));

require_once RADIOTEDU_CORE_DIR . 'includes/class-radiotedu-content.php';
require_once RADIOTEDU_CORE_DIR . 'includes/class-radiotedu-schedule.php';
require_once RADIOTEDU_CORE_DIR . 'includes/class-radiotedu-podcast-sync.php';
require_once RADIOTEDU_CORE_DIR . 'includes/class-radiotedu-events.php';
require_once RADIOTEDU_CORE_DIR . 'includes/class-radiotedu-rest.php';
require_once RADIOTEDU_CORE_DIR . 'includes/class-radiotedu-jam.php';
require_once RADIOTEDU_CORE_DIR . 'includes/class-radiotedu-migrator.php';

final class RadioTEDU_Core
{
    private static ?self $instance = null;

    public static function instance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    private function __construct()
    {
        add_action('plugins_loaded', [$this, 'load_textdomain']);

        RadioTEDU_Content::instance();
        RadioTEDU_Schedule::instance();
        RadioTEDU_Podcast_Sync::instance();
        RadioTEDU_Events::instance();
        RadioTEDU_REST::instance();
        RadioTEDU_Jam::instance();
        RadioTEDU_Migrator::instance();
    }

    public function load_textdomain(): void
    {
        load_plugin_textdomain('radiotedu', false, dirname(plugin_basename(__FILE__)) . '/languages');
    }

    public static function activate(): void
    {
        RadioTEDU_Content::register_content_types();
        RadioTEDU_Schedule::install();
        RadioTEDU_Content::seed_stations();
        RadioTEDU_Content::ensure_core_pages();
        RadioTEDU_Podcast_Sync::schedule();
        RadioTEDU_Events::schedule();
        flush_rewrite_rules();
    }

    public static function deactivate(): void
    {
        RadioTEDU_Podcast_Sync::unschedule();
        RadioTEDU_Events::unschedule();
        flush_rewrite_rules();
    }
}

register_activation_hook(__FILE__, ['RadioTEDU_Core', 'activate']);
register_deactivation_hook(__FILE__, ['RadioTEDU_Core', 'deactivate']);

RadioTEDU_Core::instance();

/**
 * Configure PHPMailer for TEDU on-premise Exchange (edge.tedu.edu.tr)
 * Bypasses internal self-signed SSL certificate check and sets human Reply-To.
 */
function radiotedu_configure_smtp_mailer($phpmailer): void
{
    if (isset($phpmailer->Host) && str_contains((string) $phpmailer->Host, 'edge.tedu.edu.tr')) {
        $phpmailer->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true,
            ],
        ];
    }
    if (method_exists($phpmailer, 'getReplyToAddresses') && empty($phpmailer->getReplyToAddresses())) {
        $phpmailer->addReplyTo('radio@tedu.edu.tr', 'RadioTEDU');
    }
}
add_action('phpmailer_init', 'radiotedu_configure_smtp_mailer', 999);
add_filter('wp_mail_smtp_custom_options', function ($phpmailer) {
    radiotedu_configure_smtp_mailer($phpmailer);
    return $phpmailer;
}, 999);

