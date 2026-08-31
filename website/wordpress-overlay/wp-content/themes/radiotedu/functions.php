<?php
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

function radiotedu_setup(): void
{
    load_theme_textdomain('radiotedu', get_template_directory() . '/languages');
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('custom-logo', ['height' => 120, 'width' => 720, 'flex-height' => true, 'flex-width' => true]);
    add_theme_support('html5', ['search-form', 'gallery', 'caption', 'style', 'script']);
    add_theme_support('responsive-embeds');
    add_theme_support('align-wide');
    add_image_size('radiotedu-square', 720, 720, true);
    add_image_size('radiotedu-wide', 1440, 810, true);
    register_nav_menus([
        'primary' => __('Ana menü', 'radiotedu'),
        'footer' => __('Alt menü', 'radiotedu'),
    ]);
}
add_action('after_setup_theme', 'radiotedu_setup');

function radiotedu_assets(): void
{
    $version = wp_get_theme()->get('Version');
    $fontsCss = get_template_directory() . '/assets/css/fonts.css';
    $css = get_template_directory() . '/assets/css/app.css';
    $js = get_template_directory() . '/assets/js/app.js';
    $siteKitAnalytics = get_option('googlesitekit_analytics-4_settings', []);
    $measurementId = is_array($siteKitAnalytics) ? (string) ($siteKitAnalytics['measurementID'] ?? '') : '';
    if (!preg_match('/^G-[A-Z0-9]+$/', $measurementId)) {
        $measurementId = '';
    }
    wp_enqueue_style('radiotedu-fonts', get_template_directory_uri() . '/assets/css/fonts.css', [], is_file($fontsCss) ? (string) filemtime($fontsCss) : $version);
    wp_enqueue_style('radiotedu-app', get_template_directory_uri() . '/assets/css/app.css', ['radiotedu-fonts'], is_file($css) ? (string) filemtime($css) : $version);
    wp_enqueue_script('radiotedu-app', get_template_directory_uri() . '/assets/js/app.js', ['jquery'], is_file($js) ? (string) filemtime($js) : $version, true);
    wp_localize_script('radiotedu-app', 'RadioTEDUConfig', [
        'restBase' => esc_url_raw(rest_url('radiotedu/v1/')),
        'accountBase' => esc_url_raw(home_url('/jukebox/api/v1/')),
        'homeUrl' => radiotedu_localized_url(home_url('/')),
        'language' => radiotedu_current_language(),
        'consentCookieName' => 'rt_cookie_consent_v1',
        'analyticsMeasurementId' => $measurementId,
        'labels' => [
            'play' => __('Oynat', 'radiotedu'),
            'pause' => __('Duraklat', 'radiotedu'),
            'offline' => __('Yayın geçici olarak çevrimdışı', 'radiotedu'),
            'error' => __('Ses başlatılamadı. Lütfen tekrar deneyin.', 'radiotedu'),
            'loading' => __('Yükleniyor', 'radiotedu'),
            'favorite' => __('Favoriye ekle', 'radiotedu'),
        ],
    ]);
}
add_action('wp_enqueue_scripts', 'radiotedu_assets');

function radiotedu_menu_fallback(): void
{
    $items = [
        [__('Dinle', 'radiotedu'), get_post_type_archive_link('rt_station') ?: home_url('/radyolar/'), false],
        [__('Listeler', 'radiotedu'), radiotedu_localized_url(home_url('/listeler/')), false],
        [__('Podcastler', 'radiotedu'), get_post_type_archive_link('rt_podcast_show') ?: home_url('/podcastler/'), false],
        [__('Yayın Akışı', 'radiotedu'), radiotedu_localized_url(home_url('/yayin-akisi/')), false],
        [__('Duyurular', 'radiotedu'), radiotedu_localized_url(home_url('/duyurular/')), false],
        [__('AI', 'radiotedu'), home_url('/ai/'), true],
        [__('Social', 'radiotedu'), home_url('/social/'), true],
            [__('RadioTEDU Situation Room', 'radiotedu'), home_url('/situation/'), true],
        [__('Teknoloji', 'radiotedu'), home_url('/teknoloji/'), true],
        [__('Etkinlikler', 'radiotedu'), home_url('/bilet/'), true],
        [__('Hakkımızda', 'radiotedu'), radiotedu_localized_url(home_url('/hakkimizda/')), false],
        [__('İletişim', 'radiotedu'), radiotedu_localized_url(home_url('/iletisim/')), false],
    ];
    echo '<ul class="rt-nav__list">';
    foreach ($items as [$label, $url, $native]) {
        echo '<li><a href="' . esc_url($url) . '"' . ($native ? ' data-no-pjax' : '') . '>' . esc_html($label) . '</a></li>';
    }
    echo '</ul>';
}

