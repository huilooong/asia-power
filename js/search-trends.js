/**
 * AsiaPower — search popularity tracking + trending tags under header search
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'asiapower:search-counts';
  const MAX_LOCAL = 150;
  const MIN_QUERY_LEN = 2;
  const MAX_QUERY_LEN = 80;

  function normalize(raw) {
    return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LEN);
  }

  function loadLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch {
      return {};
    }
  }

  function saveLocal(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      // ignore quota errors
    }
  }

  function bumpLocal(term) {
    const key = term.toLowerCase();
    const map = loadLocal();
    if (!map[key]) map[key] = { q: term, n: 0 };
    map[key].n += 1;
    map[key].q = term;
    const keys = Object.keys(map);
    if (keys.length > MAX_LOCAL) {
      keys.sort((a, b) => (map[a].n || 0) - (map[b].n || 0));
      keys.slice(0, keys.length - MAX_LOCAL).forEach((k) => delete map[k]);
    }
    saveLocal(map);
  }

  function recordRemote(term) {
    const body = JSON.stringify({ q: term });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/search/record', new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch {
      // fall through
    }
    fetch('/api/search/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  function recordSearch(raw) {
    const term = normalize(raw);
    if (term.length < MIN_QUERY_LEN) return;
    bumpLocal(term);
    recordRemote(term);
    scheduleRender();
  }

  function recordUrlQueryOnce() {
    const q = new URLSearchParams(window.location.search).get('q');
    if (!q) return;
    const key = `asiapower:search-url-recorded:${window.location.pathname}:${q.toLowerCase()}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    recordSearch(q);
  }

  function localTrending() {
    return Object.values(loadLocal())
      .sort((a, b) => (b.n || 0) - (a.n || 0))
      .map((row) => row.q);
  }

  async function remoteTrending() {
    try {
      const res = await fetch('/api/search/trending?limit=20', { credentials: 'same-origin' });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.queries || []).map((row) => row.q || row.query).filter(Boolean);
    } catch {
      return [];
    }
  }

  function mergeTrending(remote, local) {
    const scores = new Map();
    remote.forEach((q, i) => {
      const k = q.toLowerCase();
      scores.set(k, { q, score: (remote.length - i) * 1000 });
    });
    local.forEach((q, i) => {
      const k = q.toLowerCase();
      const prev = scores.get(k);
      const localScore = (loadLocal()[k]?.n || 0) + Math.max(1, local.length - i);
      scores.set(k, { q, score: (prev?.score || 0) + localScore });
    });
    return [...scores.values()]
      .sort((a, b) => b.score - a.score)
      .map((row) => row.q);
  }

  let renderTimer = null;
  let cachedQueries = [];

  function bindTagClicks(tagsWrap) {
    tagsWrap.querySelectorAll('[data-hot]').forEach((btn) => {
      if (btn.dataset.trendBound) return;
      btn.dataset.trendBound = '1';
      btn.addEventListener('click', () => {
        const q = btn.dataset.hot || btn.textContent;
        const input = document.querySelector('[data-ebay-search] input[type="search"]');
        if (input) input.value = q;
        if (window.AsiaPowerEbayLayout?.routeSearch) {
          window.AsiaPowerEbayLayout.routeSearch(q);
        } else {
          recordSearch(q);
        }
      });
    });
  }

  function fitTags(container, queries) {
    const searchEl = document.querySelector('.ebay-header__main .ebay-search');
    const labelEl = container.querySelector('.ebay-trending__label');
    const tagsWrap = container.querySelector('[data-trending-tags]');
    if (!searchEl || !labelEl || !tagsWrap) return;

    const maxWidth = Math.floor(searchEl.getBoundingClientRect().width);
    if (maxWidth < 80) return;

    tagsWrap.innerHTML = '';
    const fitted = [];

    for (const q of queries) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.hot = q;
      btn.textContent = q;
      btn.title = q;
      tagsWrap.appendChild(btn);

      const rowWidth = labelEl.offsetWidth + tagsWrap.scrollWidth + 8;
      if (rowWidth > maxWidth) {
        btn.remove();
        break;
      }
      fitted.push(q);
    }

    container.hidden = fitted.length === 0;
    bindTagClicks(tagsWrap);
  }

  async function refreshQueries() {
    const remote = await remoteTrending();
    const local = localTrending();
    cachedQueries = mergeTrending(remote, local);
    return cachedQueries;
  }

  async function renderTrending() {
    const container = document.querySelector('.ebay-trending--header[data-trending-root]');
    if (!container) return;
    if (!cachedQueries.length) await refreshQueries();
    fitTags(container, cachedQueries);
  }

  function scheduleRender() {
    if (renderTimer) window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      renderTrending();
    }, 80);
  }

  function observeSearchWidth() {
    const searchEl = document.querySelector('.ebay-header__main .ebay-search');
    if (!searchEl || searchEl.dataset.trendObserved) return;
    searchEl.dataset.trendObserved = '1';
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => scheduleRender());
    ro.observe(searchEl);
  }

  async function init() {
    if (!document.body.classList.contains('scheme-ebay')) return;
    recordUrlQueryOnce();
    observeSearchWidth();
    await refreshQueries();
    await renderTrending();
  }

  window.addEventListener('asiapower:layoutrefresh', () => {
    observeSearchWidth();
    scheduleRender();
  });
  window.addEventListener('resize', scheduleRender, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.AsiaPowerSearchTrends = {
    recordSearch,
    refreshQueries,
    renderTrending,
  };
})();
