(() => {
  'use strict';

  const buttons = Array.from(document.querySelectorAll('[data-archive-src]'));
  const panel = document.getElementById('archive-player');
  const slot = document.getElementById('archive-audio-slot');
  const title = document.getElementById('archive-player-title');
  let audio = null;
  let activeButton = null;

  if (!panel || !slot || !title || buttons.length === 0) return;

  const setButtonState = (button, playing) => {
    button.textContent = playing ? 'Duraklat' : 'Oynat';
    button.setAttribute('aria-pressed', playing ? 'true' : 'false');
  };

  const ensureAudio = () => {
    if (audio) return audio;

    audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.addEventListener('pause', () => {
      if (activeButton) setButtonState(activeButton, false);
    });
    audio.addEventListener('play', () => {
      if (activeButton) setButtonState(activeButton, true);
    });
    audio.addEventListener('ended', () => {
      if (activeButton) setButtonState(activeButton, false);
    });
    slot.appendChild(audio);
    return audio;
  };

  buttons.forEach((button) => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', async () => {
      const player = ensureAudio();
      const source = button.dataset.archiveSrc || '';
      const itemTitle = button.dataset.archiveTitle || 'Arşiv kaydı';

      if (activeButton === button && player.src && !player.paused) {
        player.pause();
        return;
      }

      if (activeButton && activeButton !== button) setButtonState(activeButton, false);
      activeButton = button;

      if (player.dataset.archiveSrc !== source) {
        player.pause();
        player.removeAttribute('src');
        player.load();
        player.src = source;
        player.dataset.archiveSrc = source;
      }

      title.textContent = itemTitle;
      panel.hidden = false;
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      try {
        await player.play();
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'archive_play', { archive_title: itemTitle });
        }
      } catch (error) {
        setButtonState(button, false);
      }
    });
  });
})();
