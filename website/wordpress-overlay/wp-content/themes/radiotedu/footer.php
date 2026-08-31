<?php
declare(strict_types=1);
?>
<?php do_action('radiotedu_before_footer'); ?>
</main>
<footer class="rt-footer" data-rt-shell>
    <div class="rt-footer__signal" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="rt-footer__grid">
        <div>
            <a class="rt-footer__logo" href="<?php echo esc_url(home_url('/')); ?>"><?php echo radiotedu_logo(true); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></a>
            <p><?php esc_html_e('TED Üniversitesi’nin öğrenci radyosu. Farkı dinle, farklı hisset.', 'radiotedu'); ?></p>
            <p class="rt-footer__technology-note">RadioTEDU uses ITU-R BS.1770-5 loudness and true-peak measurement with the EBU R128 broadcast reference. Streams are encoded by our internally compiled, non-distributed <a href="https://github.com/ffmpeg" target="_blank" rel="noopener noreferrer">FFmpeg</a> build using Fraunhofer FDK AAC: HE-AAC v2 for efficient low-bitrate delivery and AAC-LC at 192 kbit/s for full-quality listening. Classical and Jazz are also available in lossless <a href="https://github.com/xiph/flac" target="_blank" rel="noopener noreferrer">FLAC</a>. See our <a href="https://radiotedu.com/technology">Technology</a> page for more.</p>
        </div>
        <nav aria-label="<?php esc_attr_e('Alt menü', 'radiotedu'); ?>">
            <?php wp_nav_menu(['theme_location' => 'footer', 'container' => false, 'menu_class' => 'rt-footer__links', 'fallback_cb' => 'radiotedu_menu_fallback']); ?>
        </nav>
        <div class="rt-footer__contact">
            <address class="rt-footer__address">
                <strong><?php echo esc_html(radiotedu_current_language() === 'en' ? 'RadioTEDU Ankara Studios' : 'RadioTEDU Ankara Stüdyoları'); ?></strong>
                <span>TED Üniversitesi<br>Ziya Gökalp Cad. No:48<br>Kolej, Çankaya, Ankara, Türkiye</span>
            </address>
            <a href="mailto:radio@tedu.edu.tr">radio@tedu.edu.tr</a>
            <a href="https://www.instagram.com/radiotedu/" target="_blank" rel="noopener">Instagram</a>
            <a href="https://www.youtube.com/@RadioTEDU" target="_blank" rel="noopener">YouTube</a>
        </div>
    </div>
    <div class="rt-footer__legal">
            <span>© <?php echo esc_html(wp_date('Y')); ?> <span class="rt-brand">RadioTEDU</span></span>
        <a href="<?php echo esc_url(radiotedu_localized_url(home_url('/gizlilik-politikasi/'))); ?>"><?php esc_html_e('Gizlilik', 'radiotedu'); ?></a>
        <a href="<?php echo esc_url(radiotedu_localized_url(home_url('/cerez-politikasi/'))); ?>"><?php esc_html_e('Çerezler', 'radiotedu'); ?></a>
        <button type="button" class="rt-footer__legal-button" data-rt-cookie-open><?php echo esc_html(radiotedu_current_language() === 'en' ? 'Cookie preferences' : 'Çerez tercihleri'); ?></button>
        <a href="<?php echo esc_url(radiotedu_localized_url(home_url('/kullanim-kosullari/'))); ?>"><?php esc_html_e('Kullanım koşulları', 'radiotedu'); ?></a>
    </div>
</footer>
<?php get_template_part('template-parts/cookie-consent'); ?>
<?php get_template_part('template-parts/player'); ?>
<?php wp_footer(); ?>
</body>
</html>
