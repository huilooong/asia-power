/**
 * AsiaPower — Shared Layout Components
 */
(function () {
  'use strict';

  // Must bump when ebay-layout.css changes — injectEbayStylesheet rewrites all pages to this query.
  // Stale CDN entries for old ?v= keys (e.g. v4-listing-card-v1) can keep serving 66px parts thumbs.
  const SITE_EBAY_LAYOUT_VER = 'mnav-drawer-v3';
  const SITE_COMPONENTS_VER = 'parts-photo-contain-v1';
  // Deploy markers (keep strings discoverable): auth-nav-v1 · auth-nav-once-v2 · auth-nav-sitewide-v1 · login-entry-v1 · lang-sync-v2 · contact-center-v1 · about-type-v2 · list-photo-uniform-v1 · list-photo-uniform-v2 · list-photo-uniform-v2b · parts-photo-v2 · integrity-audit-v1 · parts-placeholder-v1 · parts-parallel-v1 · stock-id-search-v1 · dedicated-price-v1 · catalog-search-v1
  // login-entry-v1 = catalog footer Sign in + clearer toolbar login pill; buyer dial codes expanded (local WIP, not deployed)
  // list-photo-uniform-v1 = half-cut list photo frames fixed 4:3 + cover
  // list-photo-uniform-v2 / v2b = parts catalogs same uniform frames (v2b: align-self start so height ignores text row)

  // dedicated-price-v1 = dedicated part listings use full priceUsd (not half-cut PART_PRICE_RATIOS)
  // auth-nav-sitewide-v1 = full public topbar audit (about/contact/countries/brands/engines SEO), not only home+catalog
  // lang-sync-v2 = sitewide lang switcher matches homepage (text + separators; CF cache-bust)
  // about-type-v2 = about color/letter-spacing/line-height/weight aligned to catalog-v4 (#1d1d1f/#6e6e73/#86868b); replaces about-type-v1
  // parts-parallel-v1 = rule-based half-cut rows + dedicated uploads coexist on parts catalogs
  // stock-id-search-v1 = HC/UV stock ID + numeric suffix search spans all catalog categories
  // catalog-search-v1 = model/engine/VIN/CN aliases + cross-category merge from header search
  const SITE_AUTH_NAV_VER = 'auth-nav-sitewide-v1';
  const SITE_PARTS_PHOTO_VER = 'parts-photo-v2';
  const SITE_PARTS_PLACEHOLDER_VER = 'parts-placeholder-v1';
  const SITE_PARTS_PARALLEL_VER = 'parts-parallel-v1';
  const SITE_STOCK_ID_SEARCH_VER = 'stock-id-search-v1';
  const SITE_CATALOG_SEARCH_VER = 'catalog-search-v1';

  window.AsiaPowerSiteAssets = {
    ebayLayoutVer: SITE_EBAY_LAYOUT_VER,
    componentsVer: SITE_COMPONENTS_VER,
  };

  function siteBase() {
    if (window.SitePaths) return window.SitePaths.base();
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
    return siteBase() + path;
  }

  function currentPageId() {
    const page = document.body.dataset.page;
    if (page) {
      if (page.startsWith('brand-')) return 'halfcuts';
      if (page.startsWith('engine-')) return '';
      if (page === 'truckheads') return 'trucks';
      if (page === 'halfcuts') return 'halfcuts';
      return page;
    }
    const file = window.location.pathname.split('/').pop() || 'index.html';
    const map = {
      'index.html': 'home',
      'brands.html': 'brands',
      'supplier-portal.html': 'supplier',
      'about.html': 'about',
      'contact.html': 'contact',
    };
    return map[file] || '';
  }

  function iconSvg(name) {
    const icons = {
      phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
      mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
      pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
      whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.884 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
    };
    return icons[name] || '';
  }

  function getConfig() {
    return window.ASIAPOWER || (typeof ASIAPOWER !== 'undefined' ? ASIAPOWER : null);
  }

  function i18n() {
    return window.PublicI18n;
  }

  function t(key, fallback) {
    const pub = i18n();
    return pub ? pub.t(key, fallback) : fallback;
  }

  function navLabel(item) {
    const pub = i18n();
    return pub ? pub.translateNavLabel(item) : item.label;
  }

  function renderSkipLink() {
    return `<a class="skip-link" href="#main-content">${t('skipLink', 'Skip to main content')}</a>`;
  }

  /** Admin / supplier upload tools — not public marketing pages. */
  function isInternalToolPage() {
    const page = document.body?.dataset?.page || '';
    if (
      page === 'supplier-upload'
      || page === 'admin-review'
      || page === 'admin-inventory'
      || page === 'admin-leads'
      || page === 'admin-analytics'
      || page === 'admin-apsales-progress'
      || page === 'admin-apsales-zijing'
    ) {
      return true;
    }
    const path = window.location.pathname;
    return path.includes('/admin/') || path.includes('/supplier-portal/half-cut-upload') || path.includes('/supplier-portal/truck-upload') || path.includes('/supplier-portal/truck-vehicle-upload') || path.includes('/supplier-portal/passenger-parts-upload');
  }

  function renderTopBar() {
    if (!document.body.classList.contains('page-home-v4')) return '';
    const c = getConfig();
    if (!c) return '';
    const pub = i18n();
    const switcher = pub ? pub.renderLangSwitcher() : '';
    return `
      <div class="ap-topbar">
        <div class="ap-topbar__inner j-wrap">
          <span class="ap-topbar__tagline">Where Used Becomes Useful Again · 110+ Countries · EXW Zhengzhou</span>
          <div class="ap-topbar__right">
            ${switcher}
            ${typeof window.QuoteList !== 'undefined' ? window.QuoteList.badgeHtml('ap-quote-badge--topbar') : `<a class="ap-quote-badge ap-quote-badge--topbar" href="${href('quote-list.html')}" data-quote-list-badge aria-label="Quote list"><span class="ap-quote-badge__label">List</span><span class="ap-quote-badge__count" data-quote-count hidden>0</span></a>`}
            <a href="contact.html" class="ap-topbar__link">Contact</a>
            ${renderLoginEntry({ variant: 'topbar' })}
            <a href="supplier-portal.html" class="ap-topbar__link">Supplier Portal</a>
          </div>
        </div>
      </div>`;
  }

  function logoImg(className, attrs, variant) {
    const c = getConfig();
    if (!c) return '';
    const extra = attrs || '';
    const isFooter = variant === 'footer';
    const logo = isFooter && c.logoFooter ? c.logoFooter : c.logo;
    const srcSetRaw = isFooter && c.logoFooterSrcSet ? c.logoFooterSrcSet : c.logoSrcSet;
    const srcset = srcSetRaw
      ? srcSetRaw.split(',').map(part => {
          const [file, width] = part.trim().split(/\s+/);
          return `${href(file)} ${width || ''}`.trim();
        }).join(', ')
      : '';
    const sizesRaw = isFooter && c.footerLogoSizes ? c.footerLogoSizes : c.logoSizes;
    const sizes = sizesRaw ? ` sizes="${sizesRaw}"` : '';
    const srcsetAttr = srcset ? ` srcset="${srcset}"${sizes}` : '';
    const width = isFooter && c.logoFooterWidth ? c.logoFooterWidth : 320;
    const height = isFooter && c.logoFooterHeight ? c.logoFooterHeight : 39;
    return `<img src="${href(logo)}"${srcsetAttr} alt="AsiaPower" class="${className}" width="${width}" height="${height}" decoding="async"${extra}>`;
  }

  function isHomeV3() {
    return document.body.classList.contains('page-home-v3') && !document.body.classList.contains('scheme-ebay');
  }

  function useEbayLayout() {
    if (isInternalToolPage()) return false;
    // v4 hybrid homepage owns its own nav/footer — do not inject eBay chrome
    if (document.body.classList.contains('page-home-v4-hybrid')
      || document.body.classList.contains('page-home-v4')) {
      return false;
    }
    const page = document.body.dataset.page || '';
    if (page === 'app') return false;
    const path = window.location.pathname || '';
    if (path.includes('/pages/') || path.endsWith('/offline.html') || path.endsWith('offline.html')) return false;
    return true;
  }

  function injectEbayStylesheet() {
    const ver = SITE_EBAY_LAYOUT_VER;
    const cssHref = href(`css/ebay-layout.css?v=${ver}`);
    const existing = document.querySelector('link[data-ebay-layout], link[href*="ebay-layout.css"]');
    if (existing) {
      if (!existing.href.includes(`v=${ver}`)) {
        existing.href = cssHref;
      }
      existing.setAttribute('data-ebay-layout', '1');
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    link.setAttribute('data-ebay-layout', '1');
    document.head.appendChild(link);
  }

  function textLogo(className) {
    return `<a class="${className}" href="${href('index.html')}" aria-label="AsiaPower Home">Asia<span>Power</span></a>`;
  }

  function injectEbayCategoriesScript(onReady) {
    if (window.EBAY_CATALOG_SIDEBAR) {
      onReady?.();
      return;
    }
    if (document.querySelector('script[data-ebay-categories-js]')) {
      document.querySelector('script[data-ebay-categories-js]')?.addEventListener('load', () => onReady?.(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = href('js/ebay-categories.js?v=site-consistency-v2');
    script.setAttribute('data-ebay-categories-js', '1');
    script.onload = () => onReady?.();
    script.onerror = () => onReady?.();
    document.head.appendChild(script);
  }

  function injectCatalogGalleryScript() {
    if (window.HalfCutGalleryLightbox || document.querySelector('script[data-catalog-gallery-js]')) return;
    const script = document.createElement('script');
    script.src = href('js/half-cut-gallery-lightbox.js?v=gallery-v6');
    script.setAttribute('data-catalog-gallery-js', '1');
    document.body.appendChild(script);
  }

  function injectEbayScript() {
    if (document.querySelector('script[data-ebay-layout-js]')) return;
    injectEbayCategoriesScript(() => {
      const script = document.createElement('script');
      script.src = href(`js/ebay-layout.js?v=${SITE_EBAY_LAYOUT_VER}`);
      script.defer = true;
      script.setAttribute('data-ebay-layout-js', '1');
      script.onload = () => {
        window.AsiaPowerEbayLayout?.applyShell?.();
        window.dispatchEvent(new CustomEvent('asiapower:layoutrefresh'));
      };
      document.body.appendChild(script);
    });
  }

  function injectSearchTrendsScript() {
    if (document.querySelector('script[data-search-trends-js]')) return;
    const script = document.createElement('script');
    script.src = href('js/search-trends.js?v=1');
    script.defer = true;
    script.setAttribute('data-search-trends-js', '1');
    script.onload = () => {
      window.AsiaPowerSearchTrends?.renderTrending?.();
    };
    document.body.appendChild(script);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function maskPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    let local = digits;
    if (local.length > 11 && local.startsWith('86')) local = local.slice(2);
    if (local.length >= 7) return `${local.slice(0, 3)}****${local.slice(-4)}`;
    if (local.length >= 4) return `${local.slice(0, 2)}****${local.slice(-2)}`;
    return local;
  }

  /** Prefer displayName / name; else masked phone. Never leave "Sign in" when session exists. */
  function displayNameFromUser(user) {
    if (!user) return '';
    const candidates = [
      user.displayName,
      user.name,
      user.contactPerson,
      user.supplierName,
      user.company,
    ];
    for (const raw of candidates) {
      const name = String(raw || '').trim();
      if (!name) continue;
      if (/^Buyer\s/i.test(name)) continue;
      if (/^p\d{8,}$/i.test(name)) continue;
      return name;
    }
    const masked = maskPhone(user.phoneNormalized || user.phone);
    if (masked) return masked;
    const email = String(user.email || '').trim();
    if (email.includes('@')) return email.split('@')[0];
    const username = String(user.username || '').trim();
    if (username && !/^p\d{8,}$/i.test(username)) return username;
    return t('nav.account', 'Account');
  }

  function portalHrefForUser(user) {
    if (!user) return href('login/');
    if (user.role === 'admin') return '/admin/inventory.html';
    if (user.role === 'supplier') return '/supplier-portal/dashboard.html';
    return '/buyer-portal/';
  }

  function renderSignedOutLink(opts = {}) {
    const compact = Boolean(opts.compact);
    const variant = opts.variant || '';
    const label = t('nav.signIn', 'Sign in');
    if (variant === 'home' || variant === 'topbar') {
      return `<a href="${href('login/')}" class="${variant === 'home' ? 'nav-signin' : 'ap-topbar__link'}" data-i18n="nav.signIn">${label}</a>`;
    }
    if (variant === 'portal') {
      return `<a href="/login/" data-i18n="nav.signIn">${label}</a>`;
    }
    const className = compact ? 'ebay-toolbar__login' : 'ap-login-btn';
    return `<a class="${className}" href="${href('login/')}" data-i18n="nav.signIn">${label}</a>`;
  }

  function renderLoggedInMenu(user, opts = {}) {
    const compact = Boolean(opts.compact);
    const variant = opts.variant || '';
    const label = escapeHtml(displayNameFromUser(user));
    const portal = portalHrefForUser(user);
    const dash = t('nav.dashboard', 'Workspace');
    const logout = t('nav.logout', 'Sign out');
    let toggleClass = compact ? 'ebay-toolbar__login ap-account__toggle' : 'ap-login-btn ap-login-btn--account ap-account__toggle';
    if (variant === 'home') toggleClass = 'nav-signin ap-account__toggle';
    if (variant === 'topbar') toggleClass = 'ap-topbar__link ap-account__toggle';
    if (variant === 'portal') toggleClass = 'ap-account__toggle ap-account__toggle--portal';
    return `
      <div class="ap-account${compact ? ' ap-account--compact' : ''}${variant ? ` ap-account--${variant}` : ''}" data-ap-account>
        <button type="button" class="${toggleClass}" aria-expanded="false" aria-haspopup="true">
          <span class="ap-account__name">${label}</span>
          <span class="ap-account__caret" aria-hidden="true">▾</span>
        </button>
        <div class="ap-account__menu" hidden role="menu">
          <a href="${portal}" role="menuitem">${escapeHtml(dash)}</a>
          <button type="button" data-ap-logout role="menuitem">${escapeHtml(logout)}</button>
        </div>
      </div>`;
  }

  function renderLoginEntry(opts = {}) {
    const compact = Boolean(opts.compact);
    const variant = opts.variant || '';
    return `<span class="ap-auth-slot" data-ap-auth-slot data-compact="${compact ? '1' : '0'}" data-variant="${escapeHtml(variant)}">${renderSignedOutLink(opts)}</span>`;
  }

  let authMePromise = null;
  function fetchAuthMe() {
    if (!authMePromise) {
      authMePromise = fetch('/api/me', { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => data?.user || null)
        .catch(() => null);
    }
    return authMePromise;
  }

  function bindAccountMenus(root = document) {
    root.querySelectorAll('[data-ap-account]').forEach((wrap) => {
      if (wrap.dataset.bound === '1') return;
      wrap.dataset.bound = '1';
      const toggle = wrap.querySelector('.ap-account__toggle');
      const menu = wrap.querySelector('.ap-account__menu');
      if (!toggle || !menu) return;
      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const open = menu.hasAttribute('hidden');
        document.querySelectorAll('[data-ap-account] .ap-account__menu').forEach((el) => {
          el.setAttribute('hidden', '');
          el.closest('[data-ap-account]')?.querySelector('.ap-account__toggle')?.setAttribute('aria-expanded', 'false');
        });
        if (open) {
          menu.removeAttribute('hidden');
          toggle.setAttribute('aria-expanded', 'true');
        }
      });
      wrap.querySelector('[data-ap-logout]')?.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
          await fetch('/api/logout', { method: 'POST', credentials: 'include' });
        } catch (_) { /* ignore */ }
        authMePromise = null;
        window.location.reload();
      });
    });
  }

  if (!window.__apAccountDocClick) {
    window.__apAccountDocClick = true;
    document.addEventListener('click', () => {
      document.querySelectorAll('[data-ap-account] .ap-account__menu').forEach((el) => {
        el.setAttribute('hidden', '');
        el.closest('[data-ap-account]')?.querySelector('.ap-account__toggle')?.setAttribute('aria-expanded', 'false');
      });
    });
  }

  async function hydrateAuthSlots(root = document) {
    const slots = root.querySelectorAll('[data-ap-auth-slot]');
    if (!slots.length) return;
    const user = await fetchAuthMe();
    slots.forEach((slot) => {
      const compact = slot.getAttribute('data-compact') === '1';
      const variant = slot.getAttribute('data-variant') || '';
      slot.innerHTML = user
        ? renderLoggedInMenu(user, { compact, variant })
        : renderSignedOutLink({ compact, variant });
    });
    bindAccountMenus(root);
    const pub = i18n();
    if (pub) pub.applyDataI18n(root === document ? document.body : root);
  }

  window.AsiaPowerAuthNav = {
    hydrate: hydrateAuthSlots,
    displayNameFromUser,
    maskPhone,
  };

  function renderEbayToolbar() {
    const pub = i18n();
    const switcher = pub ? pub.renderLangSwitcher() : '';
    return `
      <div class="ebay-toolbar" id="ebay-nav-drawer" data-mnav-drawer>
        <div class="ebay-toolbar__inner">
          <p class="ebay-toolbar__promo" data-i18n="ebay.promoBar">Every Used Asset Has Value</p>
          <div class="ebay-toolbar__right">
            ${typeof window.QuoteList !== 'undefined' ? window.QuoteList.badgeHtml('ap-quote-badge--ebay') : `<a class="ap-quote-badge ap-quote-badge--ebay" href="${href('quote-list.html')}" data-quote-list-badge aria-label="Quote list"><span class="ap-quote-badge__label">List</span><span class="ap-quote-badge__count" data-quote-count hidden>0</span></a>`}
            ${switcher ? `<div class="ebay-toolbar__lang">${switcher}</div>` : ''}
            ${renderLoginEntry({ compact: true })}
          </div>
        </div>
      </div>`;
  }

  function renderEbayPromo() {
    return renderEbayToolbar();
  }

  function renderEbayHeader() {
    return `
      <header class="ebay-header">
        ${renderEbayToolbar()}
        <div class="ebay-header__inner">
          <div class="ebay-header__row">
            <button type="button" class="mnav-toggle ebay-header__toggle" data-mnav-toggle aria-label="Open menu" aria-expanded="false" aria-controls="ebay-nav-drawer"><span></span><span></span><span></span></button>
            ${textLogo('ebay-header__logo ap-logo')}
            <div class="ebay-header__main">
              <form class="ebay-search" data-ebay-search role="search">
                <input type="search" placeholder="Search half-cuts, engines, HC250160, 2AZ-FE…" aria-label="Search" data-i18n-placeholder="ebay.searchPlaceholder">
                <button type="submit" class="ebay-search__btn" data-i18n-aria="ebay.searchBtn" aria-label="Search">
                  <span class="ebay-search__btn-text" data-i18n="ebay.searchBtn">Search</span>
                  <svg class="ebay-search__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </button>
              </form>
              <div class="ebay-trending ebay-trending--header" data-trending-root aria-label="Popular searches" hidden>
                <span class="ebay-trending__label" data-i18n="ebay.popular">Popular:</span>
                <span class="ebay-trending__tags" data-trending-tags></span>
              </div>
            </div>
          </div>
        </div>
      </header>`;
  }

  function renderAdminHeader() {
    const page = document.body?.dataset?.page || '';
    const links = [
      { href: 'admin/inventory.html', label: '库存', id: 'admin-inventory' },
      { href: 'admin/leads.html', label: '询价', id: 'admin-leads' },
      { href: 'admin/emails.html', label: '邮件', id: 'admin-emails' },
      { href: 'admin/analytics.html', label: '访问统计', id: 'admin-analytics' },
      { href: 'admin/apsales-progress.html', label: '推广', id: 'admin-apsales-progress' },
    ];
    const nav = links.map((item) => {
      const on = item.id === page || (item.id === 'admin-apsales-progress' && page === 'admin-apsales-zijing')
        ? ' is-active'
        : '';
      return `<a class="admin-v4-nav__link${on}" href="${href(item.href)}">${item.label}</a>`;
    }).join('');
    return `
      <header class="header admin-v4-header" data-admin-ia="reorg-v1">
        <div class="container header__inner admin-v4-header__inner">
          <a class="ap-logo admin-v4-header__logo" href="${href('admin/inventory.html')}" aria-label="AsiaPower 管理后台">Asia<span>Power</span> · 管理后台</a>
          <nav class="admin-v4-nav" aria-label="管理后台导航">
            ${nav}
          </nav>
        </div>
      </header>`;
  }

  function renderEbayTrustFooter() {
    const icons = {
      shipping: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
      quality: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M12 3l7 4v5c0 4.5-3 8.5-7 9-4-.5-7-4.5-7-9V7l7-4z"/><path d="M9 12l2 2 4-4"/></svg>',
      pricing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M4 7h16l-2 10H6L4 7z"/><path d="M9 11h6"/><circle cx="9" cy="20" r="1.25" fill="currentColor" stroke="none"/><circle cx="17" cy="20" r="1.25" fill="currentColor" stroke="none"/></svg>',
      suppliers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M3 21V9l9-5 9 5v12"/><path d="M9 21v-6h6v6"/><path d="M3 12h18"/></svg>',
    };
    const items = [
      {
        icon: icons.shipping,
        labelKey: 'ebay.trust.shipping.label',
        label: 'Global export',
        subKey: 'ebay.trust.shipping.sub',
        sub: '110+ destinations · EXW & CIF quotes',
      },
      {
        icon: icons.quality,
        labelKey: 'ebay.trust.quality.label',
        label: 'Verified condition',
        subKey: 'ebay.trust.quality.sub',
        sub: 'Pre-dismantle startup video on request',
      },
      {
        icon: icons.pricing,
        labelKey: 'ebay.trust.pricing.label',
        label: 'Transparent EXW pricing',
        subKey: 'ebay.trust.pricing.sub',
        sub: 'Quoted direct from live inventory',
      },
      {
        icon: icons.suppliers,
        labelKey: 'ebay.trust.suppliers.label',
        label: '200+ supplier network',
        subKey: 'ebay.trust.suppliers.sub',
        sub: 'Zhengzhou hub · passenger · truck · machinery',
      },
    ];
    const cards = items.map((item) => `
          <article class="ebay-trust__item">
            <span class="ebay-trust__mark" aria-hidden="true">${item.icon}</span>
            <div class="ebay-trust__copy">
              <p class="ebay-trust__label" data-i18n="${item.labelKey}">${item.label}</p>
              <p class="ebay-trust__sub" data-i18n="${item.subKey}">${item.sub}</p>
            </div>
          </article>`).join('');

    return `
      <footer class="ebay-trust" aria-label="${t('ebay.trust.aria', 'AsiaPower export assurance')}">
        <div class="ebay-trust__inner">
          ${cards}
        </div>
        <div class="ebay-trust__legal">
          <span>&copy; ${new Date().getFullYear()} AsiaPower</span>
          <span class="ebay-trust__links">
            <a href="${href('contact.html')}" data-i18n="footer.contactUs">Contact Us</a>
            <a href="${href('guides/')}">Guides</a>
            <a href="${href('about.html')}" data-i18n="footer.aboutLink">About Us</a>
            <a href="${href('login/')}" data-i18n="nav.signIn">Sign in</a>
            <a href="${href('supplier-portal.html')}" data-i18n="footer.supplierPortal">Supplier Portal</a>
          </span>
        </div>
      </footer>`;
  }

  function renderHomeSearchHeader(activeId) {
    const c = getConfig();
    if (!c) return '';
    const pub = i18n();
    const switcher = pub ? pub.renderLangSwitcher() : '';
    const searchIcon = '<svg class="v3-header-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

    const catNav = [
      { href: 'half-cuts/', label: t('home.catHalfCuts', 'Half-Cuts'), id: 'halfcuts' },
      { href: 'engines/', label: t('home.catEngines', 'Engines'), id: 'engines' },
      { href: 'trucks/', label: t('nav.trucks', 'Trucks'), id: 'trucks' },
      { href: 'gearboxes/', label: t('home.catGearboxes', 'Gearboxes'), id: 'gearboxes' },
      { href: 'machinery/', label: t('nav.machinery', 'Machinery'), id: 'machinery' },
      { href: 'motorcycles/', label: t('nav.motorcycles', 'Motorcycles'), id: 'motorcycles' },
    ];
    const cats = catNav.map((item) =>
      `<a href="${href(item.href)}" class="v3-header__cat${item.id === activeId ? ' is-active' : ''}">${item.label}</a>`
    ).join('');

    const drawerLinks = c.nav.map((item) =>
      `<a href="${href(item.href)}" class="nav__link${item.id === activeId ? ' active' : ''}">${navLabel(item)}</a>`
    ).join('');

    const isV4Home = document.body.classList.contains('page-home-v4');
    const logoEl = isV4Home
      ? `<a href="${href('index.html')}" class="logo v3-header__logo ap-wordmark" aria-label="AsiaPower Home">
           <span class="ap-wordmark__asia">ASIA</span><span class="ap-wordmark__power">POWER</span>
         </a>`
      : `<a href="${href('index.html')}" class="logo v3-header__logo" aria-label="AsiaPower Home">
           ${logoImg('logo__img', ' fetchpriority="high"')}
         </a>`;

    return `
      <header class="header v3-header">
        <div class="container v3-header__shell">
          <div class="v3-header__row">
            ${logoEl}
            <form class="v3-header-search" id="v3-header-search-form" role="search">
              ${searchIcon}
              <input type="search" id="v3-header-search-input" placeholder="Toyota 2AZ-FE · Isuzu 4JB1 · HC250160…" aria-label="Search inventory" data-i18n-placeholder="home.v3SearchPlaceholder">
              <button type="submit" class="v3-header-search__btn" data-i18n="home.v3SearchBtn">Search</button>
            </form>
            <div class="v3-header__actions"></div>
            <button class="menu-toggle" type="button" aria-label="${t('nav.openMenu', 'Open menu')}" aria-expanded="false" aria-controls="main-nav">
              <span></span><span></span><span></span>
            </button>
          </div>
          <nav class="v3-header__cats" aria-label="Browse categories">${cats}</nav>
          <nav class="nav v3-header__drawer" id="main-nav" aria-label="Main navigation">
            <div class="nav__logo">${logoImg('logo__img', '')}</div>
            ${drawerLinks}
          </nav>
        </div>
      </header>`;
  }

  function renderHeader(activeId) {
    if (useEbayLayout()) return renderEbayHeader();
    if (isInternalToolPage()) return renderAdminHeader();
    if (isHomeV3()) return renderHomeSearchHeader(activeId);
    const c = getConfig();
    if (!c) return '';
    const pub = i18n();
    const links = c.nav.map(item =>
      `<a href="${href(item.href)}" class="nav__link${item.id === activeId ? ' active' : ''}">${navLabel(item)}</a>`
    ).join('');
    const switcher = pub ? pub.renderLangSwitcher() : '';

    return `
      <header class="header">
        <div class="container header__inner">
          ${textLogo('ap-logo logo header__logo')}
          <button class="menu-toggle" type="button" aria-label="${t('nav.openMenu', 'Open menu')}" aria-expanded="false" aria-controls="main-nav">
            <span></span><span></span><span></span>
          </button>
          <nav class="nav" id="main-nav" aria-label="Main navigation">
            <div class="nav__logo">
              ${textLogo('ap-logo')}
            </div>
            ${links}
            ${switcher}
            ${renderLoginEntry()}
          </nav>
        </div>
      </header>`;
  }

  function renderFooterSeo(c) {
    const engines = (c.seoEngines || []).map(item =>
      `<li><a href="${href(`engines/${item.slug}.html`)}">${item.code}</a></li>`
    ).join('');
    const brands = (c.seoBrands || []).map(item =>
      `<li><a href="${href(item.href)}">${item.name}</a></li>`
    ).join('');
    const products = (c.seoProducts || []).map(item =>
      `<li><a href="${href(item.href)}">${item.label}</a></li>`
    ).join('');

    return '';
  }

  function renderAdminFooter() {
    const year = new Date().getFullYear();
    const links = [
      { href: 'admin/inventory.html', label: '库存' },
      { href: 'admin/leads.html', label: '询价' },
      { href: 'admin/emails.html', label: '邮件' },
      { href: 'admin/analytics.html', label: '访问统计' },
      { href: 'admin/apsales-progress.html', label: '推广' },
      { href: 'index.html', label: '返回官网' },
    ].map((item) => `<a href="${href(item.href)}">${item.label}</a>`).join('<span class="admin-v4-footer__dot" aria-hidden="true">·</span>');
    return `
      <footer class="admin-v4-footer" role="contentinfo">
        <div class="container admin-v4-footer__inner">
          <div class="admin-v4-footer__brand">
            ${textLogo('ap-logo admin-v4-footer__logo')}
            <p class="admin-v4-footer__tag">管理后台 · 郑州出口仓</p>
          </div>
          <nav class="admin-v4-footer__nav" aria-label="管理后台页脚">
            ${links}
          </nav>
        </div>
        <div class="container admin-v4-footer__bottom">
          <span>&copy; ${year} AsiaPower</span>
          <span>内部工具 · 不对公网营销</span>
        </div>
      </footer>`;
  }

  function renderFooter() {
    if (useEbayLayout()) return renderEbayTrustFooter();
    if (isInternalToolPage()) return renderAdminFooter();
    const c = getConfig();
    if (!c) return '';
    const navLinks = c.nav.map(item => `<li><a href="${href(item.href)}">${navLabel(item)}</a></li>`).join('');

    return `
      <footer class="footer ap-footer">
        <div class="ap-footer__inner">
          <div class="ap-footer__brand">
            ${textLogo('ap-logo logo logo--footer')}
            <p class="ap-footer__tagline">Zhengzhou Export Hub · 110+ Countries</p>
            <div class="ap-footer__contact">
              <a href="https://wa.me/${c.whatsapp}" target="_blank" rel="noopener noreferrer">${iconSvg('whatsapp')} ${c.whatsappDisplay}</a>
              <a href="mailto:${c.email}">${iconSvg('mail')} ${c.email}</a>
            </div>
          </div>
          <div class="ap-footer__col">
            <div class="ap-footer__col-title" data-i18n="footer.products">Products</div>
            <ul>
              <li><a href="${href('half-cuts/')}" data-i18n="home.catHalfCuts">Front Cuts</a></li>
              <li><a href="${href('engines/')}" data-i18n="home.catEngines">Engines</a></li>
              <li><a href="${href('gearboxes/')}" data-i18n="home.catGearboxes">Gearboxes</a></li>
              <li><a href="${href('trucks/')}" data-i18n="nav.trucks">Trucks &amp; Cabs</a></li>
              <li><a href="${href('chassis-parts/')}" data-i18n="home.catChassis">Chassis Parts</a></li>
              <li><a href="${href('tires/')}" data-i18n="catalog.tires">Used Tires</a></li>
            </ul>
          </div>
          <div class="ap-footer__col">
            <div class="ap-footer__col-title" data-i18n="footer.company">Company</div>
            <ul>
              <li><a href="${href('about.html')}" data-i18n="footer.aboutLink">About Us</a></li>
              <li><a href="${href('brands.html')}" data-i18n="footer.brandDirectory">Brand Directory</a></li>
              <li><a href="${href('contact.html')}" data-i18n="footer.contactUs">Contact</a></li>
              <li><a href="${href('guides/')}">Guides</a></li>
              <li><a href="${href('login/')}" data-i18n="nav.signIn">Sign in</a></li>
              <li><a href="${href('supplier-portal.html')}" data-i18n="footer.supplierPortal">Supplier Portal</a></li>
            </ul>
          </div>
          <div class="ap-footer__col">
            <div class="ap-footer__col-title" data-i18n="footer.offices">Offices</div>
            <div class="ap-footer__office">
              <span class="ap-footer__office-flag">${c.offices.china.flag}</span>
              <div>
                <div class="ap-footer__office-name">${c.offices.china.label}</div>
                <div class="ap-footer__office-addr">${c.offices.china.address}</div>
              </div>
            </div>
            <div class="ap-footer__office">
              <span class="ap-footer__office-flag">${c.offices.ghana.flag}</span>
              <div>
                <div class="ap-footer__office-name">${c.offices.ghana.label}</div>
                <div class="ap-footer__office-addr">${c.offices.ghana.address}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="ap-footer__bottom">
          <span>&copy; ${new Date().getFullYear()} AsiaPower. <span data-i18n="footer.rights">All rights reserved.</span></span>
          <span><a href="${href('contact.html')}" data-i18n="footer.contactUs">Contact Us</a> · <a href="${href('supplier-portal.html')}" data-i18n="footer.supplierPortal">Supplier Portal</a></span>
        </div>
      </footer>`;
  }

  function renderWhatsApp() {
    const c = getConfig();
    if (!c) return '';
    if (document.body.dataset.page === 'home') return '';
    if (isInternalToolPage()) return '';
    return `
      <div class="whatsapp-float">
        <span class="whatsapp-float__label">${t('whatsapp.label', 'Chat on WhatsApp')}</span>
        <a href="https://wa.me/${c.whatsapp}?text=${encodeURIComponent(c.whatsappTruckMessage || c.whatsappMessage)}" target="_blank" rel="noopener noreferrer" class="whatsapp-float__btn" aria-label="${t('whatsapp.label', 'Chat on WhatsApp')}">
          ${iconSvg('whatsapp')}
        </a>
      </div>`;
  }

  function renderAppBottomNav(activeId) {
    const items = [
      { id: 'home', label: 'Home', href: 'index.html', icon: 'H' },
      { id: 'products', label: 'Products', href: 'engines/', icon: 'P' },
      { id: 'brands', label: 'Brands', href: 'brands.html', icon: 'B' },
      { id: 'contact', label: 'Contact', href: 'contact.html', icon: 'C' },
      { id: 'app', label: 'App', href: 'app.html', icon: 'A' },
    ];
    const page = document.body.dataset.page || activeId;
    const path = window.location.pathname;
    const current = page === 'engines' || page === 'gearboxes' || page === 'halfcuts' ? 'products'
      : path.endsWith('/app.html') || path.endsWith('app.html') ? 'app'
      : activeId;
    const links = items.map(item => `
      <a class="app-bottom-nav__item${item.id === current ? ' active' : ''}" href="${href(item.href)}" aria-label="${item.label}">
        <span class="app-bottom-nav__icon" aria-hidden="true">${item.icon}</span>
        <span class="app-bottom-nav__label">${item.label}</span>
      </a>`).join('');

    return `<nav class="app-bottom-nav" aria-label="Mobile app navigation">${links}</nav>`;
  }

  function syncEbaySearchPlaceholder() {
    const input = document.querySelector('[data-ebay-search] input[type="search"]');
    if (!input) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => {
      const pub = i18n();
      if (!pub) return;
      const short = pub.t('ebay.searchPlaceholderShort', 'HC250160, 2AZ-FE…');
      const long = pub.t('ebay.searchPlaceholder', input.dataset.i18nPlaceholderEn || input.placeholder || '');
      input.placeholder = mq.matches ? '' : long;
    };
    apply();
    if (!window.__ebaySearchPlaceholderMq) {
      window.__ebaySearchPlaceholderMq = mq;
      mq.addEventListener('change', apply);
    }
  }

  /** Shared hamburger→drawer toggle for the compact mobile header (home-v4-hybrid + ebay-layout). */
  function bindMobileNavDrawer() {
    if (window.__mnavBound) return;
    window.__mnavBound = true;

    function activeDrawer() {
      return document.querySelector('[data-mnav-drawer].open');
    }
    function activeToggle() {
      return document.querySelector('[data-mnav-toggle][aria-expanded="true"]');
    }
    function setOpen(toggle, drawer, open) {
      drawer.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('mnav-open', open);
    }
    function updateHeaderHeightVar() {
      const header = document.querySelector('.ebay-header') || document.querySelector('.ap-nav');
      const topBar = document.getElementById('site-topbar');
      const hasTopBar = topBar && topBar.offsetHeight > 0 && !topBar.classList.contains('site-topbar--hidden');
      const height = (hasTopBar ? topBar.offsetHeight : 0) + (header?.offsetHeight || 0);
      document.documentElement.style.setProperty('--site-header-height', `${height}px`);
    }

    updateHeaderHeightVar();
    window.addEventListener('resize', updateHeaderHeightVar, { passive: true });
    window.addEventListener('orientationchange', updateHeaderHeightVar);
    window.addEventListener('asiapower:layoutrefresh', updateHeaderHeightVar);

    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-mnav-toggle]');
      if (toggle) {
        const drawer = document.getElementById(toggle.getAttribute('aria-controls') || '');
        if (drawer) setOpen(toggle, drawer, !drawer.classList.contains('open'));
        return;
      }
      const drawer = activeDrawer();
      if (!drawer) return;
      if (drawer.contains(event.target) && !event.target.closest('a, .lang-switcher__btn')) return;
      const toggleEl = activeToggle();
      if (toggleEl) setOpen(toggleEl, drawer, false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const drawer = activeDrawer();
      const toggle = activeToggle();
      if (drawer && toggle) setOpen(toggle, drawer, false);
    });
  }

  function injectLayout() {
    const activeId = currentPageId();
    const topBar = document.getElementById('site-topbar');
    const header = document.getElementById('site-header');
    const footer = document.getElementById('site-footer');
    const wa = document.getElementById('site-whatsapp');

    if (useEbayLayout()) {
      document.body.classList.add('scheme-ebay');
      injectEbayStylesheet();
      injectCatalogGalleryScript();
      injectEbayScript();
      injectSearchTrendsScript();
      let promoEl = document.getElementById('site-promo');
      if (!promoEl && header) {
        promoEl = document.createElement('div');
        promoEl.id = 'site-promo';
        header.parentNode.insertBefore(promoEl, header);
      }
      if (promoEl) {
        promoEl.innerHTML = '';
        promoEl.hidden = true;
        promoEl.classList.add('site-promo--hidden');
      }
      if (topBar) {
        topBar.innerHTML = '';
        topBar.classList.add('site-topbar--hidden');
      }
    } else {
      document.body.classList.remove('scheme-ebay');
      const promoEl = document.getElementById('site-promo');
      if (promoEl) promoEl.innerHTML = '';
    }

    if (topBar && !useEbayLayout()) {
      topBar.innerHTML = renderTopBar();
      topBar.classList.toggle('site-topbar--hidden', !topBar.innerHTML.trim());
    }
    if (!document.querySelector('.skip-link')) {
      document.body.insertAdjacentHTML('afterbegin', renderSkipLink());
    }
    const isHybridHome = document.body.classList.contains('page-home-v4-hybrid');
    if (header) header.innerHTML = isHybridHome ? '' : renderHeader(activeId);
    if (footer) footer.innerHTML = isHybridHome ? '' : renderFooter();
    if (wa) wa.innerHTML = isHybridHome ? '' : renderWhatsApp();

    const navLang = document.getElementById('nav-lang');
    if (isHybridHome && navLang) {
      const pubLang = i18n();
      navLang.innerHTML = pubLang ? pubLang.renderLangSwitcher() : '';
    }

    if (!document.querySelector('link[data-login-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
  link.href = href('css/login.css?v=auth-nav-once-v2');
      link.setAttribute('data-login-css', '1');
      document.head.appendChild(link);
    }
    document.querySelectorAll('.app-bottom-nav').forEach((nav) => nav.remove());
    const standaloneApp = document.documentElement.classList.contains('ap-app')
      || document.body.classList.contains('ap-app-shell')
      || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;
    if (!standaloneApp && !isHybridHome && !isInternalToolPage() && !useEbayLayout()) {
      document.body.insertAdjacentHTML('beforeend', renderAppBottomNav(activeId));
    }
    ensurePwaAppShellAssets();
    ensureQuoteListAssets();

    const pub = i18n();
    if (pub) {
      pub.bindLangSwitcher(isHybridHome ? document : header);
      pub.applyDataI18n(document.body);
    }
    if (useEbayLayout()) syncEbaySearchPlaceholder();

    hydrateAuthSlots(document);
    bindMobileNavDrawer();
    window.dispatchEvent(new CustomEvent('asiapower:layoutrefresh'));
  }

  function ensureQuoteListAssets() {
    if (!document.querySelector('link[data-quote-list-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href('css/quote-list.css?v=quote-list-v1');
      link.setAttribute('data-quote-list-css', '1');
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-quote-list-js]')) {
      const script = document.createElement('script');
      script.src = href('js/quote-list.js?v=quote-list-v1');
      script.setAttribute('data-quote-list-js', '1');
      script.onload = () => {
        if (window.QuoteList) {
          window.QuoteList.refreshBadges();
          window.QuoteList.wireAddButtons();
        }
      };
      document.head.appendChild(script);
    } else if (window.QuoteList) {
      window.QuoteList.refreshBadges();
    }
  }

  function ensurePwaAppShellAssets() {
    if (!document.querySelector('link[data-ap-app-shell-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href(`css/pwa-app-shell.css?v=pwa-app-v6b`);
      link.setAttribute('data-ap-app-shell-css', '1');
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-ap-app-shell-js]') && !window.AsiaPowerAppShell) {
      const script = document.createElement('script');
      script.src = href(`js/pwa-app-shell.js?v=pwa-app-v6b`);
      script.defer = true;
      script.setAttribute('data-ap-app-shell-js', '1');
      document.head.appendChild(script);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectLayout);
  } else {
    injectLayout();
  }

  window.addEventListener('asiapower:langchange', injectLayout);
})();