function radiotedu_network_menu_items(string $items, stdClass $args): string
{
    if (!in_array($args->theme_location ?? '', ['primary', 'footer'], true)) {
        return $items;
    }
    $playlistsUrl = radiotedu_localized_url(home_url('/listeler/'));
    if (!str_contains($items, 'href="' . esc_url($playlistsUrl) . '"')) {
        $items .= '<li class="menu-item"><a href="' . esc_url($playlistsUrl) . '">' . esc_html__('Listeler', 'radiotedu') . '</a></li>';
    }
    $aiUrl = home_url('/rtai/');
    $situationUrl = home_url('/situation/');
    $links = [
        __('AI', 'radiotedu') => $aiUrl,
        __('Social', 'radiotedu') => home_url('/social/'),
        __('Teknoloji', 'radiotedu') => home_url('/teknoloji/'),
        __('Etkinlikler', 'radiotedu') => home_url('/bilet/'),
    ];
    foreach ($links as $label => $url) {
        if (!str_contains($items, 'href="' . esc_url($url) . '"')) {
            $items .= '<li class="menu-item rt-network-link"><a href="' . esc_url($url) . '" data-no-pjax>' . esc_html($label) . '</a></li>';
        }
    }
    if (!str_contains($items, 'href="' . esc_url($situationUrl) . '"')) {
    $situationItem = '<li class="menu-item rt-network-link"><a href="' . esc_url($situationUrl) . '" data-no-pjax>' . esc_html__('RadioTEDU Situation Room', 'radiotedu') . '</a></li>';
        $aiHref = preg_quote('href="' . esc_url($aiUrl) . '"', '#');
        $placed = preg_replace('#(<li[^>]*>\s*<a[^>]*' . $aiHref . '[^>]*>.*?</a>\s*</li>)#is', '$1' . $situationItem, $items, 1, $count);
        $items = is_string($placed) && $count > 0 ? $placed : $items . $situationItem;
    }

    return $items;
}
add_filter('wp_nav_menu_items', 'radiotedu_network_menu_items', 10, 2);

function radiotedu_logo(bool $white = false): string
{
    $customLogo = get_theme_mod('custom_logo');
    if ($customLogo) {
        return (string) wp_get_attachment_image($customLogo, 'full', false, ['class' => 'rt-logo__image', 'alt' => get_bloginfo('name')]);
    }
    $filename = $white ? 'radiotedu-logo-white.png' : 'radiotedu-logo.png';
    return '<img class="rt-logo__image" src="' . esc_url(get_template_directory_uri() . '/assets/images/' . $filename) . '" alt="RadioTEDU" width="2013" height="358">';
}

function radiotedu_brand_markup(string $text): string
{
    $escaped = esc_html($text);
    $markup = preg_replace('/radiotedu/iu', '<span class="rt-brand">RadioTEDU</span>', $escaped);

    return is_string($markup) ? $markup : $escaped;
}

