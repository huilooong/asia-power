/**
 * AsiaPower Home 3.0 — marketplace search (Claude 3A)
 */
(function () {
  'use strict';

  if (document.body.dataset.page !== 'home') return;

  function routeSearch(raw) {
    const q = String(raw || '').trim();
    if (!q) return;
    if (window.SitePaths?.isSupplierUploadSearch?.(q)) {
      window.location.href = window.SitePaths?.supplierPortalHref?.() || 'supplier-portal.html';
      return;
    }
    const upper = q.toUpperCase();
    if (/^(HC|UV)\d/i.test(upper)) {
      window.location.href = `half-cuts/?q=${encodeURIComponent(q)}`;
      return;
    }
    if (/^(ENG|GB|CH)-/i.test(upper) || /\b[0-9][A-Z]{1,3}-[A-Z0-9]{2,}/i.test(q)) {
      window.location.href = `engines/?q=${encodeURIComponent(q)}`;
      return;
    }
    window.location.href = `half-cuts/?q=${encodeURIComponent(q)}`;
  }

  const form = document.getElementById('v3-header-search-form')
    || document.getElementById('mp-search-form')
    || document.getElementById('v3-search-form');
  const input = document.getElementById('v3-header-search-input')
    || document.getElementById('mp-search-input')
    || document.getElementById('v3-search-input');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    routeSearch(input?.value);
  });

  document.querySelectorAll('[data-v3-hot-tag], [data-mp-hot-tag]').forEach((el) => {
    el.addEventListener('click', () => {
      const tag = el.dataset.v3HotTag || el.dataset.mpHotTag || el.textContent;
      if (input) input.value = tag;
      routeSearch(tag);
    });
  });
})();
