/**
 * AsiaPower PWA install — homepage / app.html
 * Native Chrome/Edge prompt when available; otherwise an actionable install sheet
 * (iOS / Android / desktop steps). Never shows a disabled dead CTA.
 */
(function () {
  'use strict';

  var STORAGE_DISMISS = 'ap_pwa_install_dismissed_until';
  var SW_URL = '/sw.js?v=pwa-app-v4';
  var CACHE_BUST = 'pwa-app-v4';
  /* CSS is also linked from HTML; ensureStyles is a safety net for app.html edge cases. */

  var deferredPrompt = null;
  var fab = null;
  var sheet = null;
  var installed = false;

  function t(zh, en) {
    var lang = (document.documentElement.lang || '').toLowerCase();
    if (lang.indexOf('zh') === 0) return zh;
    try {
      var stored = localStorage.getItem('asiapower_lang');
      if (stored && String(stored).toLowerCase().indexOf('zh') === 0) return zh;
    } catch (_) { /* ignore */ }
    return en;
  }

  function isStandalone() {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone === true) return true;
    return false;
  }

  function detectPlatform() {
    var ua = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isAndroid = /Android/i.test(ua);
    var isSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    var isChrome = /Chrome|CriOS|Edg/i.test(ua) && !/OPR|Opera/i.test(ua);
    return {
      ios: isIOS,
      android: isAndroid,
      safari: isSafari,
      chrome: isChrome,
      desktop: !isIOS && !isAndroid,
    };
  }

  function isDismissed() {
    try {
      var until = Number(localStorage.getItem(STORAGE_DISMISS) || 0);
      return until > Date.now();
    } catch (_) {
      return false;
    }
  }

  function dismissForDays(days) {
    try {
      localStorage.setItem(STORAGE_DISMISS, String(Date.now() + days * 86400000));
    } catch (_) { /* ignore */ }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.register(SW_URL).catch(function (err) {
      console.warn('[AsiaPower PWA] SW registration failed', err);
      return null;
    });
  }

  function ensureStyles() {
    if (document.querySelector('link[data-ap-pwa-css]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = (window.SitePaths && window.SitePaths.href)
      ? window.SitePaths.href('css/pwa-install.css?v=' + CACHE_BUST)
      : ('/css/pwa-install.css?v=' + CACHE_BUST);
    link.setAttribute('data-ap-pwa-css', '1');
    document.head.appendChild(link);
  }

  function stepsHtml(platform) {
    if (platform.ios) {
      return (
        '<ol class="ap-pwa-steps">' +
          '<li>' + t('用 <strong>Safari</strong> 打开本站（其它浏览器通常无法添加到主屏幕）', 'Open this site in <strong>Safari</strong> (other browsers often cannot add to Home Screen)') + '</li>' +
          '<li>' + t('点底部分享按钮 <span class="ap-pwa-glyph" aria-hidden="true">□↑</span>', 'Tap the Share button <span class="ap-pwa-glyph" aria-hidden="true">□↑</span>') + '</li>' +
          '<li>' + t('选择 <strong>添加到主屏幕</strong>，再点添加', 'Choose <strong>Add to Home Screen</strong>, then Add') + '</li>' +
        '</ol>'
      );
    }
    if (platform.android) {
      return (
        '<ol class="ap-pwa-steps">' +
          '<li>' + t('用 <strong>Chrome</strong> 打开本站', 'Open this site in <strong>Chrome</strong>') + '</li>' +
          '<li>' + t('点右上角菜单 <strong>⋮</strong>', 'Tap the menu <strong>⋮</strong>') + '</li>' +
          '<li>' + t('选择 <strong>安装应用</strong> 或 <strong>添加到主屏幕</strong>', 'Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>') + '</li>' +
        '</ol>'
      );
    }
    return (
      '<ol class="ap-pwa-steps">' +
        '<li>' + t('用 <strong>Chrome</strong> 或 <strong>Edge</strong> 打开本站', 'Open this site in <strong>Chrome</strong> or <strong>Edge</strong>') + '</li>' +
        '<li>' + t('地址栏右侧点安装图标，或打开菜单 → 安装 AsiaPower', 'Click the install icon in the address bar, or Menu → Install AsiaPower') + '</li>' +
        '<li>' + t('安装后可从桌面 / 开始菜单一键打开（全屏 APP 模式）', 'After install, open from desktop / Start menu in fullscreen app mode') + '</li>' +
      '</ol>'
    );
  }

  function buildSheet() {
    if (sheet) return sheet;
    ensureStyles();
    var platform = detectPlatform();
    sheet = document.createElement('div');
    sheet.className = 'ap-pwa-sheet';
    sheet.hidden = true;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'ap-pwa-sheet-title');
    sheet.innerHTML =
      '<div class="ap-pwa-sheet__backdrop" data-ap-pwa-close="1"></div>' +
      '<div class="ap-pwa-sheet__panel">' +
        '<button type="button" class="ap-pwa-sheet__close" data-ap-pwa-close="1" aria-label="' + t('关闭', 'Close') + '">×</button>' +
        '<div class="ap-pwa-sheet__app">' +
          '<img class="ap-pwa-sheet__icon" src="/assets/icons/icon-192.png" width="72" height="72" alt="">' +
          '<div class="ap-pwa-sheet__meta">' +
            '<h2 id="ap-pwa-sheet-title">' + t('安装 AsiaPower APP', 'Install AsiaPower App') + '</h2>' +
            '<p>' + t('添加到桌面后，请从桌面图标打开 — 无浏览器地址栏，才是 APP 模式', 'After adding to home screen, open from the icon — no browser URL bar means App mode') + '</p>' +
          '</div>' +
        '</div>' +
        '<ul class="ap-pwa-sheet__perks">' +
          '<li>' + t('一键打开，无浏览器地址栏', 'One-tap open — no browser URL bar') + '</li>' +
          '<li>' + t('底部导航：库存 / 发动机 / 询价', 'Bottom tabs: Stock / Engines / Quote') + '</li>' +
          '<li>' + t('内容始终来自 asia-power.com 最新站', 'Always uses the latest asia-power.com content') + '</li>' +
        '</ul>' +
        '<div class="ap-pwa-sheet__body" data-ap-pwa-steps>' + stepsHtml(platform) + '</div>' +
        '<div class="ap-pwa-sheet__actions">' +
          '<button type="button" class="ap-pwa-sheet__primary" data-ap-pwa-install="1">' + t('立即安装', 'Install now') + '</button>' +
          '<a class="ap-pwa-sheet__secondary" href="/app.html">' + t('查看完整安装说明', 'Full install guide') + '</a>' +
        '</div>' +
        '<p class="ap-pwa-sheet__hint" data-ap-pwa-hint></p>' +
      '</div>';
    document.body.appendChild(sheet);

    sheet.addEventListener('click', function (e) {
      var target = e.target.closest('[data-ap-pwa-close],[data-ap-pwa-install]');
      if (!target) return;
      if (target.hasAttribute('data-ap-pwa-close')) {
        closeSheet(true);
        return;
      }
      if (target.hasAttribute('data-ap-pwa-install')) {
        runInstall();
      }
    });

    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' && sheet && !sheet.hidden) closeSheet(false);
    });

    return sheet;
  }

  function syncSheetState() {
    buildSheet();
    var primary = sheet.querySelector('[data-ap-pwa-install]');
    var hint = sheet.querySelector('[data-ap-pwa-hint]');
    var steps = sheet.querySelector('[data-ap-pwa-steps]');
    var platform = detectPlatform();
    if (steps) steps.innerHTML = stepsHtml(platform);

    if (installed || isStandalone()) {
      if (primary) {
        primary.textContent = t('已安装', 'Installed');
        primary.disabled = true;
      }
      if (hint) hint.textContent = t('已在桌面 / APP 模式打开', 'Already on your home screen / running as an app');
      return;
    }

    if (deferredPrompt) {
      if (primary) {
        primary.disabled = false;
        primary.textContent = t('立即安装到桌面', 'Install to desktop');
      }
      if (hint) hint.textContent = t('将弹出系统安装窗口，确认即可', 'Your browser will show the system install dialog');
      return;
    }

    if (primary) {
      primary.disabled = false;
      primary.textContent = platform.ios
        ? t('查看 iPhone 安装步骤', 'Show iPhone steps')
        : t('按下面步骤安装', 'Follow the steps below');
    }
    if (hint) {
      hint.textContent = platform.ios
        ? t('iPhone 需用 Safari 手动添加（系统限制，不是网站故障）', 'iPhone requires Safari Add to Home Screen (system limit, not a site bug)')
        : t('若没有系统弹窗，请按上方步骤用浏览器菜单安装', 'If no system dialog appears, use the browser menu steps above');
    }
  }

  function openSheet() {
    if (isStandalone()) return;
    syncSheetState();
    sheet.hidden = false;
    document.body.classList.add('ap-pwa-sheet-open');
    var primary = sheet.querySelector('[data-ap-pwa-install]');
    if (primary) primary.focus();
  }

  function closeSheet(remember) {
    if (!sheet) return;
    sheet.hidden = true;
    document.body.classList.remove('ap-pwa-sheet-open');
    if (remember) dismissForDays(7);
    updateFab();
  }

  function runInstall() {
    if (deferredPrompt) {
      var promptEvent = deferredPrompt;
      deferredPrompt = null;
      promptEvent.prompt();
      Promise.resolve(promptEvent.userChoice).then(function (choice) {
        if (choice && choice.outcome === 'accepted') {
          installed = true;
          setFabInstalled();
          closeSheet(false);
          return;
        }
        syncSheetState();
        updateFab();
      }).catch(function () {
        syncSheetState();
      });
      return;
    }
    // No native prompt: keep sheet open with steps (already visible). Scroll steps into view.
    var steps = sheet && sheet.querySelector('[data-ap-pwa-steps]');
    if (steps) steps.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function createFab() {
    if (fab) return fab;
    ensureStyles();
    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'ap-pwa-fab';
    fab.innerHTML =
      '<span class="ap-pwa-fab__icon" aria-hidden="true">' +
        '<img src="/assets/icons/icon-192.png" width="28" height="28" alt="">' +
      '</span>' +
      '<span class="ap-pwa-fab__text">' +
        '<strong data-ap-pwa-fab-title>' + t('安装 APP', 'Get the App') + '</strong>' +
        '<small data-ap-pwa-fab-sub>' + t('添加到桌面', 'Add to home screen') + '</small>' +
      '</span>';
    fab.setAttribute('aria-label', t('安装 AsiaPower APP 到桌面', 'Install AsiaPower app to home screen'));
    fab.hidden = true;
    document.body.appendChild(fab);
    fab.addEventListener('click', function () {
      openSheet();
    });
    return fab;
  }

  function setFabInstalled() {
    createFab();
    var title = fab.querySelector('[data-ap-pwa-fab-title]');
    var sub = fab.querySelector('[data-ap-pwa-fab-sub]');
    if (title) title.textContent = t('已安装', 'Installed');
    if (sub) sub.textContent = t('可从桌面打开', 'Open from home screen');
    fab.classList.add('ap-pwa-fab--done');
    fab.hidden = false;
    window.setTimeout(function () {
      if (fab) fab.hidden = true;
    }, 4000);
  }

  function updateFab() {
    if (isStandalone()) {
      if (fab) fab.hidden = true;
      return;
    }
    createFab();
    if (installed) {
      setFabInstalled();
      return;
    }
    if (isDismissed() && !deferredPrompt) {
      fab.hidden = true;
      return;
    }
    var title = fab.querySelector('[data-ap-pwa-fab-title]');
    var sub = fab.querySelector('[data-ap-pwa-fab-sub]');
    if (deferredPrompt) {
      if (title) title.textContent = t('安装 APP', 'Get the App');
      if (sub) sub.textContent = t('一键添加到桌面', 'One-tap install');
      fab.classList.add('ap-pwa-fab--ready');
    } else {
      if (title) title.textContent = t('添加到桌面', 'Add to desktop');
      if (sub) sub.textContent = t('像 APP 一样打开', 'Open like an app');
      fab.classList.remove('ap-pwa-fab--ready');
    }
    fab.hidden = false;
    fab.disabled = false;
  }

  function onBeforeInstallPrompt(event) {
    event.preventDefault();
    deferredPrompt = event;
    updateFab();
    syncSheetState();
  }

  function onAppInstalled() {
    installed = true;
    deferredPrompt = null;
    setFabInstalled();
    if (sheet && !sheet.hidden) closeSheet(false);
  }

  function boot() {
    if (isStandalone()) return;
    registerServiceWorker();
    createFab();
    updateFab();
    // Show FAB quickly; sheet explains when native prompt is missing.
    window.setTimeout(updateFab, 800);
  }

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.addEventListener('appinstalled', onAppInstalled);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Test / debug hooks
  window.AsiaPowerPwaInstall = {
    isStandalone: isStandalone,
    detectPlatform: detectPlatform,
    openSheet: openSheet,
    closeSheet: closeSheet,
    updateFab: updateFab,
    getDeferredPrompt: function () { return deferredPrompt; },
    _test: {
      STORAGE_DISMISS: STORAGE_DISMISS,
      stepsHtml: stepsHtml,
      syncSheetState: syncSheetState,
      runInstall: runInstall,
    },
  };
})();