function radiotedu_language_switcher(): void
{
    echo '<div class="rt-language" aria-label="' . esc_attr__('Dil seçimi', 'radiotedu') . '">';
    if (function_exists('pll_the_languages')) {
        $languages = pll_the_languages(['raw' => 1, 'hide_if_empty' => 0]);
        foreach (is_array($languages) ? $languages : [] as $language) {
            $class = !empty($language['current_lang']) ? ' is-current' : '';
            echo '<a class="rt-language__link' . esc_attr($class) . '" href="' . esc_url($language['url']) . '" hreflang="' . esc_attr($language['slug']) . '">' . esc_html(strtoupper($language['slug'])) . '</a>';
        }
    } else {
        foreach (['tr' => 'TR', 'en' => 'EN'] as $slug => $label) {
            $class = radiotedu_current_language() === $slug ? ' is-current' : '';
            echo '<a class="rt-language__link' . esc_attr($class) . '" href="' . esc_url(radiotedu_language_url($slug)) . '" hreflang="' . esc_attr($slug) . '">' . esc_html($label) . '</a>';
        }
    }
    echo '</div>';
}

function radiotedu_card_image(int $postId, string $size = 'radiotedu-square'): string
{
    $image = get_the_post_thumbnail_url($postId, $size);
    if ($image) {
        return $image;
    }
    $remote = esc_url_raw((string) get_post_meta($postId, '_rt_remote_image_url', true));
    if ($remote !== '') {
        return $remote;
    }
    if (get_post_type($postId) === 'rt_podcast_episode') {
        $showId = absint(get_post_meta($postId, '_rt_show_id', true));
        if ($showId > 0) {
            $showImage = get_the_post_thumbnail_url($showId, $size);
            $showRemote = esc_url_raw((string) get_post_meta($showId, '_rt_remote_image_url', true));
            if ($showImage || $showRemote !== '') {
                return $showImage ?: $showRemote;
            }
        }
    }
    return get_template_directory_uri() . '/assets/images/radiotedu-logo.png';
}

function radiotedu_episode_play_button(int $postId): void
{
    $audio = (string) get_post_meta($postId, '_rt_audio_url', true);
    $external = (string) get_post_meta($postId, '_rt_external_url', true);
    $stableId = class_exists('RadioTEDU_Content') ? RadioTEDU_Content::stable_id($postId) : (string) $postId;
    if ($audio !== '') {
        printf(
            '<button class="rt-play-button" type="button" data-rt-play="podcast" data-id="%s" data-src="%s" data-title="%s" data-subtitle="%s" data-artwork="%s"><span aria-hidden="true">▶</span><span>%s</span></button>',
            esc_attr($stableId),
            esc_url($audio),
            esc_attr(get_the_title($postId)),
            esc_attr(get_the_title((int) get_post_meta($postId, '_rt_show_id', true))),
            esc_url(radiotedu_card_image($postId)),
            esc_html__('Bölümü dinle', 'radiotedu')
        );
    } elseif ($external !== '') {
        echo '<a class="rt-play-button" href="' . esc_url($external) . '" target="_blank" rel="noopener"><span aria-hidden="true">↗</span><span>' . esc_html__('Spotify’da dinle', 'radiotedu') . '</span></a>';
    }
}

function radiotedu_exclude_legacy_podcasts(WP_Query $query): void
{
    if (is_admin() || !$query->is_main_query() || !$query->is_home()) {
        return;
    }
    $category = get_category_by_slug('podcastler');
    if ($category) {
        $query->set('category__not_in', [$category->term_id]);
    }
}
add_action('pre_get_posts', 'radiotedu_exclude_legacy_podcasts');

function radiotedu_body_classes(array $classes): array
{
    $classes[] = 'rt-has-player';
    if (is_front_page()) {
        $classes[] = 'rt-page-home';
    }
    return $classes;
}
add_filter('body_class', 'radiotedu_body_classes');

function radiotedu_pingback_header(): void
{
    if (is_singular() && pings_open()) {
        echo '<link rel="pingback" href="' . esc_url(get_bloginfo('pingback_url')) . '">';
    }
}
add_action('wp_head', 'radiotedu_pingback_header');

