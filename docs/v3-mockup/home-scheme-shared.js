/** Shared search routing for home scheme previews */
(function () {
  'use strict';

  function routeSearch(raw) {
    const q = String(raw || '').trim();
    if (!q) return;
    const upper = q.toUpperCase();
    let url = '../../half-cuts/index.html?q=' + encodeURIComponent(q);
    if (/^(ENG|GB|CH)-/i.test(upper) || /\b[0-9][A-Z]{1,3}-[A-Z0-9]{2,}/i.test(q)) {
      url = '../../engines/index.html?q=' + encodeURIComponent(q);
    }
    location.href = url;
  }

  document.querySelectorAll('[data-scheme-search]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="search"], input[name="q"]');
      routeSearch(input?.value);
    });
  });

  document.querySelectorAll('[data-hot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.hot || btn.textContent;
      const input = document.querySelector('[data-scheme-search] input');
      if (input) input.value = q;
      routeSearch(q);
    });
  });

  document.querySelectorAll('[data-carousel]').forEach((root) => {
    const track = root.querySelector('[data-carousel-track]');
    const prev = root.querySelector('[data-carousel-prev]');
    const next = root.querySelector('[data-carousel-next]');
    if (!track) return;

    const step = () => {
      const card = track.querySelector('.ebay-card');
      return card ? card.offsetWidth + 12 : 180;
    };

    prev?.addEventListener('click', () => {
      track.scrollBy({ left: -step() * 3, behavior: 'smooth' });
    });
    next?.addEventListener('click', () => {
      track.scrollBy({ left: step() * 3, behavior: 'smooth' });
    });
  });
})();
