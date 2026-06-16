/**
 * AsiaPower — Relative path helpers for nested pages
 */
(function () {
  'use strict';

  function base() {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const depth = Math.max(0, segments.length - 1);
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
})();