function radiotedu_current_language(): string
{
    if (function_exists('pll_current_language')) {
        return (string) (pll_current_language('slug') ?: 'tr');
    }
    if (function_exists('get_query_var')) {
        $queryLanguage = (string) get_query_var('rt_lang');
        if (in_array($queryLanguage, ['tr', 'en'], true)) {
            return $queryLanguage;
        }
    }
    $path = (string) wp_parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
    return preg_match('#^/en(?:/|$)#', $path) ? 'en' : 'tr';
}

function radiotedu_route_slugs(): array
{
    return [
        'radyolar' => 'stations',
        'listeler' => 'playlists',
        'podcastler' => 'podcasts',
        'podcast-bolumu' => 'podcast',
        'programlar' => 'programs',
        'yayin-akisi' => 'schedule',
        'favorilerim' => 'favorites',
        'dinleme-gecmisim' => 'listening-history',
        'profilim' => 'profile',
        'giris' => 'login',
        'kayit' => 'register',
        'bize-katil' => 'join-us',
        'iletisim' => 'contact',
        'gizlilik-politikasi' => 'privacy',
        'cerez-politikasi' => 'cookies',
        'kullanim-kosullari' => 'terms',
        'hakkimizda' => 'about',
        'duyurular' => 'announcements',
        'situation' => 'situation',
    ];
}

function radiotedu_localized_url(string $url): string
{
    if (radiotedu_current_language() !== 'en' || str_contains($url, '/en/')) {
        return $url;
    }
    $parts = wp_parse_url($url);
    $home = wp_parse_url(home_url('/'));
    if (!is_array($parts) || !empty($parts['host']) && ($parts['host'] ?? '') !== ($home['host'] ?? '')) {
        return $url;
    }
    $path = trim((string) ($parts['path'] ?? ''), '/');
    $segments = $path === '' ? [] : explode('/', $path);
    if ($segments && isset(radiotedu_route_slugs()[$segments[0]])) {
        $segments[0] = radiotedu_route_slugs()[$segments[0]];
    }
    $newPath = '/en/' . ($segments ? implode('/', $segments) . '/' : '');
    $origin = isset($parts['scheme'], $parts['host'])
        ? $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '')
        : '';
    return $origin . $newPath
        . (isset($parts['query']) ? '?' . $parts['query'] : '')
        . (isset($parts['fragment']) ? '#' . $parts['fragment'] : '');
}

function radiotedu_language_url(string $language): string
{
    $parts = wp_parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'));
    $segments = array_values(array_filter(explode('/', trim((string) ($parts['path'] ?? ''), '/')), 'strlen'));
    if (($segments[0] ?? '') === 'en') {
        array_shift($segments);
    }
    $reverse = array_flip(radiotedu_route_slugs());
    if ($segments && isset($reverse[$segments[0]])) {
        $segments[0] = $reverse[$segments[0]];
    }
    if ($language === 'en' && $segments && isset(radiotedu_route_slugs()[$segments[0]])) {
        $segments[0] = radiotedu_route_slugs()[$segments[0]];
    }
    $path = '/' . ($language === 'en' ? 'en/' : '') . ($segments ? implode('/', $segments) . '/' : '');
    return home_url($path) . (isset($parts['query']) ? '?' . $parts['query'] : '');
}

