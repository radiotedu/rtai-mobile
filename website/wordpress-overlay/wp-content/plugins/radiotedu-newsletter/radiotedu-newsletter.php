<?php
/**
 * Plugin Name: RadioTEDU Monthly Podcast Newsletter
 * Description: Consent-aware monthly podcast digest with ERP membership sync, language preferences and one-click unsubscribe.
 * Version: 1.0.0
 * Author: RadioTEDU
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

define('RADIOTEDU_NEWSLETTER_VERSION', '1.0.0');
define('RADIOTEDU_NEWSLETTER_FILE', __FILE__);

require_once __DIR__ . '/includes/class-radiotedu-newsletter.php';

register_activation_hook(__FILE__, ['RadioTEDU_Newsletter', 'activate']);
add_action('plugins_loaded', ['RadioTEDU_Newsletter', 'boot']);
