<?php
declare(strict_types=1);
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <link rel="alternate" type="text/plain" href="<?php echo esc_url(home_url('/llms-ai.txt')); ?>" title="RadioTEDU LLM-readable site summary">
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#ed1c24">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="rt-skip-link" href="#rt-page"><?php esc_html_e('İçeriğe geç', 'radiotedu'); ?></a>
<div class="rt-route-progress" aria-hidden="true"></div>
<header class="rt-header" data-rt-shell>
    <div class="rt-header__inner">
            <a class="rt-logo" href="<?php echo esc_url(home_url('/')); ?>" aria-label="<?php esc_attr_e('RadioTEDU ana sayfa', 'radiotedu'); ?>">
            <?php echo radiotedu_logo(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
        </a>
        <nav class="rt-header__quick" aria-label="<?php esc_attr_e('Hızlı bağlantılar', 'radiotedu'); ?>">
            <a href="<?php echo esc_url(radiotedu_localized_url((string) get_post_type_archive_link('rt_station'))); ?>"><?php esc_html_e('Radyolar', 'radiotedu'); ?></a>
            <a href="<?php echo esc_url(home_url('/rtai/')); ?>" data-no-pjax>AI</a>
            <a href="<?php echo esc_url(radiotedu_localized_url(home_url('/listeler/'))); ?>"><?php esc_html_e('Listeler', 'radiotedu'); ?></a>
            <a href="<?php echo esc_url(radiotedu_localized_url((string) get_post_type_archive_link('rt_podcast_show'))); ?>"><?php esc_html_e('Podcastler', 'radiotedu'); ?></a>
            <a href="<?php echo esc_url(radiotedu_localized_url(home_url('/yayin-akisi/'))); ?>"><?php esc_html_e('Yayın Akışı', 'radiotedu'); ?></a>
        </nav>
        <div class="rt-header__actions">
            <button class="rt-icon-button" type="button" data-rt-search-toggle aria-label="<?php esc_attr_e('Aramayı aç', 'radiotedu'); ?>">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 5 5"></path></svg>
            </button>
            <a class="rt-account-link" href="<?php echo esc_url(radiotedu_localized_url(home_url('/giris/'))); ?>" data-rt-account-link>
                    <span class="rt-account-link__identity" data-rt-account-name><?php echo esc_html(function_exists('radiotedu_current_language') && radiotedu_current_language() === 'en' ? 'Log in' : 'Giriş yap'); ?></span>
                <span class="rt-account-link__gold" data-rt-account-gold hidden><b data-rt-account-gold-value>0</b><i aria-hidden="true">G</i></span>
                <svg class="rt-account-link__menu" viewBox="0 0 20 20" aria-hidden="true"><circle cx="4" cy="10" r="1.5"></circle><circle cx="10" cy="10" r="1.5"></circle><circle cx="16" cy="10" r="1.5"></circle></svg>
            </a>
            <a class="rt-account-link rt-social-launch" href="<?php echo esc_url(home_url('/social/')); ?>" data-no-pjax aria-label="RadioTEDU Social">
                <span class="rt-social-launch__label rt-account-link__identity">SOCIAL</span>
                <span class="rt-social-launch__scene" aria-hidden="true"></span>
            </a>
            <button class="rt-nav-toggle" type="button" aria-expanded="false" aria-controls="rt-primary-nav">
                <span class="rt-nav-toggle__label"><?php esc_html_e('Menü', 'radiotedu'); ?></span>
                <span class="rt-nav-toggle__icon" aria-hidden="true"><i></i><i></i></span>
                <span class="screen-reader-text"><?php esc_html_e('Menüyü aç', 'radiotedu'); ?></span>
            </button>
        </div>
    </div>
    <nav class="rt-nav" id="rt-primary-nav" aria-label="<?php esc_attr_e('Ana menü', 'radiotedu'); ?>">
        <div class="rt-nav__head">
            <span>RadioTEDU / NAV</span>
            <?php radiotedu_language_switcher(); ?>
        </div>
        <?php wp_nav_menu(['theme_location' => 'primary', 'container' => false, 'menu_class' => 'rt-nav__list', 'fallback_cb' => 'radiotedu_menu_fallback']); ?>
        <a class="rt-nav__mail" href="mailto:radio@tedu.edu.tr"><span><?php esc_html_e('İletişim', 'radiotedu'); ?></span>radio@tedu.edu.tr</a>
    </nav>
    <div class="rt-search-drawer" hidden data-rt-search-drawer>
        <form role="search" method="get" action="<?php echo esc_url(radiotedu_localized_url(home_url('/'))); ?>">
            <label for="rt-search-input"><?php esc_html_e('RadioTEDU’da ara', 'radiotedu'); ?></label>
            <div class="rt-search-drawer__field">
                <input id="rt-search-input" type="search" name="s" placeholder="<?php esc_attr_e('Radyo, podcast, bölüm…', 'radiotedu'); ?>" autocomplete="off">
                <button type="submit"><?php esc_html_e('Ara', 'radiotedu'); ?></button>
            </div>
        </form>
    </div>
</header>
<?php $rtAccountEnglish = function_exists('radiotedu_current_language') && radiotedu_current_language() === 'en'; ?>
<div class="rt-account-modal" data-rt-account-modal hidden aria-hidden="true">
    <button class="rt-account-modal__backdrop" type="button" data-rt-account-close tabindex="-1" aria-label="<?php esc_attr_e('Hesap penceresini kapat', 'radiotedu'); ?>"></button>
    <section class="rt-account-modal__panel" role="dialog" aria-modal="true" aria-labelledby="rt-account-modal-title" tabindex="-1">
        <aside class="rt-account-modal__intro">
            <a class="rt-account-modal__brand" href="<?php echo esc_url(home_url('/')); ?>" aria-label="RadioTEDU">
                <span>Radio</span>TEDU<i aria-hidden="true"></i>
            </a>
            <div class="rt-account-modal__intro-copy">
                <p><?php echo esc_html($rtAccountEnglish ? 'Your RadioTEDU account' : 'RadioTEDU hesabın'); ?></p>
                <h2><?php echo esc_html($rtAccountEnglish ? 'Keep your listening with you.' : 'Dinlediklerin seninle kalsın.'); ?></h2>
                <p><?php echo esc_html($rtAccountEnglish ? 'Save favourites, continue episodes and keep your radio world in one place.' : 'Favorilerini kaydet, bölümlere kaldığın yerden devam et ve radyo dünyanı tek yerde tut.'); ?></p>
            </div>
            <div class="rt-account-modal__signal" aria-hidden="true">
                <?php foreach ([36, 68, 48, 82, 54, 72, 42, 88, 58, 76, 46, 64] as $height) : ?>
                    <i style="--signal-height: <?php echo esc_attr((string) $height); ?>%"></i>
                <?php endforeach; ?>
            </div>
            <span class="rt-account-modal__intro-foot">LIVE FROM ANKARA · 24/7</span>
        </aside>
        <div class="rt-account-modal__content">
            <header class="rt-account-modal__head">
                <div>
                    <span>RADIOTEDU / ACCOUNT</span>
                    <h2 id="rt-account-modal-title"><?php echo esc_html($rtAccountEnglish ? 'Welcome back.' : 'Tekrar hoş geldin.'); ?></h2>
                </div>
                <button class="rt-account-modal__close" type="button" data-rt-account-close aria-label="<?php esc_attr_e('Kapat', 'radiotedu'); ?>"><span aria-hidden="true"></span></button>
            </header>
            <div class="rt-account-modal__tabs" role="tablist" aria-label="<?php esc_attr_e('Hesap işlemleri', 'radiotedu'); ?>">
                        <button type="button" role="tab" data-rt-account-mode="giris"><?php echo esc_html($rtAccountEnglish ? 'Log in' : 'Giriş yap'); ?></button>
                <button type="button" role="tab" data-rt-account-mode="kayit"><?php echo esc_html($rtAccountEnglish ? 'Create account' : 'Kayıt ol'); ?></button>
            </div>
            <div class="rt-account-modal__app" data-rt-account-modal-app>
                <div class="rt-loading"><span></span><?php echo esc_html($rtAccountEnglish ? 'Loading account…' : 'Hesap bilgileri yükleniyor…'); ?></div>
            </div>
            <p class="rt-account-modal__privacy">
                <span aria-hidden="true">●</span>
                <?php echo esc_html($rtAccountEnglish ? 'Your session is protected with a secure cookie.' : 'Oturumun güvenli çerez ile korunur.'); ?>
            </p>
        </div>
    </section>
</div>
<main id="rt-page" class="rt-page" tabindex="-1" data-rt-page>
