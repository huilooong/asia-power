/**
 * AsiaPower — Relative path helpers for nested pages
 */
(function () {
  'use strict';

  function base() {
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (!segments.length) return '';
    const last = segments[segments.length - 1];
    const isPageFile = last.includes('.');
    const depth = isPageFile ? segments.length - 1 : segments.length;
    return depth ? '../'.repeat(depth) : '';
  }

  function href(path) {
    if (!path || path.startsWith('http') || path.startsWith('mailto') || path.startsWith('#')) {
      return path;
    }
    return base() + path;
  }

  function engineSlug(brandSlug, code) {
    const normalized = code.toLowerCase().replace(/[\s.]+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `${brandSlug}-${normalized}`;
  }

  function enginePagePath(brandSlug, code) {
    const slug = engineSlug(brandSlug, code);
    if (window.SEO_ENGINES && window.SEO_ENGINES[slug]) {
      return `engines/${slug}.html`;
    }
    return null;
  }

  function normalizeSearchQuery(raw) {
    return decodeURIComponent(String(raw || '').replace(/\+/g, ' ')).trim();
  }

  /** Supplier upload intent — search 「上传」 / upload → supplier portal */
  function isSupplierUploadSearch(raw) {
    const q = normalizeSearchQuery(raw).toLowerCase();
    if (!q) return false;
    const compact = q.replace(/\s+/g, '');
    const terms = [
      '上传',
      'upload',
      'supplier upload',
      'supplier portal',
      '供应商上传',
      '成为供应商',
      '供应商',
      'supplier',
    ];
    return terms.some((term) => {
      const normalized = term.toLowerCase().replace(/\s+/g, '');
      return compact === normalized || compact.includes(normalized) || q === term.toLowerCase();
    });
  }

  function supplierPortalHref() {
    return href('supplier-portal.html');
  }

  window.SitePaths = {
    base,
    href,
    engineSlug,
    enginePagePath,
    normalizeSearchQuery,
    isSupplierUploadSearch,
    supplierPortalHref,
  };

  if (!window.SiteFeedback) {
    const feedbackBase = base();
    function loadSyncScript(src) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', src, false);
        xhr.send(null);
        if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
          Function(`${xhr.responseText}\n//# sourceURL=${src}`)();
          return true;
        }
      } catch {
        // optional feedback helper
      }
      return false;
    }
    if (!window.AsiaCountryOptions) loadSyncScript(`${feedbackBase}js/country-options.js?v=1`);
    if (!window.AsiaPhone) loadSyncScript(`${feedbackBase}js/phone-utils.js?v=2`);
    loadSyncScript(`${feedbackBase}js/site-feedback.js?v=list-lead-modal-v1`);
  }

  const SITE_I18N_VER = 'site-lang-fix-v1';

  if (!window.PublicI18n || !Array.isArray(window.PublicI18n.SUPPORTED_LANGS) || window.PublicI18n.SUPPORTED_LANGS.length < 4) {
    const src = `${base()}js/public-i18n.js?v=${SITE_I18N_VER}`;
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', src, false);
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
        Function(`${xhr.responseText}\n//# sourceURL=${src}`)();
      }
    } catch {
      // public-i18n optional fallback: English-only layout
    }
  }
})();
