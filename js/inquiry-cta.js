/**
 * AsiaPower — Prominent inquiry / WhatsApp CTA for catalog & product pages
 */
(function () {
  'use strict';

  const WA_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.884 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

  function t(key, fallback) {
    return window.PublicI18n?.t(key, fallback) ?? fallback;
  }

  function base() {
    return window.SitePaths?.base?.() || '../';
  }

  function config() {
    return window.ASIAPOWER || {};
  }

  function pageContext() {
    const page = document.body?.dataset?.page || '';
    const engine = document.body?.dataset?.engine || '';
    const title = document.querySelector('h1')?.textContent?.trim() || '';
    const path = window.location.pathname || '';
    let product = title;
    let category = 'powertrain';

    if (page === 'engines' || /\/engines\/?$/.test(path)) {
      category = 'engines catalog';
    } else if (page === 'halfcuts' || /\/half-cuts\/?$/.test(path)) {
      category = 'half-cuts catalog';
    } else if (page === 'engine-detail' || page === 'engine-growth' || /\/engines\/.+\.html/.test(path)) {
      category = 'engine';
      product = engine || title.replace(/\s*Engine\s*$/i, '').trim() || title;
    } else if (page === 'halfcut-detail' || /\/half-cuts\/detail/.test(path)) {
      category = 'half-cut';
    }

    return { page, product, category, title };
  }

  function resolveHalfCutItem() {
    const slug = new URLSearchParams(window.location.search).get('slug')
      || new URLSearchParams(window.location.search).get('stockId');
    if (!slug) return null;
    return window.getHalfCutBySlug?.(slug)
      || window.HalfCutInventoryStore?.getPublicItemBySlug?.(slug)
      || null;
  }

  function whatsappMessage(ctx) {
    const c = config();
    const product = ctx?.product || '';
    const category = ctx?.category || 'powertrain';
    if (category === 'half-cut') {
      const item = resolveHalfCutItem();
      if (item && window.HalfCutUtils?.whatsappMessage) {
        return window.HalfCutUtils.whatsappMessage(item);
      }
    }
    if (product && category !== 'engines catalog' && category !== 'half-cuts catalog') {
      return `Hello AsiaPower, I would like a quote for ${product}. Page: ${window.location.href}`;
    }
    if (category === 'half-cuts catalog') {
      return c.whatsappMessage || 'Hello AsiaPower, I would like to enquire about half-cut inventory for export.';
    }
    return c.whatsappMessage || 'Hello AsiaPower, I would like to enquire about powertrain sourcing for export.';
  }

  function whatsappPhone() {
    const c = config();
    return String(c.chinaWhatsapp || '8616638801930').replace(/\D/g, '');
  }

  function whatsappUrl(ctx) {
    const phone = whatsappPhone();
    return `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage(ctx))}`;
  }

  function contactUrl(ctx) {
    const b = base();
    const params = new URLSearchParams();
    const product = ctx?.product || '';
    if (product && ctx?.category !== 'engines catalog' && ctx?.category !== 'half-cuts catalog') {
      params.set('product', product);
    }
    if (ctx?.category === 'engine') params.set('type', 'engine');
    if (ctx?.category === 'half-cut') params.set('type', 'half-cut');
    const qs = params.toString();
    return `${b}contact.html${qs ? `?${qs}` : ''}`;
  }

  function render(options) {
    const ctx = { ...pageContext(), ...(options?.context || {}) };
    const variant = options?.variant || 'default';
    const waUrl = whatsappUrl(ctx);
    const waLabel = t('inquiryCta.whatsapp', 'WhatsApp Us for Price');

    const className = ['inquiry-cta-banner', variant !== 'default' ? `inquiry-cta-banner--${variant}` : '']
      .filter(Boolean)
      .join(' ');

    return `<div class="${className}" role="region" aria-label="${waLabel}">
      <a href="${waUrl}" class="inquiry-cta-banner__btn inquiry-cta-banner__btn--whatsapp" target="_blank" rel="noopener noreferrer">${WA_ICON}<span>${waLabel}</span></a>
    </div>`;
  }

  function injectAfter(el, options) {
    if (!el || el.closest('.inquiry-cta-banner') || el.parentElement?.querySelector('.inquiry-cta-banner')) return false;
    el.insertAdjacentHTML('afterend', render(options));
    return true;
  }

  function injectIntoCatalogRoot(rootId, options) {
    const root = document.getElementById(rootId);
    if (!root || root.querySelector('.inquiry-cta-banner')) return false;
    root.insertAdjacentHTML('afterbegin', render(options));
    return true;
  }

  function initPage() {
    const page = document.body?.dataset?.page || '';
    if (page === 'engine-detail' || page === 'halfcut-detail') return;

    if (document.querySelector('.inquiry-cta-banner')) return;

    const heroH1 = document.querySelector('.page-hero h1, .engine-hero h1, .v2-hero h1');
    if (heroH1) {
      const variant = heroH1.closest('.engine-hero') || heroH1.closest('.v2-hero')
        ? 'engine-hero'
        : 'catalog-hero';
      injectAfter(heroH1, { variant });
    }
  }

  window.InquiryCta = {
    render,
    injectAfter,
    injectIntoCatalogRoot,
    initPage,
    whatsappUrl,
    contactUrl,
    pageContext,
  };
})();
