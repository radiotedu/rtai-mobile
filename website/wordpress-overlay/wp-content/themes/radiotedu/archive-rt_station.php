<?php
declare(strict_types=1);

get_header();

$stations = [];
while (have_posts()) {
    the_post();
    $stations[] = get_post();
}

$mainStation = null;
$otherStations = [];
foreach ($stations as $station) {
    $stableId = class_exists('RadioTEDU_Content')
        ? RadioTEDU_Content::stable_id((int) $station->ID)
        : (string) get_post_meta((int) $station->ID, '_rt_stable_id', true);
    if ($stableId === 'radiotedu-main' || (!$mainStation && strcasecmp((string) $station->post_title, 'RadioTEDU') === 0)) {
        $mainStation = $station;
        continue;
    }
    $otherStations[] = $station;
}

if (!$mainStation && $stations) {
    $mainStation = array_shift($otherStations);
}

if ($mainStation) {
    $mainId = (int) $mainStation->ID;
    $mainStableId = class_exists('RadioTEDU_Content')
        ? RadioTEDU_Content::stable_id($mainId)
        : (string) get_post_meta($mainId, '_rt_stable_id', true);
    $mainStableId = $mainStableId ?: 'radiotedu-main';
    $mainStream = (string) get_post_meta($mainId, '_rt_stream_url', true);
    $mainLogo = radiotedu_station_logo_url($mainId);
    $mainExcerpt = trim((string) get_the_excerpt($mainId));
    ?>
    <section class="rt-stations-flagship rt-shell" aria-labelledby="rt-stations-title" data-rt-station-feature data-station-id="<?php echo esc_attr($mainStableId); ?>" data-fallback-artwork="<?php echo esc_url($mainLogo); ?>">
        <div class="rt-stations-flagship__copy">
            <p class="rt-kicker"><?php esc_html_e('Ana istasyon', 'radiotedu'); ?></p>
            <div class="rt-stations-flagship__identity">
                <img src="<?php echo esc_url($mainLogo); ?>" alt="" width="768" height="768">
                <div>
                    <h1 id="rt-stations-title"><?php echo radiotedu_brand_markup(get_the_title($mainId)); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></h1>
                    <p><?php esc_html_e('TED Üniversitesi’nin sesi', 'radiotedu'); ?></p>
                </div>
            </div>
            <?php if ($mainExcerpt !== '') : ?>
                <p class="rt-stations-flagship__description"><?php echo esc_html($mainExcerpt); ?></p>
            <?php endif; ?>
            <div class="rt-stations-flagship__actions">
                <button class="rt-button rt-button--primary" type="button" data-rt-play="station" data-id="<?php echo esc_attr($mainStableId); ?>" data-src="<?php echo esc_url($mainStream); ?>" data-title="<?php echo esc_attr(get_the_title($mainId)); ?>" data-subtitle="<?php esc_attr_e('Canlı yayın', 'radiotedu'); ?>" data-artwork="<?php echo esc_url($mainLogo); ?>" <?php disabled($mainStream === ''); ?>>
                    <span aria-hidden="true">▶</span><span><?php esc_html_e('Canlı dinle', 'radiotedu'); ?></span>
                </button>
                <a class="rt-button rt-button--ghost" href="<?php echo esc_url(get_permalink($mainId)); ?>"><?php esc_html_e('Yayın akışı', 'radiotedu'); ?></a>
            </div>
        </div>

        <div class="rt-stations-flagship__now" aria-live="polite">
            <img class="rt-stations-flagship__artwork" src="<?php echo esc_url($mainLogo); ?>" alt="" width="768" height="768" data-rt-station-feature-artwork>
            <div class="rt-stations-flagship__metadata">
                <span class="rt-live-dot"><i></i><?php esc_html_e('Şu anda yayında', 'radiotedu'); ?></span>
                <strong data-rt-station-feature-track><?php esc_html_e('Yayın bilgisi güncelleniyor.', 'radiotedu'); ?></strong>
                <span data-rt-station-feature-artist>RadioTEDU</span>
                <small data-rt-station-feature-status><?php esc_html_e('Canlı yayın bilgisi otomatik olarak yenilenir.', 'radiotedu'); ?></small>
            </div>
        </div>
    </section>
    <?php
}
?>

<section class="rt-stations-directory rt-section rt-shell" aria-labelledby="rt-other-stations-title">
    <header class="rt-section__header">
        <div><p class="rt-kicker"><?php esc_html_e('Radyo seçimi', 'radiotedu'); ?></p><h2 id="rt-other-stations-title"><?php esc_html_e('Diğer radyolar', 'radiotedu'); ?></h2></div>
        <p><?php esc_html_e('RadioTEDU’nun farklı ruh hâlleri için hazırlanan diğer kanallarını keşfet.', 'radiotedu'); ?></p>
    </header>
    <div class="rt-station-grid rt-station-grid--archive">
        <?php
        global $post;
        foreach ($otherStations as $station) {
            $post = $station; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
            setup_postdata($post);
            get_template_part('template-parts/card', 'station');
        }
        wp_reset_postdata();
        ?>
    </div>
    <?php the_posts_pagination(); ?>
</section>

<?php get_footer(); ?>
