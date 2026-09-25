<?php
declare(strict_types=1);
$episodeId = get_the_ID();
$showId = absint(get_post_meta($episodeId, '_rt_show_id', true));
$showIndex = empty($args['hide_index']);
?>
<article class="rt-episode-card<?php echo $showIndex ? '' : ' rt-episode-card--no-index'; ?>">
    <?php if ($showIndex) : ?><div class="rt-episode-card__index" aria-hidden="true"><?php echo esc_html(str_pad((string) ($args['index'] ?? 1), 2, '0', STR_PAD_LEFT)); ?></div><?php endif; ?>
    <a class="rt-episode-card__art" href="<?php the_permalink(); ?>"><img src="<?php echo esc_url(radiotedu_card_image($episodeId)); ?>" alt="<?php echo esc_attr(get_the_title($episodeId)); ?>" loading="lazy" width="180" height="180"></a>
    <div class="rt-episode-card__body">
        <p class="rt-kicker"><?php echo radiotedu_brand_markup(get_the_title($showId)); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> · <?php echo esc_html(get_the_date('d.m.Y')); ?></p>
        <h3><a href="<?php the_permalink(); ?>"><?php echo radiotedu_brand_markup(get_the_title()); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></a></h3>
        <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 24)); ?></p>
    </div>
    <div class="rt-episode-card__action"><?php radiotedu_episode_play_button($episodeId); ?></div>
</article>
