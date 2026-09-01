(() => {
  document.documentElement.classList.add('js');

  const toggle = document.querySelector('.lab-menu');
  const menu = document.querySelector('#lab-nav');

  const setMenu = (open) => {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
  };

  toggle?.addEventListener('click', () => {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });

  menu?.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
  });

  const removeFailedImage = (image) => {
    const goal = image.closest('.sdg-logos li');
    if (goal) {
      goal.remove();
      return;
    }
    image.hidden = true;
    image.closest('figure, .situation-band, .operations-story, .social-frame, .access-story')?.classList.add('media-unavailable');
  };

  document.querySelectorAll('img').forEach((image) => {
    image.addEventListener('error', () => removeFailedImage(image), { once: true });
    if (image.complete && image.naturalWidth === 0) removeFailedImage(image);
  });

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals = [...document.querySelectorAll('[data-reveal]')];
  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  reveals.forEach((item) => observer.observe(item));
})();
