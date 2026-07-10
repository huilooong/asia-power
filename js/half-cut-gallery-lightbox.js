/**
 * AsiaPower — Photo viewer: detail carousel, lightbox, catalog thumbnails
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

  function progressSegmentsHtml(count, activeIndex) {
    return Array.from({ length: count }, (_, i) => {
      let cls = 'ap-photo-progress__seg';
      if (i < activeIndex) cls += ' is-done';
      if (i === activeIndex) cls += ' is-active';
      return `<span class="${cls}" aria-hidden="true"></span>`;
    }).join('');
  }

  function updateProgressTrack(trackEl, activeIndex) {
    if (!trackEl) return;
    trackEl.querySelectorAll('.ap-photo-progress__seg').forEach((seg, i) => {
      seg.classList.toggle('is-done', i < activeIndex);
      seg.classList.toggle('is-active', i === activeIndex);
    });
  }

  function bindSwipe(el, onPrev, onNext) {
    if (!el) return;
    let startX = 0;
    let startY = 0;
    el.addEventListener('touchstart', (event) => {
      const touch = event.changedTouches[0];
      startX = touch.screenX;
      startY = touch.screenY;
    }, { passive: true });
    el.addEventListener('touchend', (event) => {
      const touch = event.changedTouches[0];
      const dx = touch.screenX - startX;
      const dy = touch.screenY - startY;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) onNext();
      else onPrev();
    }, { passive: true });
  }

  function bindHitZones(stageEl, onPrev, onNext) {
    if (!stageEl) return;
    stageEl.querySelectorAll('.ap-photo-viewer__hit--prev, .half-cut-lightbox__hit--prev').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        onPrev();
      });
    });
    stageEl.querySelectorAll('.ap-photo-viewer__hit--next, .half-cut-lightbox__hit--next').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        onNext();
      });
    });
  }

  let lightboxEl = null;
  let lightboxPhotos = [];
  let lightboxIndex = 0;
  let lightboxPhotoUrl = null;
  let catalogPhotoBound = false;

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
          <div class="half-cut-lightbox__stage">
            <img class="half-cut-lightbox__img" src="" alt="">
            <button type="button" class="half-cut-lightbox__hit half-cut-lightbox__hit--prev" aria-label="Previous photo" tabindex="-1"></button>
            <button type="button" class="half-cut-lightbox__hit half-cut-lightbox__hit--next" aria-label="Next photo" tabindex="-1"></button>
            <div class="ap-photo-progress half-cut-lightbox__progress" role="progressbar" aria-valuemin="1" aria-valuemax="1" aria-valuenow="1">
              <div class="ap-photo-progress__track"></div>
            </div>
          </div>
          <figcaption class="half-cut-lightbox__caption"></figcaption>
        </figure>
        <p class="half-cut-lightbox__counter"></p>
      </div>`;
    document.body.appendChild(lightboxEl);

    const stage = lightboxEl.querySelector('.half-cut-lightbox__stage');
    lightboxEl.querySelector('.half-cut-lightbox__backdrop').addEventListener('click', close);
    lightboxEl.querySelector('.half-cut-lightbox__close').addEventListener('click', close);
    lightboxEl.querySelector('.half-cut-lightbox__nav--prev').addEventListener('click', () => step(-1));
    lightboxEl.querySelector('.half-cut-lightbox__nav--next').addEventListener('click', () => step(1));
    bindHitZones(stage, () => step(-1), () => step(1));
    bindSwipe(stage, () => step(-1), () => step(1));

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
    const progress = lightboxEl.querySelector('.half-cut-lightbox__progress');
    const track = lightboxEl.querySelector('.half-cut-lightbox__progress .ap-photo-progress__track');

    img.src = url;
    img.alt = label;
    caption.textContent = label;
    counter.textContent = `${lightboxIndex + 1} / ${lightboxPhotos.length}`;
    lightboxEl.setAttribute('aria-label', label);

    const single = lightboxPhotos.length <= 1;
    prev.hidden = single;
    next.hidden = single;
    lightboxEl.querySelectorAll('.half-cut-lightbox__hit').forEach((hit) => {
      hit.hidden = single;
    });
    progress.hidden = single;

    if (progress) {
      progress.setAttribute('aria-valuemax', String(lightboxPhotos.length));
      progress.setAttribute('aria-valuenow', String(lightboxIndex + 1));
    }
    if (track) {
      track.innerHTML = progressSegmentsHtml(lightboxPhotos.length, lightboxIndex);
    }
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

  function bindPhotoViewer(root, item, utils) {
    const viewer = root?.querySelector('[data-ap-photo-viewer]');
    if (!viewer || !utils?.hasPhotos?.(item)) return;

    const photos = item.photos;
    let index = 0;
    const img = viewer.querySelector('.ap-photo-viewer__img');
    const caption = viewer.querySelector('.ap-photo-viewer__caption');
    const counter = viewer.querySelector('.ap-photo-viewer__counter');
    const progress = viewer.querySelector('.ap-photo-viewer__progress');
    const track = viewer.querySelector('.ap-photo-progress__track');
    const stage = viewer.querySelector('.ap-photo-viewer__stage');
    const prevNav = viewer.querySelector('.ap-photo-viewer__nav--prev');
    const nextNav = viewer.querySelector('.ap-photo-viewer__nav--next');
    const hits = viewer.querySelectorAll('.ap-photo-viewer__hit');
    const expandBtn = viewer.querySelector('.ap-photo-viewer__expand');
    const thumbs = root.querySelectorAll('.hc-item-detail__thumb');
    const single = photos.length <= 1;

    function syncThumbs() {
      thumbs.forEach((thumb, i) => {
        const active = i === index;
        thumb.classList.toggle('is-active', active);
        thumb.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }

    function render() {
      const photo = photos[index];
      const label = photoLabel(photo, index);
      const url = utils.photoUrl(photo);
      if (img) {
        img.src = url;
        img.alt = label;
      }
      if (caption) caption.textContent = label;
      if (counter) counter.textContent = `${index + 1} / ${photos.length}`;
      if (progress) {
        progress.setAttribute('aria-valuemax', String(photos.length));
        progress.setAttribute('aria-valuenow', String(index + 1));
      }
      updateProgressTrack(track, index);
      if (prevNav) prevNav.hidden = single;
      if (nextNav) nextNav.hidden = single;
      hits.forEach((hit) => { hit.hidden = single; });
      syncThumbs();
    }

    function go(delta) {
      if (single) return;
      index = (index + delta + photos.length) % photos.length;
      render();
    }

    function goTo(nextIndex) {
      if (single || nextIndex < 0 || nextIndex >= photos.length) return;
      index = nextIndex;
      render();
    }

    prevNav?.addEventListener('click', () => go(-1));
    nextNav?.addEventListener('click', () => go(1));
    bindHitZones(stage, () => go(-1), () => go(1));
    bindSwipe(stage, () => go(-1), () => go(1));

    thumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        goTo(Number(thumb.dataset.photoIndex) || 0);
      });
    });

    expandBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      open(photos, index, (photo) => utils.photoUrl(photo));
    });

    stage?.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    });

    render();
  }

  function bindDetailGallery(root, item, utils) {
    bindPhotoViewer(root, item, utils);
  }

  function resolveItemBySlug(slug) {
    if (!slug) return null;

    const fromCatalog = window.getHalfCutBySlug?.(slug);
    if (fromCatalog) return fromCatalog;

    const bySlugMap = window.HALF_CUT_BY_SLUG || {};
    let item = bySlugMap[slug] || null;
    if (!item) {
      const approved = window.HalfCutInventoryStore?.getApprovedInventory?.() || [];
      item = approved.find((entry) => entry.slug === slug
        || (entry.slugAliases || []).includes(slug)) || null;
    }
    if (!item) return null;

    if (window.HalfCutInventoryLayer?.toPublicItem && item.vin) {
      return window.HalfCutInventoryLayer.toPublicItem(item);
    }
    return item;
  }

  function listingThumbUrl(photo, utils) {
    return utils?.thumbPhotoUrl?.(photo) || utils?.photoUrl?.(photo) || '';
  }

  function updateListingProgress(trackEl, activeIndex) {
    if (!trackEl) return;
    trackEl.querySelectorAll('.ap-listing-photo__progress-seg').forEach((seg, i) => {
      seg.classList.toggle('is-done', i < activeIndex);
      seg.classList.toggle('is-active', i === activeIndex);
    });
  }

  const listingPhotoState = new WeakMap();
  let listingPhotoDelegationBound = false;

  function parseListingThumbs(el) {
    if (!el) return [];
    try {
      const parsed = JSON.parse(el.dataset.listingThumbs || '[]');
      if (Array.isArray(parsed) && parsed.length) return parsed.filter(Boolean);
    } catch {
      // fall through to slug lookup
    }
    const slug = el.dataset.slug || el.closest('[data-slug]')?.dataset.slug;
    const item = resolveItemBySlug(slug);
    const utils = window.HalfCutUtils;
    if (!item || !utils?.hasPhotos?.(item)) return [];
    return (item.photos || []).map((photo) => listingThumbUrl(photo, utils)).filter(Boolean);
  }

  function ensureListingPhotoState(el) {
    if (listingPhotoState.has(el)) return listingPhotoState.get(el);
    const thumbs = parseListingThumbs(el);
    if (thumbs.length <= 1) return null;
    const state = {
      thumbs,
      index: 0,
      img: el.querySelector('.ap-listing-photo__img') || el.querySelector('img'),
      track: el.querySelector('.ap-listing-photo__progress-track'),
    };
    listingPhotoState.set(el, state);
    return state;
  }

  function renderListingPhotoFrame(state) {
    if (!state) return;
    if (state.img && state.thumbs[state.index]) {
      state.img.src = state.thumbs[state.index];
    }
    updateListingProgress(state.track, state.index);
  }

  function stepListingPhoto(el, delta) {
    const state = ensureListingPhotoState(el);
    if (!state) return false;
    state.index = (state.index + delta + state.thumbs.length) % state.thumbs.length;
    renderListingPhotoFrame(state);
    return true;
  }

  function initListingPhotoEl(el) {
    const state = ensureListingPhotoState(el);
    if (!state || el.dataset.listingPhotoSwipeBound === '1') return;
    bindSwipe(el, () => stepListingPhoto(el, -1), () => stepListingPhoto(el, 1));
    el.dataset.listingPhotoSwipeBound = '1';
    renderListingPhotoFrame(state);
  }

  function bindListingPhotoCarousels(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-ap-listing-photo]').forEach(initListingPhotoEl);
  }

  function bindListingPhotoDelegation() {
    if (listingPhotoDelegationBound) return;
    listingPhotoDelegationBound = true;

    document.addEventListener('click', (event) => {
      const control = event.target.closest('[data-listing-photo-step]');
      if (!control) return;
      const el = control.closest('[data-ap-listing-photo]');
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();
      stepListingPhoto(el, Number(control.dataset.listingPhotoStep) || 0);
    }, true);
  }

  function bindCatalogPhotos() {
    if (catalogPhotoBound) return;
    catalogPhotoBound = true;

    document.addEventListener('click', (event) => {
      const button = event.target.closest('.half-cut-card__zoom');
      if (!button) return;
      event.preventDefault();
      const card = button.closest('.half-cut-card');
      if (!card) return;
      const slug = card.dataset.slug;
      const item = resolveItemBySlug(slug);
      const utils = window.HalfCutUtils;
      if (!item || !utils?.hasPhotos?.(item)) return;
      open(item.photos, 0, (photo) => utils.photoUrl(photo));
    });

    bindListingPhotoDelegation();
    bindListingPhotoCarousels();
    window.addEventListener('asiapower:layoutrefresh', () => bindListingPhotoCarousels());
  }

  window.HalfCutGalleryLightbox = {
    open,
    close,
    bindDetailGallery,
    bindPhotoViewer,
    bindCatalogPhotos,
    bindListingPhotoCarousels,
    escapeHtml,
    photoLabel,
  };

  bindCatalogPhotos();
})();