function radiotedu_register_language_routes(): void
{
    add_rewrite_tag('%rt_lang%', '(tr|en)');
    $frontPageId = (int) get_option('page_on_front');
    $frontQuery = $frontPageId > 0 ? 'page_id=' . $frontPageId . '&' : '';
    add_rewrite_rule('^en/?$', 'index.php?' . $frontQuery . 'rt_lang=en', 'top');
    foreach ([
        'stations' => ['post_type' => 'rt_station'],
        'podcasts' => ['post_type' => 'rt_podcast_show'],
        'programs' => ['post_type' => 'rt_program'],
    ] as $slug => $query) {
        add_rewrite_rule('^en/' . $slug . '/?$', 'index.php?post_type=' . $query['post_type'] . '&rt_lang=en', 'top');
    }
    add_rewrite_rule('^en/stations/([^/]+)/?$', 'index.php?rt_station=$matches[1]&rt_lang=en', 'top');
    add_rewrite_rule('^en/podcasts/([^/]+)/?$', 'index.php?rt_podcast_show=$matches[1]&rt_lang=en', 'top');
    add_rewrite_rule('^en/podcast/([^/]+)/?$', 'index.php?rt_podcast_episode=$matches[1]&rt_lang=en', 'top');
    add_rewrite_rule('^en/programs/([^/]+)/?$', 'index.php?rt_program=$matches[1]&rt_lang=en', 'top');
    foreach (radiotedu_route_slugs() as $turkish => $english) {
        if (in_array($turkish, ['radyolar', 'podcastler', 'podcast-bolumu', 'programlar'], true)) {
            continue;
        }
        add_rewrite_rule('^en/' . preg_quote($english, '#') . '/?$', 'index.php?pagename=' . $turkish . '&rt_lang=en', 'top');
        add_rewrite_rule('^en/' . preg_quote($turkish, '#') . '/?$', 'index.php?pagename=' . $turkish . '&rt_lang=en', 'top');
    }
    add_rewrite_rule('^en/([^/]+)/?$', 'index.php?name=$matches[1]&rt_lang=en', 'bottom');
}
add_action('init', 'radiotedu_register_language_routes', 20);

function radiotedu_link_language(string $url): string
{
    return radiotedu_localized_url($url);
}
add_filter('post_type_archive_link', 'radiotedu_link_language');
add_filter('post_type_link', 'radiotedu_link_language');
add_filter('page_link', 'radiotedu_link_language');
add_filter('post_link', 'radiotedu_link_language');

function radiotedu_menu_language(array $atts): array
{
    if (isset($atts['href'])) {
        $atts['href'] = radiotedu_localized_url((string) $atts['href']);
    }
    return $atts;
}
add_filter('nav_menu_link_attributes', 'radiotedu_menu_language');

function radiotedu_english_locale(string $locale): string
{
    return !is_admin() && radiotedu_current_language() === 'en' ? 'en_US' : $locale;
}
add_filter('locale', 'radiotedu_english_locale');

