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

  window.SitePaths = { base, href, engineSlug, enginePagePath };

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
    loadSyncScript(`${feedbackBase}js/site-feedback.js?v=feedback-v14`);
  }

  if (!window.PublicI18n) {
    const src = `${base()}js/public-i18n.js?v=i18n-market-v1`;
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
