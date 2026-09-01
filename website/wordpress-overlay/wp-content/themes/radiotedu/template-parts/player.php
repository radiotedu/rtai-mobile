<?php
declare(strict_types=1);
?>
<section class="rt-player" data-rt-player data-rt-shell aria-label="<?php esc_attr_e('RadioTEDU oynatıcı', 'radiotedu'); ?>">
    <div class="rt-player__art"><img src="<?php echo esc_url(get_template_directory_uri() . '/assets/images/radiotedu-player-logo.png'); ?>" alt="" data-rt-player-art></div>
    <div class="rt-player__identity">
        <span class="rt-player__eyebrow" data-rt-player-type><?php esc_html_e('Canlı', 'radiotedu'); ?></span>
        <strong data-rt-player-title>RadioTEDU</strong>
        <span data-rt-player-subtitle><?php esc_html_e('Bir kanal seç ve dinlemeye başla', 'radiotedu'); ?></span>
    </div>
    <div class="rt-player__controls">
        <button type="button" class="rt-player__skip" data-rt-skip="-15" aria-label="<?php esc_attr_e('15 saniye geri', 'radiotedu'); ?>">−15</button>
        <button type="button" class="rt-player__main" data-rt-player-toggle aria-label="<?php esc_attr_e('Oynat', 'radiotedu'); ?>">
            <svg class="rt-player__play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"></path></svg>
            <svg class="rt-player__pause-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM14 5h4v14h-4z"></path></svg>
        </button>
        <button type="button" class="rt-player__skip" data-rt-skip="30" aria-label="<?php esc_attr_e('30 saniye ileri', 'radiotedu'); ?>">+30</button>
    </div>
    <div class="rt-player__timeline">
        <span data-rt-current-time>0:00</span>
        <input type="range" min="0" max="100" value="0" step="0.1" data-rt-seek aria-label="<?php esc_attr_e('Oynatma konumu', 'radiotedu'); ?>">
        <span data-rt-duration>0:00</span>
    </div>
    <div class="rt-player__actions">
        <div class="rt-player__store" data-rt-player-store hidden>
            <button type="button" class="rt-icon-button rt-player__store-toggle" data-rt-player-store-toggle aria-label="<?php esc_attr_e('Şarkıyı satın al', 'radiotedu'); ?>" aria-haspopup="true" aria-expanded="false" aria-controls="rt-player-store-menu">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 9.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H7M10 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM19 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>
            </button>
            <div class="rt-player__store-menu" id="rt-player-store-menu" data-rt-player-store-menu role="menu" hidden>
                <a href="#" target="_blank" rel="noopener noreferrer" role="menuitem" data-rt-buy-apple hidden><?php esc_html_e('Apple’dan satın al', 'radiotedu'); ?></a>
                <a href="#" target="_blank" rel="noopener noreferrer" role="menuitem" data-rt-buy-amazon hidden><?php esc_html_e('Amazon’da ara', 'radiotedu'); ?></a>
            </div>
        </div>
        <button type="button" class="rt-icon-button" data-rt-player-favorite aria-label="<?php esc_attr_e('Favoriye ekle', 'radiotedu'); ?>">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5 4.5 13A5 5 0 0 1 12 6.4 5 5 0 0 1 19.5 13z"></path></svg>
        </button>
        <label class="rt-volume"><span class="screen-reader-text"><?php esc_html_e('Ses seviyesi', 'radiotedu'); ?></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"></path></svg><input type="range" min="0" max="1" value="0.8" step="0.01" data-rt-volume></label>
        <button type="button" class="rt-player__expand" data-rt-player-expand aria-expanded="false"><?php esc_html_e('Detay', 'radiotedu'); ?></button>
    </div>
    <aside class="rt-player__lyrics" data-rt-player-lyrics hidden>
        <div class="rt-player__lyrics-head">
            <span><?php echo esc_html(radiotedu_current_language() === 'en' ? 'LIVE LYRICS' : 'CANLI SÖZLER'); ?></span>
            <span class="rt-player__lyrics-actions">
                <a href="https://lrclib.net" target="_blank" rel="noopener noreferrer">LRCLIB</a>
                <button type="button" data-rt-lyrics-close aria-label="<?php echo esc_attr(radiotedu_current_language() === 'en' ? 'Close live lyrics' : 'Canlı sözleri kapat'); ?>">×</button>
            </span>
        </div>
        <div class="rt-player__lyrics-lines" data-rt-lyrics-lines tabindex="0" role="region" aria-label="<?php echo esc_attr(radiotedu_current_language() === 'en' ? 'Scrollable song lyrics' : 'Kaydırılabilir şarkı sözleri'); ?>"></div>
    </aside>
    <p class="rt-player__status" role="status" aria-live="polite" data-rt-player-status></p>
</section>