function radiotedu_theme_translation(string $translated, string $original, string $domain): string
{
    if ($domain !== 'radiotedu' || radiotedu_current_language() !== 'en') {
        return $translated;
    }
    $translations = [
        '15 saniye geri' => 'Back 15 seconds', '30 saniye ileri' => 'Forward 30 seconds', 'Akış' => 'Schedule', 'Amazon’da ara' => 'Search on Amazon', 'Apple’dan satın al' => 'Buy on Apple Music',
        'Alt menü' => 'Footer menu', 'Ana menü' => 'Main menu', 'Ana sayfaya dön' => 'Back to home', 'Ara' => 'Search',
        'Aradığın sayfa taşınmış veya yayından kaldırılmış olabilir. Müzik çalmaya devam ediyor; sen ana sayfaya dönebilirsin.' => 'The page may have moved or gone off air. The music is still playing; head back home.',
        'Arama' => 'Search', 'Aramayı aç' => 'Open search', 'Başka bir radyo, podcast veya bölüm adı deneyin.' => 'Try another station, podcast or episode name.',
        'Bir kanal seç ve dinlemeye başla' => 'Pick a station and start listening', 'Bizden' => 'From us', 'Bu frekansta bir şey yok.' => 'Nothing on this frequency.',
        'Bu kanalın programlı yayın akışı yakında burada.' => 'This station’s schedule will appear here soon.', 'Bugün ne dinliyoruz?' => 'What are we listening to today?',
        'Bölümü dinle' => 'Play episode', 'Canlı' => 'Live', 'Canlı dinle' => 'Listen live', 'Canlı programları ve haftalık yayın saatlerini tek ekranda takip et.' => 'See live shows and the weekly schedule in one place.',
        'Canlı yayın' => 'Live radio', 'Ders arasında, yolda veya gecenin tam ortasında: altı farklı kanal ve RadioTEDU stüdyolarından çıkan podcastler tek yerde.' => 'Between classes, on the road or late at night: six stations and podcasts from the RadioTEDU studios in one place.',
        'Detay' => 'Details', 'Devamını oku' => 'Read more', 'Dil seçimi' => 'Language selection', 'Dinle' => 'Listen', 'Duraklat' => 'Pause', 'Duyurular' => 'Announcements', 'Etkinlik' => 'Event', 'Etkinlikler' => 'Events',
        'Farklı hisset.' => 'Feel different.', 'Farkı dinle.' => 'Hear the difference.', 'Favoriye ekle' => 'Add to favorites', 'Giriş' => 'Sign in', 'Gizlilik' => 'Privacy',
        'Hakkımızda' => 'About', 'Hesap bilgileri yükleniyor…' => 'Loading account…', 'Hızlı bağlantılar' => 'Quick links', 'Kampüs kültüründen spora, ekonomiden gündelik hayata uzanan RadioTEDU podcast arşivi.' => 'The RadioTEDU podcast archive spans campus culture, sports, economics and everyday life.',
        'Kanalını seç, haftanın tamamını gör. Program saatleri Türkiye saatiyle gösterilir.' => 'Choose a station and see the full week. Times are shown in Türkiye time.',
        'Kullanım koşulları' => 'Terms of use', 'Menü' => 'Menu', 'Menüyü aç' => 'Open menu', 'Oynat' => 'Play', 'Oynatma konumu' => 'Playback position', 'Podcast' => 'Podcast',
        'Listeler' => 'Playlists', 'Podcastler' => 'Podcasts', 'Podcastleri keşfet' => 'Explore podcasts', 'Programlı yayın yok' => 'No scheduled show', 'RadioTEDU Podcast' => 'RadioTEDU Podcast',
        'RadioTEDU oynatıcı' => 'RadioTEDU player', 'RadioTEDU’da ara' => 'Search RadioTEDU', 'Radyo seçimi' => 'Station picker', 'Radyo, podcast, bölüm…' => 'Station, podcast, episode…', 'Radyolar' => 'Stations',
        'Ruh halini seç. Kanalı aç. Sayfalar arasında gezerken müzik çalmaya devam etsin.' => 'Pick your mood, tune in and keep the music playing as you explore.',
        'Seriyi favorile' => 'Favorite show', 'Seriyi keşfet' => 'Explore show', 'Ses başlatılamadı. Lütfen tekrar deneyin.' => 'Audio could not start. Please try again.', 'Ses seviyesi' => 'Volume',
        'Son bölümler' => 'Latest episodes', 'Son çalanlar' => 'Recently played', 'Sonuç bulunamadı' => 'No results', 'Spotify’da dinle' => 'Listen on Spotify', 'Gelecek etkinlikler' => 'Upcoming events', 'Geçmiş etkinlikler' => 'Past events',
        'Stüdyodan çıkanlar' => 'From the studio', 'Sırada ne var?' => 'What’s next?', 'TED Üniversitesi’nin sesi' => 'The voice of TED University', 'Teknoloji' => 'Technology', 'Tüm etkinlikleri gör' => 'View all events',
        'TED Üniversitesi’nin öğrenci radyosu. Farkı dinle, farklı hisset.' => 'TED University’s student radio. Hear the difference, feel different.',
        'Tüm bölümler' => 'All episodes', 'Tüm radyolar' => 'All stations', 'Tüm seriler' => 'All shows', 'Yakında' => 'Coming soon', 'Yayın Akışı' => 'Schedule',
        'Yayın akışı' => 'Schedule', 'Yayın akışını aç' => 'Open schedule', 'Yayın bilgisi bekleniyor' => 'Waiting for broadcast info', 'Yayın geçici olarak çevrimdışı' => 'Broadcast temporarily offline',
        'Yeni' => 'New', 'Yükleniyor' => 'Loading', 'Çerezler' => 'Cookies', 'İletişim' => 'Contact', 'İçerik yolu' => 'Breadcrumb', 'İçeriğe geç' => 'Skip to content', 'Planlanmış etkinlik bulunmuyor.' => 'No events are scheduled yet.', 'Bilet sistemi güncellendiğinde yeni etkinlikler burada görünecek.' => 'New events will appear here when the ticket system is updated.',
        'Şarkı geçmişi yayına döndüğünde burada görünecek.' => 'Recently played tracks will appear here when the stream returns.', 'Şarkıyı satın al' => 'Buy this track', 'Şimdi dinle' => 'Listen now', 'Şu an' => 'Now',
        'RadioTEDU ana sayfa' => 'RadioTEDU home',
    ];
    return $translations[$original] ?? $translated;
}
add_filter('gettext', 'radiotedu_theme_translation', 10, 3);

