/**
 * AsiaPower — Half-Cut photo lightbox (detail gallery + catalog cards)
 */
(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function photoLabel(photo, index) {
    return typeof photo === 'object' && photo.label ? photo.label : `Photo ${index + 1}`;
  }

  let lightboxEl = null;
  let lightboxPhotos = [];
  let lightboxIndex = 0;
  let lightboxPhotoUrl = null;
  let catalogZoomBound = false;

  function ensureLightbox() {
    if (lightboxEl) return lightboxEl;

    lightboxEl = document.createElement('div');
    lightboxEl.className = 'half-cut-lightbox';
    lightboxEl.hidden = true;
    lightboxEl.setAttribute('role', 'dialog');
    lightboxEl.setAttribute('aria-modal', 'true');
    lightboxEl.innerHTML = `
      <button type="button" class="half-cut-lightbox__backdrop" aria-label="Close gallery"></button>
      <button type="button" class="half-cut-lightbox__close" aria-label="Close">&times;</button>
      <button type="button" class="half-cut-lightbox__nav half-cut-lightbox__nav--prev" aria-label="Previous photo">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button type="button" class="half-cut-lightbox__nav half-cut-lightbox__nav--next" aria-label="Next photo">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="half-cut-lightbox__dialog">
        <figure class="half-cut-lightbox__figure">
          <img class="half-cut-lightbox__img" src="" alt="">
          <figcaption class="half-cut-lightbox__caption"></figcaption>
        </figure>
        <p class="half-cut-lightbox__counter"></p>
      </div>`;
    document.body.appendChild(lightboxEl);

    lightboxEl.querySelector('.half-cut-lightbox__backdrop').addEventListener('click', close);
    lightboxEl.querySelector('.half-cut-lightbox__close').addEventListener('click', close);
    lightboxEl.querySelector('.half-cut-lightbox__nav--prev').addEventListener('click', () => step(-1));
    lightboxEl.querySelector('.half-cut-lightbox__nav--next').addEventListener('click', () => step(1));

    document.addEventListener('keydown', (event) => {
      if (lightboxEl.hidden) return;
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    });

    return lightboxEl;
  }

  function renderSlide() {
    if (!lightboxEl || !lightboxPhotos.length || !lightboxPhotoUrl) return;
    const photo = lightboxPhotos[lightboxIndex];
    const label = photoLabel(photo, lightboxIndex);
    const url = lightboxPhotoUrl(photo);
    const img = lightboxEl.querySelector('.half-cut-lightbox__img');
    const caption = lightboxEl.querySelector('.half-cut-lightbox__caption');
    const counter = lightboxEl.querySelector('.half-cut-lightbox__counter');
    const prev = lightboxEl.querySelector('.half-cut-lightbox__nav--prev');
    const next = lightboxEl.querySelector('.half-cut-lightbox__nav--next');

    img.src = url;
    img.alt = label;
    caption.textContent = label;
    counter.textContent = `${lightboxIndex + 1} / ${lightboxPhotos.length}`;
    lightboxEl.setAttribute('aria-label', label);

    const single = lightboxPhotos.length <= 1;
    prev.hidden = single;
    next.hidden = single;
  }

  function open(photos, index, photoUrlFn) {
    if (!photos?.length || typeof photoUrlFn !== 'function') return;
    ensureLightbox();
    lightboxPhotoUrl = photoUrlFn;
    lightboxPhotos = photos;
    lightboxIndex = Math.max(0, Math.min(index, photos.length - 1));
    renderSlide();
    lightboxEl.hidden = false;
    document.body.style.overflow = 'hidden';
    lightboxEl.querySelector('.half-cut-lightbox__close').focus();
  }

  function close() {
    if (!lightboxEl || lightboxEl.hidden) return;
    lightboxEl.hidden = true;
    document.body.style.overflow = '';
    lightboxEl.querySelector('.half-cut-lightbox__img').removeAttribute('src');
  }

  function step(delta) {
    if (!lightboxPhotos.length) return;
    lightboxIndex = (lightboxIndex + delta + lightboxPhotos.length) % lightboxPhotos.length;
    renderSlide();
  }

  function bindDetailGallery(root, item, utils) {
    const gallery = root?.querySelector('.half-cut-gallery');
    if (!gallery || !utils?.hasPhotos?.(item)) return;
    gallery.querySelectorAll('.half-cut-gallery__zoom').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.closest('[data-gallery-index]')?.dataset.galleryIndex || 0);
        open(item.photos, index, (photo) => utils.photoUrl(photo));
      });
    });
  }

  function bindCatalogZoom() {
    if (catalogZoomBound) return;
    catalogZoomBound = true;
    document.addEventListener('click', (event) => {
      const button = event.target.closest('.half-cut-card__zoom');
      if (!button) return;
      event.preventDefault();
      const card = button.closest('.half-cut-card');
      if (!card) return;
      const item = window.getHalfCutBySlug?.(card.dataset.slug);
      const utils = window.HalfCutUtils;
      if (!item || !utils?.hasPhotos?.(item)) return;
      open(item.photos, 0, (photo) => utils.photoUrl(photo));
    });
  }

  window.HalfCutGalleryLightbox = {
    open,
    close,
    bindDetailGallery,
    bindCatalogZoom,
    escapeHtml,
    photoLabel,
  };

  bindCatalogZoom();
})();
