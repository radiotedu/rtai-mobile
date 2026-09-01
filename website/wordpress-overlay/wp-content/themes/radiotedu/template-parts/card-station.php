<?php
declare(strict_types=1);

$stationId = get_the_ID();
$stableId = class_exists('RadioTEDU_Content') ? RadioTEDU_Content::stable_id($stationId) : (string) $stationId;
$stream = (string) get_post_meta($stationId, '_rt_stream_url', true);
$logo = radiotedu_station_logo_url($stationId);
?>
<article class="rt-station-card">
    <a class="rt-station-card__art" href="<?php the_permalink(); ?>" tabindex="-1" aria-hidden="true">
        <img src="<?php echo esc_url($logo); ?>" alt="" loading="lazy" decoding="async" width="768" height="768">
    </a>
    <div class="rt-station-card__body">
        <span class="rt-station-card__type"><?php esc_html_e('Radyo', 'radiotedu'); ?></span>
        <h3><a href="<?php the_permalink(); ?>"><?php echo radiotedu_brand_markup(get_the_title()); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></a></h3>
        <p><?php echo esc_html(radiotedu_station_summary($stationId)); ?></p>
        <button class="rt-play-button" type="button" data-rt-play="station" data-id="<?php echo esc_attr($stableId); ?>" data-src="<?php echo esc_url($stream); ?>" data-title="<?php echo esc_attr(get_the_title()); ?>" data-subtitle="<?php esc_attr_e('Canlı yayın', 'radiotedu'); ?>" data-artwork="<?php echo esc_url($logo); ?>" <?php disabled($stream === ''); ?>>
            <span aria-hidden="true">▶</span><span><?php esc_html_e('Dinle', 'radiotedu'); ?></span>
        </button>
    </div>
</article>
