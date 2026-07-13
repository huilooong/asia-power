/**
 * AsiaPower — standalone PWA app shell
 * When opened from the home-screen icon (no browser chrome), apply an app-like
 * top bar + bottom tabs and hide marketing website chrome.
 *
 * P0 2026-07-13: SHELL_ENABLED=false — display-mode:fullscreen (and some clients)
 * falsely activated the shell inside a normal browser tab and wrecked the homepage.
 * Re-enable only after CEO approval + standalone-only detection.
 */
(function () {
  'use strict';

  var CACHE = 'pwa-app-v4';
  var TABBAR_ID = 'ap-app-tabbar';
  var TOPBAR_ID = 'ap-app-topbar';
  /** Kill switch — must stay false until standalone detection is proven safe. */
  var SHELL_ENABLED = false;

  function isStandalone() {
    if (!SHELL_ENABLED) return false;
    try {
      var q = new URLSearchParams(window.location.search);
      // Explicit opt-out always wins
      if (q.get('app') === '0' || q.get('noshell') === '1') return false;
      // Preview only with ?app=1 — never treat source=pwa as shell
      if (q.get('app') === '1') return true;
      // Real installed-app modes only. Do NOT use display-mode:fullscreen
      // (F11 / some WebViews falsely match and poison the marketing site).
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.navigator.standalone === true) return true;
    } catch (_) { /* ignore */ }
    return false;
  }

  function stripShell() {
    try {
      document.documentElement.classList.remove('ap-app');
      if (document.body) {
        document.body.classList.remove('ap-app-shell');
        document.body.classList.remove('ap-pwa-sheet-open');
      }
      var top = document.getElementById(TOPBAR_ID);
      if (top) top.remove();
      var tab = document.getElementById(TABBAR_ID);
      if (tab) tab.remove();
      document.querySelectorAll('.ap-app-topbar, .ap-app-tabbar').forEach(function (el) {
        el.remove();
      });
    } catch (_) { /* ignore */ }
  }

  function t(zh, en) {
    var lang = (document.documentElement.lang || '').toLowerCase();
    if (lang.indexOf('zh') === 0) return zh;
    try {
      var stored = localStorage.getItem('asiapower_lang');
      if (stored && String(stored).toLowerCase().indexOf('zh') === 0) return zh;
    } catch (_) { /* ignore */ }
    return en;
  }

  function ensureCss() {
    if (document.querySelector('link[data-ap-app-shell-css]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = (window.SitePaths && window.SitePaths.href)
      ? window.SitePaths.href('css/pwa-app-shell.css?v=' + CACHE)
      : ('/css/pwa-app-shell.css?v=' + CACHE);
    link.setAttribute('data-ap-app-shell-css', '1');
    document.head.appendChild(link);
  }

  function path() {
    return (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  }

  function activeTab() {
    var p = path();
    var page = document.body && document.body.dataset ? document.body.dataset.page : '';
    if (p === '/' || p.endsWith('/index.html') || page === 'home') return 'home';
    if (p.indexOf('/engines') !== -1 || page === 'engines') return 'engines';
    if (p.indexOf('/trucks') !== -1 || page === 'trucks') return 'trucks';
    if (p.indexOf('/half-cuts') !== -1 || page === 'halfcuts') return 'stock';
    if (p.indexOf('/machinery') !== -1 || page === 'machinery') return 'stock';
    if (p.indexOf('/contact') !== -1 || page === 'contact') return 'quote';
    return 'stock';
  }

  function icon(name) {
    var icons = {
      home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11.5L12 4l9 7.5"/><path d="M6 10.5V20h12v-9.5"/></svg>',
      stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>',
      engines: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>',
      trucks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7V10z"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>',
      quote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z"/></svg>',
    };
    return icons[name] || icons.home;
  }

  function waUrl() {
    var cfg = window.ASIAPOWER || {};
    var phone = String(cfg.whatsapp || '8616638801930').replace(/\D/g, '');
    var msg = encodeURIComponent(cfg.whatsappMessage || 'Hello AsiaPower, I need a quote.');
    return 'https://wa.me/' + phone + '?text=' + msg;
  }

  function renderTopbar() {
    var existing = document.getElementById(TOPBAR_ID);
    if (existing) existing.remove();
    var bar = document.createElement('header');
    bar.id = TOPBAR_ID;
    bar.className = 'ap-app-topbar';
    bar.innerHTML =
      '<div class="ap-app-topbar__inner">' +
        '<a class="ap-app-topbar__brand" href="/">' +
          '<img src="/assets/icons/icon-192.png" width="28" height="28" alt="">' +
          '<span>AsiaPower</span>' +
        '</a>' +
        '<form class="ap-app-topbar__search" action="/half-cuts/" method="get" role="search">' +
          '<input type="search" name="q" placeholder="' + t('搜库存 / 发动机号', 'Search stock / engine') + '" aria-label="Search">' +
        '</form>' +
      '</div>';
    document.body.prepend(bar);
  }

  function renderTabbar() {
    document.querySelectorAll('.app-bottom-nav, #' + TABBAR_ID).forEach(function (n) { n.remove(); });
    var current = activeTab();
    var tabs = [
      { id: 'home', href: '/', label: t('首页', 'Home'), icon: 'home' },
      { id: 'stock', href: '/half-cuts/', label: t('库存', 'Stock'), icon: 'stock' },
      { id: 'engines', href: '/engines/', label: t('发动机', 'Engines'), icon: 'engines' },
      { id: 'trucks', href: '/trucks/', label: t('卡车', 'Trucks'), icon: 'trucks' },
      { id: 'quote', href: waUrl(), label: t('询价', 'Quote'), icon: 'quote', external: true },
    ];
    var nav = document.createElement('nav');
    nav.id = TABBAR_ID;
    nav.className = 'ap-app-tabbar';
    nav.setAttribute('aria-label', t('APP 导航', 'App navigation'));
    nav.innerHTML = tabs.map(function (tab) {
      var active = tab.id === current ? ' is-active' : '';
      var rel = tab.external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return (
        '<a class="ap-app-tabbar__item' + active + '" href="' + tab.href + '"' + rel + '>' +
          '<span class="ap-app-tabbar__icon" aria-hidden="true">' + icon(tab.icon) + '</span>' +
          '<span class="ap-app-tabbar__label">' + tab.label + '</span>' +
        '</a>'
      );
    }).join('');
    document.body.appendChild(nav);
  }

  function applyShell() {
    if (!isStandalone()) {
      stripShell();
      return false;
    }
    ensureCss();
    document.documentElement.classList.add('ap-app');
    document.body.classList.add('ap-app-shell');
    document.body.classList.remove('ap-pwa-sheet-open');
    renderTopbar();
    renderTabbar();
    document.querySelectorAll('.ap-pwa-fab, .ap-pwa-sheet').forEach(function (el) {
      el.hidden = true;
    });
    return true;
  }

  function boot() {
    if (!SHELL_ENABLED) {
      stripShell();
      return;
    }
    if (!applyShell()) return;
    window.addEventListener('asiapower:langchange', function () {
      renderTopbar();
      renderTabbar();
    });
    window.addEventListener('asiapower:layoutrefresh', function () {
      if (isStandalone()) renderTabbar();
      else stripShell();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.AsiaPowerAppShell = {
    isStandalone: isStandalone,
    applyShell: applyShell,
    stripShell: stripShell,
    enabled: function () { return SHELL_ENABLED; },
    activeTab: activeTab,
  };
})();