function radiotedu_localized_title(string $title, int $postId): string
{
    if (is_admin() || radiotedu_current_language() !== 'en' || $postId <= 0) return $title;
    $english = (string) get_post_meta($postId, '_rt_title_en', true);
    return $english !== '' ? $english : $title;
}
add_filter('the_title', 'radiotedu_localized_title', 10, 2);

function radiotedu_localized_content(string $content): string
{
    if (is_admin() || radiotedu_current_language() !== 'en') return $content;
    $postId = (int) get_the_ID();
    $english = $postId ? (string) get_post_meta($postId, '_rt_content_en', true) : '';
    return $english !== '' ? $english : $content;
}
add_filter('the_content', 'radiotedu_localized_content');

function radiotedu_localized_excerpt(string $excerpt, WP_Post $post): string
{
    if (is_admin() || radiotedu_current_language() !== 'en') return $excerpt;
    $english = (string) get_post_meta($post->ID, '_rt_summary_en', true);
    return $english !== '' ? $english : $excerpt;
}
add_filter('get_the_excerpt', 'radiotedu_localized_excerpt', 10, 2);

function radiotedu_language_alternates(): void
{
    if (is_admin()) return;
    echo '<link rel="alternate" hreflang="tr" href="' . esc_url(radiotedu_language_url('tr')) . '">' . "\n";
    echo '<link rel="alternate" hreflang="en" href="' . esc_url(radiotedu_language_url('en')) . '">' . "\n";
    echo '<link rel="alternate" hreflang="x-default" href="' . esc_url(radiotedu_language_url('tr')) . '">' . "\n";
}
add_action('wp_head', 'radiotedu_language_alternates', 2);

function radiotedu_is_playlists_request(?string $url = null): bool
{
    $request = $url ?? (string) ($_SERVER['REQUEST_URI'] ?? '/');
    $path = trim((string) wp_parse_url($request, PHP_URL_PATH), '/');
    return in_array($path, ['listeler', 'en/playlists'], true);
}

function radiotedu_playlists_template(string $template): string
{
    if (!radiotedu_is_playlists_request()) {
        return $template;
    }

    global $wp_query;
    if ($wp_query instanceof WP_Query) {
        $wp_query->is_404 = false;
        $wp_query->is_page = true;
    }
    status_header(200);
    return get_theme_file_path('/page-listeler.php');
}
add_filter('template_include', 'radiotedu_playlists_template', 99);

function radiotedu_keep_language_route(string|false $redirect, string $requested): string|false
{
    $path = (string) wp_parse_url($requested, PHP_URL_PATH);
    return preg_match('#^/en(?:/|$)#', $path) || radiotedu_is_playlists_request($requested) ? false : $redirect;
}
add_filter('redirect_canonical', 'radiotedu_keep_language_route', 10, 2);

function radiotedu_block_site_kit_analytics_tag(bool $blocked): bool
{
    return true;
}
add_filter('googlesitekit_analytics-4_tag_blocked', 'radiotedu_block_site_kit_analytics_tag', 99);

function radiotedu_consent_defaults(): void
{
    if (is_admin()) {
        return;
    }
    ?>
    <script id="radiotedu-consent-defaults">
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
    window.gtag('consent', 'default', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        personalization_storage: 'denied',
        functionality_storage: 'granted',
        security_storage: 'granted'
    });
    </script>
    <?php
}
add_action('wp_head', 'radiotedu_consent_defaults', -1000);
